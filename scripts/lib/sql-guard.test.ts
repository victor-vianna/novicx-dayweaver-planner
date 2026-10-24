import { readFileSync, readdirSync } from "node:fs";

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
