import { test } from "node:test";
import assert from "node:assert/strict";
import { applyGates, domainOf, quoteFound, verifyRound, type VerifiedRound } from "../lib/funding/verify";
import type { ExtractedRound } from "../lib/funding/schema";

const SOURCE = `Bengaluru-based fintech startup PaySetu has raised Rs 12 Cr in its seed round led by Blume Ventures,
with participation from Titan Capital. The round was announced on October 11, 2026. Founded by Asha Rao and Vikram Iyer,
PaySetu (paysetu.in) builds UPI credit tools. PaySetu had earlier raised a pre-seed round in 2024.`;

const base: ExtractedRound = {
  startup_name: "PaySetu",
  startup_quote: "PaySetu has raised Rs 12 Cr in its seed round",
  one_liner: "UPI credit tools",
  sector_hint: "fintech",
  website: "paysetu.in",
  hq_city: "Bengaluru",
  country: "India",
  country_basis: "inferred_from_city",
  stage: "seed",
  stage_quote: "raised Rs 12 Cr in its seed round",
  amount_text: "Rs 12 Cr",
  amount_value: 120000000,
  currency: "INR",
  amount_quote: "raised Rs 12 Cr",
  announced_date: "2026-10-11",
  date_quote: "announced on October 11, 2026",
  is_new_announcement: true,
  investors: ["Blume Ventures", "Titan Capital"],
  founders: [{ name: "Asha Rao", role: null }, { name: "Vikram Iyer", role: null }],
  founders_quote: "Founded by Asha Rao and Vikram Iyer",
};

const thesis = { stages: ["pre_seed", "seed", "angel"], geographies: ["India"], fresh_window_hours: 24, late_catch_days: 30 };
const at = (iso: string) => new Date(iso);

test("quoteFound tolerates whitespace, case and curly quotes, rejects paraphrase", () => {
  assert.ok(quoteFound("paysetu HAS raised  Rs 12 Cr", SOURCE));
  assert.ok(quoteFound("PaySetu has raised ... led by Blume Ventures", SOURCE));
  assert.equal(quoteFound("PaySetu secured ₹12 crore", SOURCE), false);
  assert.equal(quoteFound("seed", SOURCE), false, "too short to be evidence");
});

test("fully supported extraction passes verification untouched", () => {
  const v = verifyRound(base, SOURCE)!;
  assert.equal(v.notes.length, 0);
  assert.equal(v.stage, "seed");
  assert.equal(v.founders.length, 2);
});

test("hallucinated founder, investor and website are stripped", () => {
  const v = verifyRound({ ...base, founders: [...base.founders, { name: "Rahul Mehta", role: "CTO" }], investors: [...base.investors, "Sequoia"], website: "paysetu.com" }, SOURCE)!;
  assert.deepEqual(v.founders.map((f) => f.name), ["Asha Rao", "Vikram Iyer"]);
  assert.deepEqual(v.investors, ["Blume Ventures", "Titan Capital"]);
  assert.equal(v.website, null);
});

test("stage claim without a matching quote is downgraded to undisclosed", () => {
  const v = verifyRound({ ...base, stage: "pre_seed", stage_quote: "raised Rs 12 Cr in its seed round" }, SOURCE)!;
  assert.equal(v.stage, "undisclosed");
});

test("startup not in the text → whole round rejected", () => {
  assert.equal(verifyRound({ ...base, startup_name: "Zepto", startup_quote: "Zepto has raised Rs 12 Cr" }, SOURCE), null);
});

test("unsupported date falls back to article time", () => {
  const v = verifyRound({ ...base, announced_date: "2026-10-09", date_quote: "on October 9" }, SOURCE)!;
  assert.equal(v.announced_date, null);
});

const v0 = verifyRound(base, SOURCE) as VerifiedRound;

test("fresh seed round in India passes all gates", () => {
  const g = applyGates({ round: v0, publishedAt: at("2026-10-11T10:00:00+05:30"), discoveredAt: at("2026-10-12T08:00:00+05:30") }, thesis);
  assert.equal(g.pass, true);
  assert.equal(g.lane, "fresh");
});

test("round mentioned only as background is rejected", () => {
  const g = applyGates({ round: { ...v0, is_new_announcement: false }, publishedAt: null, discoveredAt: at("2026-10-12T08:00:00+05:30") }, thesis);
  assert.ok(g.failures.includes("old_round_mentioned_as_background"));
});

test("Series A fails the stage gate", () => {
  const g = applyGates({ round: { ...v0, stage: "series_a" }, publishedAt: null, discoveredAt: at("2026-10-12T08:00:00+05:30") }, thesis);
  assert.ok(g.failures.includes("stage_not_in_thesis:series_a"));
});

test("unlabelled ₹12 Cr (~$1.4M) round is treated as seed; unlabelled $20M is not", () => {
  const small = applyGates({ round: { ...v0, stage: "undisclosed" }, publishedAt: null, discoveredAt: at("2026-10-12T08:00:00+05:30") }, thesis);
  assert.equal(small.stage, "seed");
  assert.equal(small.stageBasis, "inferred_from_amount");
  const big = applyGates({ round: { ...v0, stage: "undisclosed", amount_value: 20_000_000, currency: "USD" }, publishedAt: null, discoveredAt: at("2026-10-12T08:00:00+05:30") }, thesis);
  assert.ok(big.failures.includes("stage_not_in_thesis:undisclosed"));
});

test("late article about a 10-day-old round goes to the late-catch lane; 45 days is stale", () => {
  const late = applyGates({ round: { ...v0, announced_date: "2026-10-01" }, publishedAt: at("2026-10-11T09:00:00Z"), discoveredAt: at("2026-10-11T12:00:00Z") }, thesis);
  assert.equal(late.lane, "late_catch");
  assert.equal(late.pass, true);
  const stale = applyGates({ round: { ...v0, announced_date: "2026-08-27" }, publishedAt: at("2026-10-11T09:00:00Z"), discoveredAt: at("2026-10-11T12:00:00Z") }, thesis);
  assert.equal(stale.pass, false);
  assert.ok(stale.failures[0].startsWith("stale:"));
});

test("without a stated date, the article publish time decides recency (timezone-safe)", () => {
  const g = applyGates({ round: { ...v0, announced_date: null }, publishedAt: at("2026-10-11T20:30:00Z"), discoveredAt: at("2026-10-12T19:00:00Z") }, thesis);
  assert.equal(g.lane, "fresh");
  assert.equal(g.announcedOn, "2026-10-12", "20:30 UTC is 02:00 next day IST");
  assert.equal(g.dateSource, "article_published");
});

test("non-Indian or unknown geography is rejected", () => {
  const us = applyGates({ round: { ...v0, country: "USA", country_basis: "stated" }, publishedAt: null, discoveredAt: new Date() }, thesis);
  assert.ok(us.failures.includes("geography_not_in_thesis:USA"));
  const unk = applyGates({ round: { ...v0, country: null, country_basis: "unknown", currency: "USD", amount_value: 1_000_000 }, publishedAt: null, discoveredAt: new Date() }, thesis);
  assert.ok(unk.failures.includes("geography_unknown"));
});

test("domainOf normalises company sites and ignores publisher/social domains", () => {
  assert.equal(domainOf("https://www.PaySetu.in/about"), "paysetu.in");
  assert.equal(domainOf("paysetu.in"), "paysetu.in");
  assert.equal(domainOf("https://www.linkedin.com/company/paysetu"), null);
  assert.equal(domainOf("https://inc42.com/buzz/x"), null);
});

test("rupee round with no stated country is treated as Indian (recorded as inferred_from_currency)", () => {
  const g = applyGates({ round: { ...v0, country: null, country_basis: "unknown" }, publishedAt: null, discoveredAt: new Date() }, thesis);
  assert.equal(g.failures.includes("geography_unknown"), false);
  assert.equal(g.countryBasis, "inferred_from_currency");
});

test("context-inferred country is accepted", () => {
  const g = applyGates({ round: { ...v0, country: "India", country_basis: "inferred_from_context" }, publishedAt: null, discoveredAt: new Date() }, thesis);
  assert.equal(g.failures.some((f) => f.startsWith("geography")), false);
});

import { quoteSupported } from "../lib/funding/verify";
const LORAZZO = "The brand has grown its revenue six times over the past 12 months and is targeting Rs 100 crore in revenue over the next two years. Bareback Media has recently invested.";

test("near-verbatim: a quote with two words trimmed is supported", () => {
  assert.ok(quoteSupported("The brand has grown its revenue six times over the past 12 months and is targeting Rs 100 crore over the next two years.", LORAZZO));
});

test("near-verbatim: an invented sentence that only shares an opening is rejected", () => {
  const src = "ReFit Global operates across refurbishment, distribution, retail and related consumer services in India.";
  assert.equal(quoteSupported("ReFit Global operates an integrated re-commerce platform offering certified refurbished and pre-owned electronics through omnichannel retail and distribution networks.", src), false);
});

test("near-verbatim: changed numbers fail (Rs 100 crore → Rs 500 crore with other words trimmed)", () => {
  assert.equal(quoteSupported("grown its revenue ten times over the past 24 months and is targeting Rs 500 crore", LORAZZO), false);
});
