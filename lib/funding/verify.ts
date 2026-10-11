import type { ExtractedRound, Stage } from "./schema";

/**
 * Deterministic checks applied to Gemini's extraction. The AI proposes facts with quotes;
 * this file decides what we are allowed to believe. Pure functions → unit-tested.
 */

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A quote counts only if it (or each part around "...") literally appears in the source. */
export function quoteFound(quote: string | null | undefined, source: string): boolean {
  if (!quote) return false;
  const src = normalizeForMatch(source);
  const parts = quote.split(/\.{3}|…/).map(normalizeForMatch).filter((p) => p.length > 0);
  if (parts.length === 0 || parts.join("").length < 8) return false;
  return parts.every((p) => src.includes(p));
}

const STAGE_WORDS: Partial<Record<Stage, RegExp>> = {
  pre_seed: /pre[- ]?seed/,
  seed: /seed/,
  angel: /angel/,
  pre_series_a: /pre[- ]?series[- ]?a/,
  series_a: /series[- ]?a\b/,
  series_b_or_later: /series[- ]?[b-h]\b|growth/,
  bridge: /bridge/,
  debt: /debt|venture debt|loan/,
  grant: /grant/,
};

export type VerifiedRound = ExtractedRound & { notes: string[] };

/** Null out every field whose evidence is not in the source. Returns null if the startup itself is unsupported. */
export function verifyRound(r: ExtractedRound, source: string): VerifiedRound | null {
  const notes: string[] = [];
  const src = normalizeForMatch(source);
  const v: VerifiedRound = { ...r, notes };

  if (!quoteFound(r.startup_quote, source) || !src.includes(normalizeForMatch(r.startup_name))) return null;

  if (r.stage !== "undisclosed" && r.stage !== "other") {
    const word = STAGE_WORDS[r.stage];
    const ok = quoteFound(r.stage_quote, source) && (!word || word.test(normalizeForMatch(r.stage_quote!)));
    if (!ok) {
      notes.push(`stage '${r.stage}' not supported by a verbatim quote → treated as undisclosed`);
      v.stage = "undisclosed";
      v.stage_quote = null;
    }
  }

  if (r.amount_text && !quoteFound(r.amount_quote, source)) {
    notes.push("amount quote not found → amount removed");
    v.amount_text = v.amount_value = v.currency = v.amount_quote = null;
  }

  if (r.announced_date && (!quoteFound(r.date_quote, source) || !/^\d{4}-\d{2}-\d{2}$/.test(r.announced_date))) {
    notes.push("announcement date not supported → falling back to article publish time");
    v.announced_date = v.date_quote = null;
  }

  const keptFounders = r.founders.filter((f) => src.includes(normalizeForMatch(f.name)));
  if (keptFounders.length !== r.founders.length) notes.push(`${r.founders.length - keptFounders.length} founder name(s) not in text → removed`);
  v.founders = keptFounders;

  const keptInvestors = r.investors.filter((i) => src.includes(normalizeForMatch(i)));
  if (keptInvestors.length !== r.investors.length) notes.push(`${r.investors.length - keptInvestors.length} investor(s) not in text → removed`);
  v.investors = keptInvestors;

  if (r.website) {
    const d = domainOf(r.website);
    if (!d || !src.includes(d)) {
      notes.push("website not present in text → removed");
      v.website = null;
    }
  }
  return v;
}

const NOT_COMPANY_DOMAINS = /(^|\.)(linkedin|twitter|x|facebook|instagram|youtube|crunchbase|tracxn|entrackr|inc42|yourstory|economictimes|indiatimes|techcrunch|google|medium|wikipedia)\.(com|in|org)$/;

export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".") || NOT_COMPANY_DOMAINS.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

// ---------- Hard gates ----------

export const INR_PER_USD = 88; // fixed reference rate for size comparisons only (documented in DECISIONS.md)
export const UNDISCLOSED_STAGE_MAX_USD = 4_000_000; // unlabelled rounds up to this size are treated as seed

export function amountUsd(value: number | null, currency: string | null): number | null {
  if (value == null || !currency) return null;
  if (currency === "USD") return value;
  if (currency === "INR") return value / INR_PER_USD;
  return null;
}

export type GateInput = {
  round: VerifiedRound;
  publishedAt: Date | null;
  discoveredAt: Date;
};
export type GateThesis = { stages: string[]; geographies: string[]; fresh_window_hours: number; late_catch_days: number };
export type GateResult = {
  pass: boolean;
  failures: string[];
  stage: string;
  stageBasis: "stated" | "inferred_from_amount" | "undisclosed";
  countryBasis: string;
  announcedOn: string; // YYYY-MM-DD (IST)
  dateSource: "stated_in_article" | "article_published";
  lane: "fresh" | "late_catch" | null;
  ageHours: number;
};

const IST_OFFSET_MS = 5.5 * 3_600_000;
export const istDate = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

export function applyGates(input: GateInput, thesis: GateThesis): GateResult {
  const { round, discoveredAt } = input;
  const failures: string[] = [];

  // 1. Is this news about a new round at all?
  if (!round.is_new_announcement) failures.push("old_round_mentioned_as_background");

  // 2. Stage (unlabelled small rounds are treated as seed — a documented, deterministic rule).
  let stage: string = round.stage;
  let stageBasis: GateResult["stageBasis"] = "stated";
  if (round.stage === "undisclosed") {
    const usd = amountUsd(round.amount_value, round.currency);
    if (usd != null && usd <= UNDISCLOSED_STAGE_MAX_USD) {
      stage = "seed";
      stageBasis = "inferred_from_amount";
    } else stageBasis = "undisclosed";
  }
  if (!thesis.stages.includes(stage)) failures.push(`stage_not_in_thesis:${stage}`);

  // 3. Geography. Rule: a rupee-denominated round with no stated country is treated as Indian.
  let country = round.country_basis === "unknown" ? undefined : round.country?.trim().toLowerCase();
  let countryBasis: string = round.country_basis;
  if (!country && round.currency === "INR" && round.amount_value != null) {
    country = "india";
    countryBasis = "inferred_from_currency";
  }
  if (!country) failures.push("geography_unknown");
  else if (!thesis.geographies.some((g) => g.toLowerCase() === country)) failures.push(`geography_not_in_thesis:${round.country}`);

  // 4. Recency. A stated date without a time is read as the END of that day in IST (most generous honest reading).
  let announcedAt: Date;
  let dateSource: GateResult["dateSource"];
  if (round.announced_date) {
    announcedAt = new Date(new Date(`${round.announced_date}T23:59:59+05:30`).getTime());
    dateSource = "stated_in_article";
  } else {
    announcedAt = input.publishedAt ?? discoveredAt;
    dateSource = "article_published";
  }
  const ageHours = (discoveredAt.getTime() - announcedAt.getTime()) / 3_600_000;
  let lane: GateResult["lane"] = null;
  if (ageHours < -36) failures.push("announcement_date_in_future");
  else if (ageHours <= thesis.fresh_window_hours) lane = "fresh";
  else if (ageHours <= thesis.late_catch_days * 24) lane = "late_catch";
  else failures.push(`stale:${Math.round(ageHours / 24)}d_old`);

  return {
    pass: failures.length === 0,
    failures,
    stage,
    stageBasis,
    countryBasis,
    announcedOn: round.announced_date ?? istDate(announcedAt),
    dateSource,
    lane,
    ageHours: Math.round(ageHours * 10) / 10,
  };
}

// ---------- Near-verbatim evidence (used for fit-score evidence and research facts) ----------

const words = (s: string) => normalizeForMatch(s).replace(/[^a-z0-9₹$%.' -]+/g, " ").split(/\s+/).filter(Boolean);

/**
 * True when the quote appears verbatim, or when ≥ minRatio of its words occur IN ORDER inside one
 * passage of the source no longer than 1.5× the quote. Tolerates a model trimming a few words
 * ("Rs 100 crore over…" vs "Rs 100 crore in revenue over…") but rejects invented sentences.
 */
export function quoteSupported(quote: string | null | undefined, source: string, minRatio = 0.9): boolean {
  if (!quote) return false;
  if (quoteFound(quote, source)) return true;
  const q = words(quote);
  if (q.length < 6) return false; // short quotes must match exactly
  const s = words(source);
  const maxSpan = Math.ceil(q.length * 1.5);
  const need = Math.ceil(q.length * minRatio);
  for (let start = 0; start < s.length; start++) {
    if (s[start] !== q[0] && s[start] !== q[1]) continue;
    let qi = s[start] === q[0] ? 0 : 1;
    let matched = 0;
    for (let si = start; si < Math.min(s.length, start + maxSpan) && qi < q.length; si++) {
      if (s[si] === q[qi]) { matched++; qi++; }
      else if (qi + 1 < q.length && s[si] === q[qi + 1]) { matched++; qi += 2; } // quote word missing from source
    }
    if (matched >= need) return true;
  }
  return false;
}
