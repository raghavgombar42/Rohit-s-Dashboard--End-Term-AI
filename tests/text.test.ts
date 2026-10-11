import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalUrl, normalizeCompanyName, stripHtml, stripPublisherSuffix, titleHash } from "../lib/text";

test("canonicalUrl strips tracking params, fragments, www and trailing slash", () => {
  assert.equal(
    canonicalUrl("http://www.Inc42.com/buzz/nat-habit-raises/?utm_source=rss&utm_medium=feed#comments"),
    "https://inc42.com/buzz/nat-habit-raises",
  );
});

test("canonicalUrl keeps meaningful query params", () => {
  assert.equal(canonicalUrl("https://example.com/a?id=42&utm_campaign=x"), "https://example.com/a?id=42");
});

test("canonicalUrl drops the whole query on Google News links", () => {
  assert.equal(
    canonicalUrl("https://news.google.com/rss/articles/CBMiabc?oc=5&hl=en-IN"),
    "https://news.google.com/rss/articles/CBMiabc",
  );
});

test("same headline from two publishers hashes identically", () => {
  assert.equal(titleHash("Nat Habit raises Rs 142 Cr in Series C!"), titleHash("nat habit raises rs 142 cr in series c"));
  assert.notEqual(titleHash("Nat Habit raises Rs 142 Cr"), titleHash("Nat Habit raises Rs 140 Cr"));
});

test("stripPublisherSuffix removes the Google News ' - Publisher' tail only", () => {
  assert.equal(stripPublisherSuffix("Acme raises $2M - Inc42 Media", "Inc42 Media"), "Acme raises $2M");
  assert.equal(stripPublisherSuffix("Acme - the story", "Inc42"), "Acme - the story");
});

test("stripHtml removes tags and scripts and decodes entities", () => {
  assert.equal(stripHtml("<p>Raised &#8377;5 Cr&nbsp;<b>seed</b></p><script>x()</script>"), "Raised ₹5 Cr seed");
});

test("normalizeCompanyName collapses legal suffixes and TLD-style names", () => {
  assert.equal(normalizeCompanyName("Lenskart Solutions Pvt. Ltd."), normalizeCompanyName("Lenskart Solutions"));
  assert.equal(normalizeCompanyName("Zepto.ai"), "zepto");
  assert.notEqual(normalizeCompanyName("Zepto"), normalizeCompanyName("Zeptonow Money"));
});
