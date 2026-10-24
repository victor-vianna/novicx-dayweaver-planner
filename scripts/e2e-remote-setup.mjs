// Creates (idempotently) the fictitious accounts used by `npm run test:supabase:remote`
// on the LINKED dev project: one admin and two clients with an active package.
// Ids start with ee2e…, e-mails with e2e-…@example.com, business names with [E2E].
// The password is random, stored only in .env.e2e.local (gitignored), and
// re-applied on every run. Writes only the exact fixture ids (lib/e2e-setup-sql).
// Every guard runs before anything is written.
// Usage: npm run e2e:setup:remote
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  assertDevTarget,
  assertSafePassword,
  DEV_REF,
  E2E_ENV_FILE,
  parseEnv,
} from "./lib/e2e-env.ts";
import { buildSetupSql } from "./lib/e2e-setup-sql.ts";

const ref = readFileSync("supabase/.temp/project-ref", "utf8").trim();
if (ref !== DEV_REF) {
  console.error(`Refusing to run: linked project is ${ref}, expected ${DEV_REF}.`);
  process.exit(1);
}

const env = existsSync(E2E_ENV_FILE) ? parseEnv(readFileSync(E2E_ENV_FILE, "utf8")) : {};
try {
  assertDevTarget(env);
  env.E2E_PASSWORD ??= randomBytes(18).toString("base64url");
  assertSafePassword(env.E2E_PASSWORD);
} catch (error) {
  console.error(`${E2E_ENV_FILE}: ${error.message}`);
  process.exit(1);
}
const sql = buildSetupSql(env.E2E_PASSWORD);

writeFileSync(
  E2E_ENV_FILE,
  Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
);

const tmp = path.join(mkdtempSync(path.join(tmpdir(), "e2e-")), "setup.sql");
writeFileSync(tmp, sql);
let out;
try {
  out = execFileSync("npx", ["supabase", "db", "query", "--linked", "-f", tmp], {
    encoding: "utf8",
    shell: true,
  });
} finally {
  rmSync(path.dirname(tmp), { recursive: true, force: true }); // holds the password
}
console.log(out.slice(out.indexOf("{")));
