// Account lifecycle through the deployed admin-users function (remote dev only):
// admin gives access → the client sets a password from the link → signs in →
// admin blocks: data disappears at once, refresh and sign-in fail → admin
// unblocks: access is back. Uses the fixed fixture client c3 (e2e:setup:remote);
// the first run creates its account, later runs reuse it via a reset link, so
// nothing accumulates. The frontend cannot delete Auth users (no service_role).
// Run: npm run e2e:setup:remote && npm run test:supabase:remote
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { createClient as createSupabase } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  assertDevTarget,
  assertSafePassword,
  DEV_URL,
  E2E_ENV_FILE,
  parseEnv,
} from "../../../scripts/lib/e2e-env.ts";

const REMOTE = process.env["E2E_TARGET"] === "remote";
const LIFE_CLIENT = "ee2e0000-0000-4000-8000-0000000000c3";
const LIFE_EMAIL = "e2e-life@example.com";

const env = REMOTE ? parseEnv(readFileSync(E2E_ENV_FILE, "utf8")) : {};
if (REMOTE) {
  assertDevTarget(env);
  assertSafePassword(env["E2E_PASSWORD"]);
  vi.stubEnv("VITE_DATA_SOURCE", "supabase");
  vi.stubEnv("VITE_SUPABASE_URL", env["E2E_SUPABASE_URL"]);
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", env["E2E_SUPABASE_PUBLISHABLE_KEY"]);
}

const auth = await import("./auth");
const clients = await import("./clients");
const accounts = await import("./accounts");

/** A separate client for the end user, so admin and client sessions never mix. */
const userClient = () =>
  createSupabase(env["E2E_SUPABASE_URL"] ?? "", env["E2E_SUPABASE_PUBLISHABLE_KEY"] ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

let userId = "";

describe.skipIf(!REMOTE)("account lifecycle (remote dev)", () => {
  beforeAll(async () => {
    const session = await auth.signInWithPassword("e2e-admin@example.com", env["E2E_PASSWORD"]!);
    expect(session.profile.role).toBe("admin");
  });

  afterAll(async () => {
    // Leave the fixture usable even if a step failed while it was blocked.
    if (userId) await accounts.setAccessBlocked(userId, false).catch(() => {});
    await auth.signOut();
  });

  it("creates or resets access, then blocks and unblocks it", async () => {
    const client = await clients.getClient(LIFE_CLIENT);
    expect(client?.email, "run npm run e2e:setup:remote first").toBe(LIFE_EMAIL);
    const before = await accounts.getAccess(client!);

    let link: string;
    if (before.status === "none") {
      ({ userId, link } = await accounts.createAccess(LIFE_CLIENT));
    } else {
      userId = before.userId!;
      if (before.status === "blocked") await accounts.setAccessBlocked(userId, false);
      link = await accounts.resetAccess(userId);
    }
    expect(link.startsWith(`${DEV_URL}/auth/v1/verify?`)).toBe(true);

    // Opening the link: Auth redirects with a recovery session in the fragment.
    const res = await fetch(link, { redirect: "manual" });
    expect([302, 303]).toContain(res.status);
    const fragment = new URLSearchParams(new URL(res.headers.get("location")!).hash.slice(1));
    expect(fragment.get("type")).toBe("recovery");

    const user = userClient();
    const set = await user.auth.setSession({
      access_token: fragment.get("access_token")!,
      refresh_token: fragment.get("refresh_token")!,
    });
    expect(set.error).toBeNull();
    const password = randomBytes(18).toString("base64url");
    expect((await user.auth.updateUser({ password })).error).toBeNull();

    const signIn = () => user.auth.signInWithPassword({ email: LIFE_EMAIL, password });
    expect((await signIn()).error).toBeNull();
    const own = async () => (await user.from("clients").select("id")).data?.map((r) => r.id);
    expect(await own()).toEqual([LIFE_CLIENT]);

    await accounts.setAccessBlocked(userId, true);
    expect((await accounts.getAccess(client!)).status).toBe("blocked");
    // The access token is still valid, but RLS already denies everything.
    expect(await own()).toEqual([]);
    expect((await user.auth.refreshSession()).error).not.toBeNull();
    expect((await signIn()).error?.code).toBe("user_banned");
    await expect(accounts.resetAccess(userId)).rejects.toThrow(/Desbloqueie/);

    await accounts.setAccessBlocked(userId, false);
    expect((await signIn()).error).toBeNull();
    expect(await own()).toEqual([LIFE_CLIENT]);
    await user.auth.signOut({ scope: "local" });
  });

  it("refuses non-admin callers", async () => {
    const user = userClient();
    await user.auth.signInWithPassword({
      email: "e2e-a@example.com",
      password: env["E2E_PASSWORD"]!,
    });
    const { error } = await user.functions.invoke("admin-users", {
      body: { action: "set_access", user_id: userId || LIFE_CLIENT, blocked: true },
    });
    expect((error as { context?: Response } | null)?.context?.status).toBe(403);
    await user.auth.signOut({ scope: "local" });
    const anon = await userClient().functions.invoke("admin-users", { body: {} });
    expect((anon.error as { context?: Response } | null)?.context?.status).toBe(401);
  });
});
