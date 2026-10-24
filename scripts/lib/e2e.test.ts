import { assertDevTarget, assertSafePassword, DEV_URL, E2E_USER_IDS, parseEnv } from "./e2e-env.ts";
import { buildSetupSql } from "./e2e-setup-sql.ts";

const PASSWORD = "Abcdefgh_12345678-xyz";

describe("E2E guards", () => {
  it("accepts only the dev URL with a publishable key", () => {
    const ok = { E2E_SUPABASE_URL: DEV_URL, E2E_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x" };
    expect(() => assertDevTarget(ok)).not.toThrow();
    expect(() => assertDevTarget({ ...ok, E2E_SUPABASE_URL: "https://other.supabase.co" })).toThrow(
      /Refusing/,
    );
    expect(() => assertDevTarget({ ...ok, E2E_SUPABASE_PUBLISHABLE_KEY: "sb_secret_x" })).toThrow(
      /publishable/,
    );
    expect(() => assertDevTarget({})).toThrow();
  });

  it("refuses passwords that could break out of the SQL literal", () => {
    expect(() => assertSafePassword(PASSWORD)).not.toThrow();
    for (const bad of [
      "",
      "short",
      "abc'); drop table x; --aaaaaaa",
      "a".repeat(15),
      "ção" + "a".repeat(20),
    ]) {
      expect(() => assertSafePassword(bad)).toThrow();
    }
    expect(() => buildSetupSql("x'||pg_sleep(1)||'aaaaaaaaaa")).toThrow();
  });

  it("parses quoted and unquoted values", () => {
    expect(parseEnv('A=1\r\nB="two"\n# c\n')).toEqual({ A: "1", B: "two" });
  });
});

describe("setup SQL", () => {
  const sql = buildSetupSql(PASSWORD);

  it("keys every write by exact fixture ids, never by a prefix", () => {
    expect(sql).not.toMatch(/like\s+'ee2e/i);
    expect(sql).toMatch(/where u\.id = any\(v_ids\)/);
    for (const id of E2E_USER_IDS) expect(sql).toContain(`'${id}'`);
  });

  it("would not touch a fourth user that shares the prefix", () => {
    const fourth = "ee2e0000-0000-4000-8000-0000000000a9";
    expect(sql).not.toContain(fourth);
    const ids = sql.match(/v_ids uuid\[\] := array\[(.*?)\]/)?.[1] ?? "";
    expect(ids.split(",").map((s) => s.trim().replace(/'/g, ""))).toEqual([...E2E_USER_IDS]);
  });
});
