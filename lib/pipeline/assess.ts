import { db } from "../db";
import { generateJSON } from "../gemini";
import {
  FIT_SYSTEM, RESEARCH_PROMPT_VERSION, RESEARCH_SYSTEM, WEBSITE_SYSTEM,
  fitPrompt, researchPrompt, websitePrompt, type SourceDoc,
} from "../ai/prompts";
import { ResearchSchema, WebsiteSchema, fitSchema } from "../research/schema";
import { fetchCompanyPages, fetchPage, pageMatchesStartup } from "../research/web";
import { decide, reweigh, scoreCriteria, semanticThesisKey, weightedTotal, type ScoredCriterion } from "../funding/qualify";
import { domainOf, quoteSupported } from "../funding/verify";
import { STAGE_LABEL } from "../labels";
import { loadActiveThesis, type Thesis } from "../thesis";
import type { RunContext } from "./context";

const PER_RUN_LIMIT = 12;
const CONCURRENCY = 2;

type RoundForAssess = {
  id: number; startup_id: number; name: string; website: string | null; hq_city: string | null; description: string | null;
  stage: string; amount_text: string | null; investors: string[];
};

/** S7–S10: research each new round, then score it against the CURRENT thesis and qualify in code. */
export async function assessStage(ctx: RunContext): Promise<void> {
  const sql = db();
  const queue = await sql<RoundForAssess[]>`
    select r.id::int, s.id::int as startup_id, s.name, s.website, s.hq_city, s.description, r.stage, r.amount_text, r.investors
    from funding_rounds r join startups s on s.id = r.startup_id
    where r.status = 'new' and r.attempts < 3
    order by r.recency_lane = 'fresh' desc, r.announced_on desc
    limit ${PER_RUN_LIMIT}`;
  if (queue.length === 0) return;

  let next = 0;
  const worker = async () => {
    while (next < queue.length && ctx.timeLeft() > 40_000) {
      const r = queue[next++];
      try {
        // Thesis is re-read for every startup: an edit made mid-run applies to the very next assessment.
        const thesis = await loadActiveThesis();
        await assessRound(ctx, r, thesis);
      } catch (e) {
        ctx.bump("assess_errors");
        await sql`
          update funding_rounds set attempts = attempts + 1, last_error = ${(e as Error).message.slice(0, 500)},
                 status = case when attempts + 1 >= 3 then 'error' else status end
          where id = ${r.id}`;
        await ctx.log("warn", "assess", `${r.name}: ${(e as Error).message}`, { entityType: "round", entityId: r.id });
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

async function findWebsite(ctx: RunContext, r: RoundForAssess) {
  if (r.website) {
    const p = await fetchPage(r.website);
    if (p && pageMatchesStartup(p, r.name)) return { url: p.url, method: "from_article" as const };
  }
  const { data } = await generateJSON({
    purpose: "website", runId: ctx.runId, system: WEBSITE_SYSTEM, schema: WebsiteSchema, thinking: "LOW", googleSearch: true,
    prompt: websitePrompt({ name: r.name, city: r.hq_city, oneLiner: r.description, investors: r.investors }),
  });
  for (const c of data.candidates.slice(0, 3)) {
    if (!domainOf(c.url)) continue; // news / social / directory domains are never a company site
    const p = await fetchPage(c.url);
    if (p && pageMatchesStartup(p, r.name)) return { url: p.url, method: "search_verified" as const };
  }
  return null;
}

export async function assessRound(ctx: RunContext, r: RoundForAssess, thesis: Thesis): Promise<void> {
  const sql = db();

  // ---- Sources we fetched ourselves: the funding articles + the company's own site ----
  const articles = await sql<{ url: string; title: string; text: string | null }[]>`
    select a.url, a.title, coalesce(a.body_text, a.snippet) as text
    from round_sources rs join articles a on a.id = rs.article_id
    where rs.round_id = ${r.id} order by a.body_text is null, a.published_at desc limit 4`;
  const sources: SourceDoc[] = articles.map((a, i) => ({
    id: `A${i + 1}`, kind: "article", url: a.url, title: a.title, text: (a.text ?? "").slice(0, 6000),
  }));

  const website = await findWebsite(ctx, r);
  if (website) {
    const pages = await fetchCompanyPages(website.url);
    pages.forEach((p, i) => sources.push({ id: `W${i + 1}`, kind: "website", url: p.url, title: p.title, text: p.text.slice(0, 5000) }));
    const domain = domainOf(website.url);
    // Record the verified site unless another startup already owns that domain.
    await sql`
      update startups set website = ${website.url}, domain = ${domain}
      where id = ${r.startup_id} and domain is null
        and not exists (select 1 from startups o where o.domain = ${domain} and o.id <> ${r.startup_id})`;
  }

  // ---- Research brief (Gemini) → keep only facts whose quote is found in the cited source ----
  const { data: brief } = await generateJSON({
    purpose: "research", runId: ctx.runId, system: RESEARCH_SYSTEM, schema: ResearchSchema, thinking: "LOW",
    prompt: researchPrompt(r.name, sources),
  });
  const byId = new Map(sources.map((s) => [s.id, s]));
  const verifiedFacts = brief.facts
    .filter((f) => {
      const src = byId.get(f.source_id);
      return !!src && quoteSupported(f.quote, `${src.title}\n${src.text}`);
    })
    .map((f) => ({ ...f, source_url: byId.get(f.source_id)!.url }));
  const research: Research = {
    prompt: RESEARCH_PROMPT_VERSION.research,
    one_liner: brief.one_liner,
    product: brief.product,
    customers: brief.customers,
    business_model: brief.business_model,
    facts: verifiedFacts,
    facts_dropped: brief.facts.length - verifiedFacts.length,
    website: website ? { url: website.url, method: website.method } : null,
    sources: sources.map(({ id, kind, url, title }) => ({ id, kind, url, title })),
  };
  await sql`
    update funding_rounds set research = ${sql.json(research as never)}, source_docs = ${sql.json(sources as never)}, status = 'enriched'
    where id = ${r.id}`;
  if (!r.description && research.one_liner) await sql`update startups set description = ${research.one_liner} where id = ${r.startup_id}`;
  ctx.bump("rounds_researched");

  await scoreRound(ctx, r, research, sources, thesis);
}

type Research = {
  prompt: string; one_liner: string; product: string | null; customers: string | null; business_model: string;
  facts: { claim: string }[]; facts_dropped: number; website: { url: string; method: string } | null;
  sources: { id: string; kind: string; url: string; title: string }[];
};

/** S9–S10: Gemini scores criteria against the given thesis; code verifies evidence, weights and decides. */
export async function scoreRound(ctx: RunContext, r: RoundForAssess, research: Research, sources: SourceDoc[], thesis: Thesis) {
  const sql = db();
  const { data: fit } = await generateJSON({
    purpose: "fit", runId: ctx.runId, system: FIT_SYSTEM, thinking: "MEDIUM",
    schema: fitSchema(Object.keys(thesis.criteria), thesis.excluded_sectors),
    prompt: fitPrompt({
      thesis,
      round: { name: r.name, stage: STAGE_LABEL[r.stage] ?? r.stage, amount: r.amount_text, city: r.hq_city, investors: r.investors },
      brief: { one_liner: research.one_liner, product: research.product, customers: research.customers, business_model: research.business_model, facts: research.facts.map((f) => f.claim) },
      sources,
    }),
  });

  const allText = sources.map((s) => `${s.title}\n${s.text}`).join("\n\n");
  const scored = scoreCriteria(fit.criteria, thesis.criteria, allText);
  const total = weightedTotal(scored);
  const excluded = fit.excluded_sector_match === "none" ? null : fit.excluded_sector_match;
  const { qualified, gateFailures } = decide({ total, threshold: thesis.threshold, excludedMatch: excluded });

  await sql.begin(async (tx) => {
    await tx`
      insert into assessments (round_id, thesis_version, gate_failures, criteria_scores, total, qualified, summary)
      values (${r.id}, ${thesis.version}, ${gateFailures}, ${tx.json({ ...scored, _meta: { primary_sector: fit.primary_sector, business_model: fit.business_model, prompt: RESEARCH_PROMPT_VERSION.fit } } as never)},
              ${total}, ${qualified}, ${fit.summary})`;
    // Never touch rounds that already have outreach: history is not rewritten.
    await tx`
      update funding_rounds set status = ${qualified ? "qualified" : "not_qualified"},
             status_reason = ${qualified ? `Scored ${total} ≥ ${thesis.threshold} (thesis v${thesis.version})` : gateFailures.length ? gateFailures.join(", ") : `Scored ${total} < ${thesis.threshold} (thesis v${thesis.version})`},
             attempts = 0
      where id = ${r.id} and status in ('enriched', 'qualified', 'not_qualified')`;
  });
  ctx.bump(qualified ? "rounds_qualified" : "rounds_not_qualified");
  await ctx.log("info", "assess", `${r.name}: ${total}/100 on thesis v${thesis.version} → ${qualified ? "QUALIFIED" : "not qualified"}${excluded ? ` (excluded: ${excluded})` : ""}`, {
    entityType: "round", entityId: r.id,
  });
  return { total, qualified };
}

/**
 * Re-score policy: after a thesis edit, rounds that are assessed but NOT yet drafted/contacted can be
 * re-scored with the current thesis, using the same stored evidence. Drafted/contacted rounds are never rescored.
 */
export async function rescoreUndrafted(ctx: RunContext): Promise<void> {
  const sql = db();
  const thesis = await loadActiveThesis();
  const rows = await sql<(RoundForAssess & { research: Research; source_docs: SourceDoc[] | null })[]>`
    select r.id::int, s.id::int as startup_id, s.name, s.website, s.hq_city, s.description, r.stage, r.amount_text, r.investors,
           r.research, r.source_docs
    from funding_rounds r join startups s on s.id = r.startup_id
    where r.status in ('qualified', 'not_qualified') and r.research is not null
      and not exists (select 1 from outreach o where o.round_id = r.id)
      and coalesce((select max(a.thesis_version) from assessments a where a.round_id = r.id), 0) < ${thesis.version}`;
  for (const r of rows) {
    if (ctx.timeLeft() < 30_000) break;
    if (!r.source_docs) {
      await ctx.log("warn", "rescore", `${r.name}: no stored evidence (assessed before evidence storage) → research again`, { entityType: "round", entityId: r.id });
      await sql`update funding_rounds set status = 'new' where id = ${r.id}`;
      continue;
    }
    try {
      const [last] = await sql<{ thesis_version: number; criteria_scores: Record<string, ScoredCriterion> & { _meta?: unknown }; gate_failures: string[]; summary: string | null; snapshot: Thesis }[]>`
        select a.thesis_version, a.criteria_scores, a.gate_failures, a.summary, v.snapshot
        from assessments a join thesis_versions v on v.version = a.thesis_version
        where a.round_id = ${r.id} order by a.id desc limit 1`;
      if (last && semanticThesisKey(last.snapshot) === semanticThesisKey(thesis)) {
        // Only numbers changed (threshold / weights): code re-applies the maths to the same verified scores. No AI call.
        const { _meta, ...prev } = last.criteria_scores;
        const scored = reweigh(prev as Record<string, ScoredCriterion>, thesis.criteria);
        const total = weightedTotal(scored);
        const excluded = last.gate_failures.find((g) => g.startsWith("excluded_sector:"))?.slice("excluded_sector:".length) ?? null;
        const { qualified, gateFailures } = decide({ total, threshold: thesis.threshold, excludedMatch: excluded });
        await sql.begin(async (tx) => {
          await tx`
            insert into assessments (round_id, thesis_version, gate_failures, criteria_scores, total, qualified, summary)
            values (${r.id}, ${thesis.version}, ${gateFailures}, ${tx.json({ ...scored, _meta: { ...(_meta as object), reweighed_from: last.thesis_version } } as never)},
                    ${total}, ${qualified}, ${last.summary})`;
          await tx`
            update funding_rounds set status = ${qualified ? "qualified" : "not_qualified"},
                   status_reason = ${`Re-applied thesis v${thesis.version} numbers: ${total} ${qualified ? "≥" : "<"} ${thesis.threshold}`}
            where id = ${r.id} and status in ('qualified', 'not_qualified')`;
        });
        ctx.bump("rounds_reweighed");
        await ctx.log("info", "rescore", `${r.name}: thesis v${thesis.version} changed only numbers → ${total}/100 (no AI call) → ${qualified ? "QUALIFIED" : "not qualified"}`, { entityType: "round", entityId: r.id });
      } else {
        await scoreRound(ctx, r, r.research, r.source_docs, thesis);
        ctx.bump("rounds_rescored");
      }
    } catch (e) {
      await ctx.log("warn", "rescore", `${r.name}: ${(e as Error).message}`, { entityType: "round", entityId: r.id });
    }
  }
}
