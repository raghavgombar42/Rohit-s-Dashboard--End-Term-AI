// Live DB check of constraint-level guarantees. Runs in a transaction that is always rolled back.
// Usage: npx tsx --env-file=.env.local tests/db-guarantees.check.mts
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, onnotice: () => {} });
const results: [string, boolean, string?][] = [];
async function expectFail(name: string, fn: () => Promise<unknown>, tx: postgres.TransactionSql) {
  await tx`savepoint sp`;
  try { await fn(); results.push([name, false, "did not fail"]); }
  catch (e) { results.push([name, true, (e as Error).message.slice(0, 90)]); await tx`rollback to savepoint sp`; }
}
class Rollback extends Error {}
try {
  await sql.begin(async (tx) => {
    const [t0] = await tx`select version from thesis where id = 1`;
    await tx`update thesis set threshold = 70 where id = 1`;
    const [t1] = await tx`select version from thesis where id = 1`;
    const [snap] = await tx`select snapshot->>'threshold' as th from thesis_versions where version = ${t1.version}`;
    results.push(["thesis edit bumps version + snapshots", t1.version === t0.version + 1 && snap?.th === "70", `v${t0.version}→v${t1.version}`]);
    await tx`update thesis set threshold = 70 where id = 1`;
    const [t2] = await tx`select version from thesis where id = 1`;
    results.push(["no-op edit keeps version", t2.version === t1.version]);
    await expectFail("bad criteria JSON rejected", () => tx`update thesis set criteria = '{"x": {"weight": "high"}}' where id = 1`, tx);
    await expectFail("empty stages rejected", () => tx`update thesis set stages = '{}' where id = 1`, tx);
    await expectFail("thesis delete blocked", () => tx`delete from thesis where id = 1`, tx);

    const [run] = await tx`insert into pipeline_runs (trigger) values ('test') returning id`;
    await expectFail("second concurrent run blocked (run lock)", () => tx`insert into pipeline_runs (trigger) values ('test')`, tx);

    await tx`insert into articles (source_id, url, url_canonical, title, title_hash, run_id) values ('inc42','u','test://a1','t','h',${run.id})`;
    await expectFail("duplicate article URL blocked", () => tx`insert into articles (source_id, url, url_canonical, title, title_hash) values ('inc42','u','test://a1','t','h')`, tx);

    const [s] = await tx`insert into startups (name, name_normalized, domain) values ('TestCo','testco','testco.test') returning id`;
    await expectFail("duplicate startup domain blocked", () => tx`insert into startups (name, name_normalized, domain) values ('Test Co Pvt Ltd','testco','testco.test')`, tx);
    const [r] = await tx`insert into funding_rounds (startup_id, stage, announced_on, date_source, recency_lane) values (${s.id},'seed','2026-10-12','stated_in_article','fresh') returning id`;
    await expectFail("same round same week blocked", () => tx`insert into funding_rounds (startup_id, stage, announced_on, date_source, recency_lane) values (${s.id},'seed','2026-10-13','stated_in_article','fresh')`, tx);
    const [a] = await tx`insert into assessments (round_id, thesis_version, qualified) values (${r.id}, ${t1.version}, true) returning id`;
    const ins = () => tx`insert into outreach (startup_id, round_id, assessment_id, sent_to, subject, body, status) values (${s.id},${r.id},${a.id},'x@test','s','b','sent')`;
    await ins();
    await expectFail("second outreach to contacted startup blocked", ins, tx);
    throw new Rollback();
  });
} catch (e) { if (!(e instanceof Rollback)) throw e; }
finally { await sql.end(); }
let ok = true;
for (const [n, pass, d] of results) { ok &&= pass; console.log(`${pass ? "PASS" : "FAIL"}  ${n}${d ? `  — ${d}` : ""}`); }
process.exitCode = ok ? 0 : 1;
