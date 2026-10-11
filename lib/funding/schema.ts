import { z } from "zod";

// Funding stages Gemini may report. "undisclosed" = article gives no stage label.
export const STAGES = [
  "pre_seed", "seed", "angel", "pre_series_a", "series_a", "series_b_or_later",
  "bridge", "debt", "grant", "undisclosed", "other",
] as const;
export type Stage = (typeof STAGES)[number];

export const TriageSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      is_funding_news: z.boolean().describe("true only if the item reports new money raised by one or more private startups"),
      is_roundup: z.boolean().describe("true if it lists several startups' rounds (e.g. weekly funding roundup)"),
      reason: z.string().describe("max 12 words"),
    }),
  ),
});

const nullableStr = z.string().nullable();

export const ExtractedRoundSchema = z.object({
  startup_name: z.string(),
  startup_quote: z.string().describe("verbatim sentence fragment from the text that names the startup and its raise"),
  one_liner: nullableStr.describe("what the startup does, as stated in the text"),
  sector_hint: nullableStr,
  website: nullableStr.describe("only if a URL or domain for the startup appears in the text"),
  hq_city: nullableStr,
  country: nullableStr,
  country_basis: z.enum(["stated", "inferred_from_city", "inferred_from_context", "unknown"]),
  stage: z.enum(STAGES),
  stage_quote: nullableStr.describe("verbatim fragment containing the stage label, null if undisclosed"),
  amount_text: nullableStr.describe("amount exactly as written, e.g. 'Rs 12 Cr' or '$2.5 Mn'"),
  amount_value: z.number().nullable().describe("amount as a plain number in the stated currency, e.g. 120000000 for Rs 12 Cr"),
  currency: z.enum(["INR", "USD", "EUR", "GBP", "SGD", "AED", "OTHER"]).nullable(),
  amount_quote: nullableStr,
  announced_date: nullableStr.describe("YYYY-MM-DD only if an explicit calendar date of the announcement is written"),
  date_quote: nullableStr,
  is_new_announcement: z.boolean().describe("false if the round is mentioned only as background or history"),
  investors: z.array(z.string()),
  founders: z.array(z.object({ name: z.string(), role: nullableStr })),
  founders_quote: nullableStr,
});
export type ExtractedRound = z.infer<typeof ExtractedRoundSchema>;

// No .max(): Gemini rejects maxItems on arrays of objects (HTTP 400, found 2026-10-12). Capped in code instead.
export const ExtractionSchema = z.object({ rounds: z.array(ExtractedRoundSchema) });
export const MAX_ROUNDS_PER_ARTICLE = 15;
