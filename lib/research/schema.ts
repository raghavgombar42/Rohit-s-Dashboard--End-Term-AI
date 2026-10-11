import { z } from "zod";

export const WebsiteSchema = z.object({
  candidates: z.array(z.object({ url: z.string(), reason: z.string() })).describe("up to 3 likely official website URLs, best first"),
});

export const BUSINESS_MODELS = ["B2C", "D2C", "B2B2C", "B2B", "Marketplace", "Other", "Unknown"] as const;

export const ResearchSchema = z.object({
  one_liner: z.string().describe("one sentence: what the startup does and for whom"),
  product: z.string().nullable(),
  customers: z.string().nullable(),
  business_model: z.enum(BUSINESS_MODELS),
  facts: z.array(
    z.object({
      category: z.enum(["product", "customers", "traction", "team", "funding_use", "market", "other"]),
      claim: z.string().describe("short factual claim in your words"),
      source_id: z.string().describe("id of the source the claim comes from, e.g. A1 or W2"),
      quote: z.string().describe("verbatim supporting fragment from that source"),
    }),
  ),
});
export type Research = z.infer<typeof ResearchSchema>;

/** Built per run from the live thesis, so criteria keys and excluded sectors are never hard-coded. */
export function fitSchema(criteriaKeys: string[], excludedSectors: string[]) {
  return z.object({
    primary_sector: z.string(),
    excluded_sector_match: z.enum(["none", ...excludedSectors] as [string, ...string[]])
      .describe("the excluded sector this startup primarily belongs to, or 'none'"),
    business_model: z.enum(BUSINESS_MODELS),
    criteria: z.array(
      z.object({
        key: z.enum(criteriaKeys as [string, ...string[]]),
        score: z.number().describe("integer 0–10"),
        evidence: z.string().nullable().describe("verbatim fragment from the sources supporting the score; null if none"),
        reasoning: z.string().describe("one sentence"),
      }),
    ),
    summary: z.string().describe("2 sentences: why this startup does or does not fit the thesis"),
  });
}
