// Live check: every AI call type the pipeline makes, through OpenRouter (Google-only routing).
// Usage: npx tsx --env-file=.env.local tests/openrouter-smoke.check.mts
import { db } from "../lib/db";
import { ensureModelAvailable, generateJSON } from "../lib/gemini";
import { EXTRACT_SYSTEM, FIT_SYSTEM, RESEARCH_SYSTEM, TRIAGE_SYSTEM, WEBSITE_SYSTEM, extractPrompt, fitPrompt, researchPrompt, triagePrompt, websitePrompt } from "../lib/ai/prompts";
import { ExtractionSchema, TriageSchema } from "../lib/funding/schema";
import { ResearchSchema, WebsiteSchema, fitSchema } from "../lib/research/schema";
import { EMAIL_SYSTEM, EmailSchema, emailPrompt, validateEmail } from "../lib/outreach/email";
import { loadActiveThesis } from "../lib/thesis";

const sql = db();
const out: [string, boolean, string][] = [];
const t0 = Date.now();
const run = async (name: string, fn: () => Promise<string>) => {
  const s = Date.now();
  try { out.push([name, true, `${await fn()} (${((Date.now() - s) / 1000).toFixed(1)}s)`]); }
  catch (e) { out.push([name, false, (e as Error).message.slice(0, 200)]); }
};

const m = await ensureModelAvailable();
out.push(["model listed on OpenRouter", m.ok, m.id]);

const [art] = await sql`select title, publisher, published_at, body_text from articles where status = 'linked' and body_text is not null order by id desc limit 1`;
const [round] = await sql`select r.id, s.name, s.hq_city, s.description, r.stage, r.amount_text, r.investors, r.research, r.source_docs
                          from funding_rounds r join startups s on s.id = r.startup_id where r.source_docs is not null and s.name = 'Zomint'`;
const [draft] = await sql`select round_snapshot from outreach where round_snapshot is not null order by id limit 1`;
const thesis = await loadActiveThesis();

await run("triage", async () => {
  const { data } = await generateJSON({ purpose: "triage", system: TRIAGE_SYSTEM, schema: TriageSchema, thinking: "LOW",
    prompt: triagePrompt([{ id: "1", title: "Zomint raises Rs 36 Cr seed round from Lightspeed", snippet: null, publisher: "Inc42" }, { id: "2", title: "Sensex closes 300 points higher", snippet: null, publisher: "ET" }]) });
  const ok = data.results.find((r) => r.id === "1")?.is_funding_news === true && data.results.find((r) => r.id === "2")?.is_funding_news === false;
  if (!ok) throw new Error(`wrong classification ${JSON.stringify(data.results)}`);
  return "funding vs non-funding classified correctly";
});
await run("extract", async () => {
  const { data } = await generateJSON({ purpose: "extract", system: EXTRACT_SYSTEM, schema: ExtractionSchema, thinking: "LOW",
    prompt: extractPrompt({ title: art.title, publisher: art.publisher, publishedAt: art.published_at, text: art.body_text }) });
  return `${data.rounds.length} round(s): ${data.rounds.map((r) => `${r.startup_name}/${r.stage}`).join(", ")}`;
});
await run("website (Google native search)", async () => {
  const { data } = await generateJSON({ purpose: "website", system: WEBSITE_SYSTEM, schema: WebsiteSchema, thinking: "LOW", googleSearch: true,
    prompt: websitePrompt({ name: round.name, city: round.hq_city, oneLiner: round.description, investors: round.investors }) });
  return data.candidates.map((c) => c.url).join(", ") || "no candidates";
});
await run("research", async () => {
  const { data } = await generateJSON({ purpose: "research", system: RESEARCH_SYSTEM, schema: ResearchSchema, thinking: "LOW", prompt: researchPrompt(round.name, round.source_docs) });
  return `${data.facts.length} facts, model=${data.business_model}`;
});
await run("fit (thinking MEDIUM)", async () => {
  const { data } = await generateJSON({ purpose: "fit", system: FIT_SYSTEM, thinking: "MEDIUM", schema: fitSchema(Object.keys(thesis.criteria), thesis.excluded_sectors),
    prompt: fitPrompt({ thesis, round: { name: round.name, stage: round.stage, amount: round.amount_text, city: round.hq_city, investors: round.investors },
      brief: { one_liner: round.research.one_liner, facts: round.research.facts.map((f: { claim: string }) => f.claim) }, sources: round.source_docs }) });
  return `${data.criteria.map((c) => `${c.key}=${c.score}`).join(" ")} · sector ${data.primary_sector}`;
});
await run("email + code validation", async () => {
  const { data } = await generateJSON({ purpose: "email", system: EMAIL_SYSTEM, schema: EmailSchema, thinking: "LOW", prompt: emailPrompt(draft.round_snapshot) });
  const problems = validateEmail(data, draft.round_snapshot);
  return problems.length ? `validator flagged: ${problems.join(" | ")}` : `passes validation: "${data.subject}"`;
});

const [cost] = await sql`select count(*)::int calls, sum(cost_usd)::float cost, sum((not ok)::int)::int failed, array_agg(distinct model) models
                          from llm_calls where created_at > to_timestamp(${t0 / 1000})`;
let ok = true;
for (const [n, pass, d] of out) { ok &&= pass; console.log(`${pass ? "PASS" : "FAIL"}  ${n}  — ${d}`); }
console.log(`\nOpenRouter calls: ${cost.calls} (${cost.failed} failed attempts), models ${cost.models}, reported cost $${(cost.cost ?? 0).toFixed(4)}`);
await sql.end();
process.exitCode = ok ? 0 : 1;
