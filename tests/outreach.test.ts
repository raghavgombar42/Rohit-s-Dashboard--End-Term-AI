import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEmail, type EmailInput } from "../lib/outreach/email";
import { rankEmails } from "../lib/outreach/contacts";
import { buildMime } from "../lib/gmail";

const input: EmailInput = {
  startup: "Lorazzo",
  founders: [{ name: "Ankit Jain", role: "Founder" }],
  round: { stage: "Seed", amount: "Rs 15 crore", investors: ["Sauce VC"] },
  facts: [{ id: "F1", text: "The brand has grown its revenue six times over the past 12 months" }],
  pitch: "A 12-week program for consumer founders.",
  sender: { name: "Rohit Gupta", title: "Program Recruitment Lead, Tandem Forge Accelerator" },
};
const body = (mid: string) =>
  `Hi Ankit,\n\nCongratulations on Lorazzo's Rs 15 crore seed round led by Sauce VC. ${mid} We run a 12-week program for consumer founders building distribution, and many of the sprints focus on exactly the channel expansion you described in your announcement this week.\n\nWould you be open to a 15-minute call next week?\n\nRohit Gupta\nProgram Recruitment Lead, Tandem Forge Accelerator`;

test("a grounded email passes; 'six times' may be written as 6x", () => {
  assert.deepEqual(validateEmail({ subject: "Lorazzo's seed round", body: body("Growing revenue 6x in 12 months is impressive."), used_fact_ids: ["F1"] }, input), []);
});

test("an invented number is caught", () => {
  const p = validateEmail({ subject: "Lorazzo", body: body("Serving 40,000 customers is impressive."), used_fact_ids: ["F1"] }, input);
  assert.ok(p.some((x) => x.includes("40000") || x.includes("40,000")));
});

test("links, placeholders and unknown fact ids are caught", () => {
  const p = validateEmail({ subject: "Hi", body: body("See https://x.com and [Calendly link]."), used_fact_ids: ["F9"] }, input);
  assert.ok(p.some((x) => x.includes("links")));
  assert.ok(p.some((x) => x.includes("placeholders")));
  assert.ok(p.some((x) => x.includes("used_fact_ids")));
});

test("contacts: only the startup's own domain, founder match first, junk mailboxes excluded", () => {
  const r = rankEmails(["noreply@zomint.com", "hello@zomint.com", "aman@zomint.com", "aman@gmail.com", "careers@zomint.com", "logo@2x.png"], "zomint.com", [{ name: "Aman Mittal" }]);
  assert.deepEqual(r.map((c) => c.email), ["aman@zomint.com", "hello@zomint.com"]);
  assert.equal(r[0].name, "Aman Mittal");
});

test("MIME draft is addressed to the safe-mode inbox and encodes ₹ subjects", () => {
  const raw = Buffer.from(buildMime({ to: "test@example.com", subject: "₹5 Cr seed", body: "Hello", outreachId: 7 }), "base64url").toString();
  assert.match(raw, /^To: test@example.com\r\n/);
  assert.match(raw, /Subject: =\?UTF-8\?B\?/);
  assert.match(raw, /X-Tandem-Forge-Outreach-Id: 7/);
});
