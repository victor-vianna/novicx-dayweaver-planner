import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetDB } from "@/mocks/store";
import { getSessionFor, signInAsDemo, signInWithPassword } from "@/services/auth";

async function settle<T>(promise: Promise<T>) {
  await vi.runAllTimersAsync();
  return promise;
}

describe("auth service", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    resetDB();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("signs in with the correct password", async () => {
    const session = await settle(signInWithPassword("marina@exemplo.com.br", "demo1234"));

    expect(session.profile.id).toBe("u-marina");
    expect(session.client?.id).toBe("c-marina");
  });

  it("normalizes spaces and letter case in the email", async () => {
    const session = await settle(signInWithPassword("  MARINA@EXEMPLO.COM.BR ", "demo1234"));

    expect(session.profile.id).toBe("u-marina");
  });

  it("rejects an incorrect password", async () => {
    const attempt = signInWithPassword("marina@exemplo.com.br", "incorreta");
    const assertion = expect(attempt).rejects.toThrow("E-mail ou senha incorretos.");

    await vi.runAllTimersAsync();
    await assertion;
  });

  it.each([
    ["client" as const, "u-marina"],
    ["admin" as const, "u-admin"],
  ])("signs in to the %s demo", async (role, profileId) => {
    const session = await settle(signInAsDemo(role));

    expect(session.profile.id).toBe(profileId);
    expect(session.profile.role).toBe(role);
  });

  it("rejects an unknown profile", async () => {
    await expect(getSessionFor("u-inexistente")).rejects.toThrow("Conta não encontrada.");
  });
});
