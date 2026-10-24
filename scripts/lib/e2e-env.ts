// Shared guards for the remote E2E fixtures: the setup script and the test
// both refuse anything but the dev project, its publishable key and a
// password made only of URL-safe characters (it ends up inside SQL).

export const DEV_REF = "smhrcfiwpqhumdclzdre";
export const DEV_URL = `https://${DEV_REF}.supabase.co`;
export const E2E_ENV_FILE = ".env.e2e.local";

/** The only auth users the setup creates or changes. */
export const E2E_USER_IDS = [
  "ee2e0000-0000-4000-8000-0000000000a0",
  "ee2e0000-0000-4000-8000-0000000000a1",
  "ee2e0000-0000-4000-8000-0000000000a2",
] as const;

const PASSWORD_RE = /^[A-Za-z0-9_-]{16,128}$/;

export function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (m?.[1]) env[m[1]] = m[2] ?? "";
  }
  return env;
}

/** Throws unless URL and key point at the dev project with a publishable key. */
export function assertDevTarget(env: Record<string, string | undefined>): void {
  const url = env["E2E_SUPABASE_URL"];
  if (url !== DEV_URL) throw new Error(`Refusing to run: ${url || "no URL"} is not ${DEV_URL}.`);
  if (!env["E2E_SUPABASE_PUBLISHABLE_KEY"]?.startsWith("sb_publishable_")) {
    throw new Error("E2E_SUPABASE_PUBLISHABLE_KEY must be the publishable key (sb_publishable_…).");
  }
}

/** Throws unless the password is safe to embed in a SQL literal. */
export function assertSafePassword(password: string | undefined): asserts password is string {
  if (!password || !PASSWORD_RE.test(password)) {
    throw new Error("E2E_PASSWORD must be 16–128 characters of A–Z, a–z, 0–9, _ or -.");
  }
}
