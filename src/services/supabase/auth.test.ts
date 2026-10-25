// Suspended accounts (T1/T2): banned in Auth, or blocked in the database
// before the ban lands. Both end in the same pt-BR message and no session.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_SUSPENDED } from "@/lib/access";

const signInWithPassword = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));
let profile: Record<string, unknown> | null = null;

function chain(data: unknown) {
  const c = {
    select: () => c,
    eq: () => c,
    is: () => c,
    maybeSingle: async () => ({ data, error: null }),
  };
  return c;
}

vi.mock("@/integrations/supabase/client", () => ({
  getSupabase: () => ({
    auth: { signInWithPassword, signOut },
    from: (table: string) => chain(table === "profiles" ? profile : null),
  }),
}));

import { signInWithPassword as signIn } from "./auth";

beforeEach(() => {
  signInWithPassword.mockReset();
  signOut.mockClear();
  profile = { id: "u1", role: "client", full_name: "Ana", blocked_at: null };
});

describe("suspended accounts", () => {
  it("maps an Auth ban to the suspended message", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { status: 400, code: "user_banned", message: "User is banned" },
    });
    await expect(signIn("ana@example.com", "x")).rejects.toThrow(ACCESS_SUSPENDED);
  });

  it("refuses a blocked profile even if Auth still lets it in, and signs out", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    profile = { ...profile, blocked_at: "2026-10-25T00:00:00Z" };
    await expect(signIn("ana@example.com", "x")).rejects.toThrow(ACCESS_SUSPENDED);
    expect(signOut).toHaveBeenCalled();
  });

  it("tells an unconfirmed e-mail apart from a wrong password", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { status: 400, code: "email_not_confirmed", message: "Email not confirmed" },
    });
    await expect(signIn("ana@example.com", "x")).rejects.toThrow("Seu acesso ainda não foi confirmado.");
  });

  it("keeps wrong credentials distinct", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { status: 400, code: "invalid_credentials", message: "Invalid" },
    });
    await expect(signIn("ana@example.com", "x")).rejects.toThrow("E-mail ou senha incorretos.");
  });
});
