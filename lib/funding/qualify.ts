import { quoteSupported } from "./verify";
import type { Criterion } from "../thesis";

/**
 * Qualification maths — pure code, so the decision is reproducible and explainable.
 * Gemini supplies a 0–10 score per criterion with an evidence quote; code enforces
 * "evidence or zero", applies thesis weights, then compares with the threshold.
 */

export type AiCriterionScore = { key: string; score: number; evidence: string | null; reasoning: string };

export type ScoredCriterion = {
  score: number; // after evidence check
  ai_score: number;
  weight: number;
  evidence: string | null;
  evidence_verified: boolean;
  reasoning: string;
};

export function scoreCriteria(
  ai: AiCriterionScore[],
  criteria: Record<string, Criterion>,
  sourceText: string,
): Record<string, ScoredCriterion> {
  const out: Record<string, ScoredCriterion> = {};
  for (const [key, c] of Object.entries(criteria)) {
    const a = ai.find((x) => x.key === key);
    const aiScore = a ? Math.max(0, Math.min(10, Math.round(a.score))) : 0;
    const verified = !!a?.evidence && quoteSupported(a.evidence, sourceText);
    out[key] = {
      score: verified ? aiScore : 0,
      ai_score: aiScore,
      weight: c.weight,
      evidence: a?.evidence ?? null,
      evidence_verified: verified,
      reasoning: a ? a.reasoning : "Criterion missing from the AI response → scored 0",
    };
  }
  return out;
}

/** Weighted total on a 0–100 scale. */
export function weightedTotal(scored: Record<string, ScoredCriterion>): number {
  const totalWeight = Object.values(scored).reduce((s, c) => s + c.weight, 0);
  if (totalWeight <= 0) return 0;
  const raw = Object.values(scored).reduce((s, c) => s + (c.score / 10) * c.weight, 0);
  return Math.round((raw / totalWeight) * 1000) / 10;
}

export function decide(opts: { total: number; threshold: number; excludedMatch: string | null }) {
  const gateFailures = opts.excludedMatch ? [`excluded_sector:${opts.excludedMatch}`] : [];
  const qualified = gateFailures.length === 0 && opts.total >= opts.threshold;
  return { qualified, gateFailures };
}

/** Thesis fields that change what Gemini is asked. If none changed, re-scoring needs no AI call. */
export function semanticThesisKey(t: { summary: string; sectors: string[]; excluded_sectors: string[]; business_models: string[]; criteria: Record<string, { description: string; weight?: number }> }): string {
  return JSON.stringify({
    summary: t.summary,
    sectors: t.sectors,
    excluded: t.excluded_sectors,
    models: t.business_models,
    criteria: Object.entries(t.criteria).map(([k, c]) => [k, c.description]).sort(),
  });
}

/** Re-apply new weights to already evidence-checked scores (no AI). */
export function reweigh(prev: Record<string, ScoredCriterion>, criteria: Record<string, Criterion>): Record<string, ScoredCriterion> {
  const out: Record<string, ScoredCriterion> = {};
  for (const [key, c] of Object.entries(criteria)) {
    const p = prev[key];
    out[key] = p ? { ...p, weight: c.weight } : { score: 0, ai_score: 0, weight: c.weight, evidence: null, evidence_verified: false, reasoning: "New criterion — needs AI re-scoring" };
  }
  return out;
}
