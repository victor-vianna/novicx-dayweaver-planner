import { readFileSync, readdirSync } from "node:fs";

import { assertEmbeddable } from "./pending.ts";
import { assertSingleTransaction, stripSqlLiterals } from "./sql-guard.ts";

const END = /select \* from finish\(\);\s*rollback;\s*$/;

describe("assertSingleTransaction", () => {
  it("accepts every current test file", () => {
    for (const file of readdirSync("supabase/tests").filter((f) => f.endsWith(".test.sql"))) {
      const sql = readFileSync(`supabase/tests/${file}`, "utf8");
      expect(() => assertSingleTransaction(sql.replace(END, ""), file)).not.toThrow();
    }
  });

  it("rejects writes before begin", () => {
    expect(() => assertSingleTransaction("insert into t values (1);\nbegin;\nselect 1;")).toThrow(
      /first statement/,
    );
  });

  it("rejects an intermediate commit", () => {
    expect(() =>
      assertSingleTransaction("begin;\ninsert into t values (1);\ncommit;\nselect 1;"),
    ).toThrow(/commit/);
  });

  it.each(["rollback", "end", "begin", "start transaction", "abort", "COMMIT AND CHAIN"])(
    "rejects %s in the middle",
    (stmt) => {
      expect(() => assertSingleTransaction(`begin;\nselect 1;\n${stmt};\nselect 2;`)).toThrow();
    },
  );

  it("allows savepoints and transaction words inside bodies, strings and comments", () => {
    const sql = `-- commit;
begin;
savepoint s1;
rollback to savepoint s1;
release savepoint s1;
select 'commit; rollback;';
/* commit; */
create function pg_temp.f() returns void language plpgsql as $$ begin perform 1; end; $$;
do $x$ begin raise notice 'end'; end $x$;`;
    expect(() => assertSingleTransaction(sql)).not.toThrow();
  });

  it("fails on unterminated literals instead of skipping the rest", () => {
    expect(() => stripSqlLiterals("begin; select 'oops; commit;")).toThrow(/Unterminated/);
    expect(() => stripSqlLiterals("begin; select $$ commit;")).toThrow(/Unterminated/);
  });
});

describe("stripSqlLiterals follows the PostgreSQL lexer", () => {
  // O1-R1-001: each hides a real COMMIT from a naive scanner.
  it.each([
    ["nested block comment", "/* outer /* inner */ */ commit;"],
    ["quoted identifier with --", 'create table "a--"(id int); commit;'],
    ["E-string with escaped quote", "select E'it\\'s'; commit; select '';"],
    ["quoted identifier with /*", 'create table "a/*"(id int); commit; select 1 /* x */;'],
  ])("does not let a %s hide a commit", (_name, sql) => {
    expect(() => assertSingleTransaction(`begin; ${sql}`)).toThrow(/commit/);
    expect(() => assertEmbeddable(`create table leaked(id int); ${sql}`)).toThrow(/cannot run/);
  });

  it.each([
    ["E-string with escaped quote", "select E'a\\'; commit; b';"],
    ["dollar tag with digits", "do $body1$ begin commit; end $body1$;"],
    ["nested comment", "/* a /* commit; */ commit; */ select 1;"],
    ["quoted identifier", 'select 1 as "commit; rollback";'],
    ["positional parameter", "prepare p as select $1::int; deallocate p;"],
  ])("accepts a %s without false positives", (_name, sql) => {
    expect(() => assertSingleTransaction(`begin; ${sql}`)).not.toThrow();
    expect(() => assertEmbeddable(sql)).not.toThrow();
  });

  it("rejects unterminated nested comments and identifiers", () => {
    expect(() => stripSqlLiterals("/* a /* b */ commit;")).toThrow(/Unterminated/);
    expect(() => stripSqlLiterals('select "x; commit;')).toThrow(/Unterminated/);
  });
});
