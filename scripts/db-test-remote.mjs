// Runs the pgTAP files in supabase/tests against the LINKED dev project
// without Docker (`supabase test db` needs a container for pg_prove).
// Each file runs as one batch through `supabase db query --linked`; its final
// `finish(); rollback;` is replaced by a block that always raises, so the batch
// aborts and nothing (fixtures, pgtap extension) is ever committed. Files must
// open with `begin;` and hold no other transaction control (sql-guard). The raised
// message carries the TAP results, parsed here.
// --pending: migrations not yet applied remotely run inside each batch, right
// after its `begin;` (lib/pending.ts), so they are tested and rolled back too.
// The applied list is compared before/after; any change fails the run.
// Usage: npm run db:test:remote [-- --pending]
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  assertEmbeddable,
  parseAppliedVersions,
  pendingMigrations,
  withPending,
} from "./lib/pending.ts";
import { assertSingleTransaction } from "./lib/sql-guard.ts";

const EXPECTED_REF = "smhrcfiwpqhumdclzdre";
const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();
if (ref !== EXPECTED_REF) {
  console.error(`Refusing to run: linked project is ${ref}, expected ${EXPECTED_REF}.`);
  process.exit(1);
}

const MARK = "__TAP_RESULTS__";
const tail = `
do $tap$
declare r text; v text;
begin
  -- pgTAP 1.3 keeps only counters (__tcache__ + __tresults___numb_seq), and
  -- finish() drops them, so read them first.
  select '# ran: ' || currval('__tresults___numb_seq')
      || E'\\n# planned: ' || coalesce((select value from __tcache__ where label = 'plan' limit 1), -1)
      || E'\\n# failed: ' || coalesce((select sum(value) from __tcache__ where label = 'failed'), 0)
    into r;
  select string_agg(coalesce(f, ''), E'\\n') into v from finish() f;
  raise exception '${MARK}%${MARK}', r || E'\\n' || coalesce(v, '');
end
$tap$;
`;

const dir = mkdtempSync(path.join(tmpdir(), "pgtap-"));

const query = (file) => {
  try {
    return execFileSync("npx", ["supabase", "db", "query", "--linked", "-f", file], {
      encoding: "utf8",
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    return `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
};
const appliedFile = path.join(dir, "applied.sql");
writeFileSync(
  appliedFile,
  "select version from supabase_migrations.schema_migrations order by version;",
);
const appliedNow = () => parseAppliedVersions(query(appliedFile));

const withPendingFlag = process.argv.includes("--pending");
const appliedBefore = withPendingFlag ? appliedNow() : [];
const pending = withPendingFlag
  ? pendingMigrations(readdirSync("supabase/migrations"), appliedBefore).map((file) => {
      const sql = readFileSync(path.join("supabase/migrations", file), "utf8");
      assertEmbeddable(sql, file);
      return { file, sql };
    })
  : [];
if (withPendingFlag) {
  console.log(
    `pending migrations (run inside each batch, rolled back): ${pending.map((m) => m.file).join(", ") || "none"}`,
  );
}
const files = readdirSync("supabase/tests")
  .filter((f) => f.endsWith(".test.sql"))
  .sort();
let failed = 0;

for (const file of files) {
  const sql = readFileSync(path.join("supabase/tests", file), "utf8");
  const end = /select \* from finish\(\);\s*rollback;\s*$/;
  if (!end.test(sql)) throw new Error(`${file}: expected to end with finish(); rollback;`);
  assertSingleTransaction(sql.replace(end, ""), file);
  const tmp = path.join(dir, file);
  writeFileSync(tmp, withPending(sql.replace(end, tail), pending));

  const out = query(tmp);
  const m = out.match(new RegExp(`${MARK}([\\s\\S]*?)${MARK}`));
  if (!m) {
    failed++;
    console.log(`✗ ${file}: no TAP output (batch failed before the end)\n${out}`);
    continue;
  }
  const tap = m[1].replace(/\\n/g, "\n").trim();
  const count = (key) => Number(tap.match(new RegExp(`# ${key}: (-?\\d+)`))?.[1]);
  const [ran, planned, bad] = [count("ran"), count("planned"), count("failed")];
  const pass = bad === 0 && ran === planned;
  if (!pass) failed++;
  console.log(`${pass ? "✓" : "✗"} ${file}: ${ran - bad}/${planned} ok`);
  if (!pass) console.log(tap);
}

if (withPendingFlag) {
  const after = appliedNow();
  if (after.join() !== appliedBefore.join()) {
    failed++;
    console.log(`✗ applied migrations changed during the run: ${appliedBefore} → ${after}`);
  } else {
    console.log(`✓ applied migrations unchanged (${after.length}): ${after.at(-1)}`);
  }
}

process.exit(failed ? 1 : 0);
