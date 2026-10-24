// `db:test:remote --pending`: runs migrations not yet applied on the remote
// INSIDE each test batch (right after its `begin;`), so the batch's final
// exception rolls them back with everything else. Nothing is recorded in
// supabase_migrations.schema_migrations and no schema change survives.
import { stripSqlLiterals } from "./sql-guard.ts";

export const migrationVersion = (file: string) => file.match(/^(\d+)_/)?.[1] ?? null;

/** Local migration files whose version is not applied remotely, in order. */
export function pendingMigrations(localFiles: string[], applied: Iterable<string>): string[] {
  const done = new Set(applied);
  const local = localFiles.filter((f) => f.endsWith(".sql")).sort();
  for (const f of local) {
    if (migrationVersion(f) === null)
      throw new Error(`${f}: migration name must start with a version.`);
  }
  const pending = local.filter((f) => !done.has(migrationVersion(f)!));
  const lastApplied = [...done].sort().at(-1);
  const early = pending.find((f) => lastApplied && migrationVersion(f)! <= lastApplied);
  if (early) {
    throw new Error(`${early}: pending migration is older than the last applied (${lastApplied}).`);
  }
  return pending;
}

const FORBIDDEN =
  /^(begin|start\s+transaction|commit|end|abort|rollback|savepoint|release|prepare\s+transaction|vacuum|reindex\s+.*concurrently|create\s+(unique\s+)?index\s+concurrently|drop\s+index\s+concurrently|refresh\s+materialized\s+view\s+concurrently|alter\s+system|create\s+database|drop\s+database)\b/;

/** A migration embedded in the test transaction must not end it or need its own. */
export function assertEmbeddable(sql: string, file = "migration"): void {
  const statements = stripSqlLiterals(sql)
    .split(";")
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean);
  for (const statement of statements) {
    if (FORBIDDEN.test(statement)) {
      throw new Error(
        `${file}: cannot run inside the test transaction: "${statement.slice(0, 80)}".`,
      );
    }
  }
}

/** Inserts the pending migrations right after the test file's leading `begin;`. */
export function withPending(testSql: string, migrations: { file: string; sql: string }[]): string {
  if (!migrations.length) return testSql;
  const lead = testSql.match(/^(\s*(?:--[^\n]*\n\s*)*)begin;/i);
  if (!lead) throw new Error('test file must open with "begin;".');
  const injected = migrations
    .map((m) => `-- pending migration (rolled back): ${m.file}\n${m.sql.trim()}\n;`)
    .join("\n");
  return `${lead[0]}\n${injected}\n${testSql.slice(lead[0].length)}`;
}

/** Applied versions from a `supabase db query --linked` JSON answer. */
export function parseAppliedVersions(stdout: string): string[] {
  const start = stdout.indexOf("{");
  if (start === -1) throw new Error("no JSON in db query output");
  const rows = (JSON.parse(stdout.slice(start)) as { rows?: { version?: unknown }[] }).rows;
  if (!Array.isArray(rows)) throw new Error("db query output has no rows");
  return rows.map((r) => String(r.version)).sort();
}
