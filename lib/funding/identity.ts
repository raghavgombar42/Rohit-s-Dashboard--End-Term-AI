import type postgres from "postgres";
import { normalizeCompanyName } from "../text";
import { domainOf, type GateResult, type VerifiedRound } from "./verify";

type Tx = postgres.TransactionSql;

/**
 * S6: resolve which startup this is, then which funding round.
 * Startup identity: website domain first (strongest key), then normalised name.
 * Two different existing startups sharing a normalised name → new record flagged needs_review (never silently merged).
 */
export async function resolveStartup(tx: Tx, r: VerifiedRound): Promise<{ id: number; created: boolean; needsReview: boolean }> {
  const domain = domainOf(r.website);
  const nameNorm = normalizeCompanyName(r.startup_name) || r.startup_name.toLowerCase();

  if (domain) {
    const [byDomain] = await tx<{ id: number }[]>`select id from startups where domain = ${domain}`;
    if (byDomain) return { id: byDomain.id, created: false, needsReview: false };
  }
  const sameName = await tx<{ id: number; domain: string | null }[]>`select id, domain from startups where name_normalized = ${nameNorm}`;
  if (sameName.length === 1 && (!domain || !sameName[0].domain)) {
    if (domain) await tx`update startups set domain = ${domain}, website = ${r.website} where id = ${sameName[0].id}`;
    return { id: sameName[0].id, created: false, needsReview: false };
  }
  const needsReview = sameName.length > 1 || (sameName.length === 1 && !!domain && sameName[0].domain !== domain);
  const [created] = await tx<{ id: number }[]>`
    insert into startups (name, name_normalized, domain, website, hq_city, country, description, founders, needs_review)
    values (${r.startup_name}, ${nameNorm}, ${domain}, ${domain ? r.website : null}, ${r.hq_city}, ${r.country ?? (r.currency === "INR" ? "India" : null)},
            ${r.one_liner}, ${tx.json(r.founders)}, ${needsReview})
    returning id`;
  return { id: created.id, created: true, needsReview };
}

/** Same startup + same stage within ±21 days = the same round reported again → attach as an extra source. */
export async function upsertRound(
  tx: Tx,
  startupId: number,
  r: VerifiedRound,
  g: GateResult,
  articleId: number,
  isReplay: boolean,
): Promise<{ roundId: number; isNew: boolean }> {
  const [existing] = await tx<{ id: number }[]>`
    select id from funding_rounds
    where startup_id = ${startupId} and stage = ${g.stage}
      and abs(announced_on - ${g.announcedOn}::date) <= 21
    order by id limit 1`;
  let roundId: number;
  let isNew = false;
  if (existing) {
    roundId = existing.id;
    // Fill gaps from the new source without overwriting verified facts.
    await tx`
      update funding_rounds set
        amount = coalesce(amount, ${r.amount_value}), currency = coalesce(currency, ${r.currency}),
        amount_text = coalesce(amount_text, ${r.amount_text}),
        investors = case when jsonb_array_length(investors) = 0 then ${tx.json(r.investors)} else investors end
      where id = ${roundId}`;
  } else {
    const evidence = {
      startup: r.startup_quote, stage: r.stage_quote, amount: r.amount_quote, date: r.date_quote,
      founders: r.founders_quote, country_basis: g.countryBasis, notes: r.notes,
    };
    const [ins] = await tx<{ id: number }[]>`
      insert into funding_rounds (startup_id, stage, stage_basis, amount, currency, amount_text, announced_on, date_source,
                                  investors, evidence, recency_lane, age_hours_at_discovery, is_replay)
      values (${startupId}, ${g.stage}, ${g.stageBasis}, ${r.amount_value}, ${r.currency}, ${r.amount_text}, ${g.announcedOn},
              ${g.dateSource}, ${tx.json(r.investors)}, ${tx.json(evidence)}, ${g.lane}, ${g.ageHours}, ${isReplay})
      on conflict (startup_id, stage, announced_week) do nothing
      returning id`;
    if (ins) {
      roundId = ins.id;
      isNew = true;
    } else {
      const [again] = await tx<{ id: number }[]>`
        select id from funding_rounds where startup_id = ${startupId} and stage = ${g.stage}
          and announced_week = date_trunc('week', ${g.announcedOn}::date::timestamp)::date`;
      roundId = again.id;
    }
  }
  await tx`insert into round_sources (round_id, article_id) values (${roundId}, ${articleId}) on conflict do nothing`;
  // Syndicated copies of this article become sources of the same round too.
  await tx`
    insert into round_sources (round_id, article_id)
    select ${roundId}, id from articles where reject_reason = ${"duplicate_of:" + articleId}
    on conflict do nothing`;
  return { roundId, isNew };
}
