import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { assertSingleTransaction } from "./sql-guard.ts";
import {
  assertEmbeddable,
  parseAppliedVersions,
  pendingMigrations,
  withPending,
} from "./pending.ts";

const applied = ["20261023120000", "20261023120100"];

describe("pendingMigrations", () => {
  it("returns local migrations not applied, in order", () => {
    expect(
      pendingMigrations(
        ["20261025000000_b.sql", "20261023120000_a.sql", "20261023120100_x.sql", "README.md"],
        applied,
      ),
    ).toEqual(["20261025000000_b.sql"]);
  });
  it("refuses a pending migration older than the last applied one", () => {
    expect(() =>
      pendingMigrations(["20261023120000_a.sql", "20261023110000_old.sql"], applied),
    ).toThrow(/older than the last applied/);
  });
  it("refuses unversioned names", () => {
    expect(() => pendingMigrations(["schema.sql"], [])).toThrow(/version/);
  });
});

describe("assertEmbeddable", () => {
  it("accepts every migration in the repo", () => {
    for (const f of readdirSync("supabase/migrations")) {
      expect(() =>
        assertEmbeddable(readFileSync(`supabase/migrations/${f}`, "utf8"), f),
      ).not.toThrow();
    }
  });
  it.each([
    "commit;",
    "begin;",
    "rollback;",
    "create index concurrently i on t (c);",
    "create unique index concurrently i on t (c);",
    "vacuum t;",
  ])("refuses %s", (sql) => {
    expect(() => assertEmbeddable(`create table t (c int);\n${sql}`)).toThrow(/cannot run/);
  });
  it("ignores keywords inside function bodies and strings", () => {
    expect(() =>
      assertEmbeddable(
        "create function f() returns void language plpgsql as $$ begin commit; end $$;\nselect 'commit;';",
      ),
    ).not.toThrow();
  });
});

describe("withPending", () => {
  const test =
    "-- header\nbegin;\nselect plan(1);\nselect ok(true);\nselect * from finish();\nrollback;\n";
  it("injects migrations after the leading begin and keeps a single transaction", () => {
    const out = withPending(test, [{ file: "20261025_x.sql", sql: "create table x (id int);" }]);
    expect(out.indexOf("create table x")).toBeGreaterThan(out.indexOf("begin;"));
    expect(out.indexOf("create table x")).toBeLessThan(out.indexOf("select plan"));
    expect(() =>
      assertSingleTransaction(out.replace(/select \* from finish\(\);\s*rollback;\s*$/, "")),
    ).not.toThrow();
  });
  it("is a no-op without pending migrations", () => {
    expect(withPending(test, [])).toBe(test);
  });
  it("requires the leading begin", () => {
    expect(() => withPending("select 1;", [{ file: "m.sql", sql: "select 1;" }])).toThrow(/begin/);
  });
});

describe("parseAppliedVersions", () => {
  it("reads versions from the db query JSON", () => {
    const out =
      'Initialising...\n{"rows":[{"version":"20261023120100"},{"version":"20261023120000"}]}';
    expect(parseAppliedVersions(out)).toEqual(["20261023120000", "20261023120100"]);
  });
  it("fails without rows", () => {
    expect(() => parseAppliedVersions("error")).toThrow();
  });
});
