import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, scoreCriteria, weightedTotal } from "../lib/funding/qualify";
import { pageMatchesStartup } from "../lib/research/web";

const criteria = {
  sector_fit: { weight: 35, description: "" },
  consumer_model: { weight: 20, description: "" },
  india_focus: { weight: 15, description: "" },
  traction_signals: { weight: 15, description: "" },
  program_need: { weight: 15, description: "" },
};
const SRC = "Zomint is a wealth management app for Indian households. It has 2 lakh users and plans to use the funds for hiring and marketing.";

test("all-10 scores with verified evidence total 100", () => {
  const ai = Object.keys(criteria).map((key) => ({ key, score: 10, evidence: "wealth management app for Indian households", reasoning: "" }));
  assert.equal(weightedTotal(scoreCriteria(ai, criteria, SRC)), 100);
});

test("evidence-or-zero: an unverifiable quote zeroes that criterion", () => {
  const ai = [
    { key: "sector_fit", score: 9, evidence: "wealth management app", reasoning: "" },
    { key: "traction_signals", score: 9, evidence: "10 lakh paying customers", reasoning: "" },
  ];
  const s = scoreCriteria(ai, criteria, SRC);
  assert.equal(s.sector_fit.score, 9);
  assert.equal(s.traction_signals.score, 0);
  assert.equal(s.traction_signals.ai_score, 9);
  assert.equal(s.traction_signals.evidence_verified, false);
});

test("missing criteria score 0; scores are clamped to 0–10", () => {
  const s = scoreCriteria([{ key: "sector_fit", score: 14, evidence: "wealth management app", reasoning: "" }], criteria, SRC);
  assert.equal(s.sector_fit.score, 10);
  assert.equal(s.india_focus.score, 0);
  assert.equal(weightedTotal(s), 35);
});

test("weights come from the thesis: changing a weight changes the total", () => {
  const ai = [{ key: "sector_fit", score: 10, evidence: "wealth management app", reasoning: "" }];
  const a = weightedTotal(scoreCriteria(ai, criteria, SRC));
  const b = weightedTotal(scoreCriteria(ai, { ...criteria, sector_fit: { weight: 70, description: "" } }, SRC));
  assert.ok(b > a);
});

test("threshold and exclusions decide qualification in code", () => {
  assert.equal(decide({ total: 70, threshold: 65, excludedMatch: null }).qualified, true);
  assert.equal(decide({ total: 64.9, threshold: 65, excludedMatch: null }).qualified, false);
  const ex = decide({ total: 95, threshold: 65, excludedMatch: "B2B SaaS" });
  assert.equal(ex.qualified, false);
  assert.deepEqual(ex.gateFailures, ["excluded_sector:B2B SaaS"]);
});

test("website verification needs the startup name on the page or in the domain", () => {
  const page = (url: string, title: string, text = "") => ({ url, title, text, html: "" });
  assert.ok(pageMatchesStartup(page("https://zomint.com", "Zomint – Grow your wealth"), "Zomint"));
  assert.ok(pageMatchesStartup(page("https://thedoughtherapy.in", "Pizza delivery"), "The Dough Therapy"));
  assert.equal(pageMatchesStartup(page("https://example.com", "Best loans online", "We are a lender"), "Credfix"), false);
});

import { reweigh, semanticThesisKey } from "../lib/funding/qualify";

test("threshold/weight-only edits keep the semantic key; criteria wording edits change it", () => {
  const t = { summary: "x", sectors: ["fintech"], excluded_sectors: [], business_models: ["B2C"], criteria: { a: { weight: 10, description: "d" } } };
  assert.equal(semanticThesisKey(t), semanticThesisKey({ ...t, criteria: { a: { weight: 99, description: "d" } } }));
  assert.notEqual(semanticThesisKey(t), semanticThesisKey({ ...t, criteria: { a: { weight: 10, description: "changed" } } }));
  assert.notEqual(semanticThesisKey(t), semanticThesisKey({ ...t, excluded_sectors: ["pet care"] }));
});

test("reweigh applies new weights to existing verified scores", () => {
  const prev = scoreCriteria([{ key: "sector_fit", score: 10, evidence: "wealth management app", reasoning: "" }], criteria, SRC);
  assert.equal(weightedTotal(prev), 35);
  assert.equal(weightedTotal(reweigh(prev, { ...criteria, sector_fit: { weight: 85, description: "" } })), Math.round((85 / 150) * 1000) / 10);
});
