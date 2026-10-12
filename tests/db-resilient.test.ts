import { test } from "node:test";
import assert from "node:assert/strict";
import { resilient } from "../lib/db";

// resilient() opens a request-scoped client; it never connects unless a query runs, so a dummy URL is fine.
process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/none";

test("a hung load is abandoned after the deadline and retried once", async () => {
  let calls = 0;
  const started = Date.now();
  const result = await resilient(() => {
    calls++;
    return calls === 1 ? new Promise<string>(() => {}) : Promise.resolve("fresh pool answer");
  }, 200);
  assert.equal(result, "fresh pool answer");
  assert.equal(calls, 2);
  assert.ok(Date.now() - started < 1500);
});

test("a statement-timeout error (57014) is retried; a normal SQL error is not", async () => {
  let n = 0;
  const ok = await resilient(() => (++n === 1 ? Promise.reject(Object.assign(new Error("timeout"), { code: "57014" })) : Promise.resolve(42)), 200);
  assert.equal(ok, 42);
  let m = 0;
  await assert.rejects(resilient(() => { m++; return Promise.reject(Object.assign(new Error("syntax"), { code: "42601" })); }, 200));
  assert.equal(m, 1);
});

test("gives up after one retry instead of hanging", async () => {
  await assert.rejects(resilient(() => new Promise(() => {}), 100), /did not answer/);
});
