// Mock-mode account access: same rules as the admin-users function, and a
// suspended account cannot sign in.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_SUSPENDED } from "@/lib/access";
import { DEMO_ACCOUNTS } from "@/mocks/seed";
import { getDB, resetDB } from "@/mocks/store";

import * as accounts from "./mock/accounts";
import { signInWithPassword } from "./mock/auth";

vi.mock("@/mocks/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/mocks/store")>()),
  delay: async () => {},
}));

const marina = () => getDB().clients.find((c) => c.user_id === DEMO_ACCOUNTS.client.profileId)!;

beforeEach(() => resetDB());

describe("mock accounts", () => {
  it("reports active, blocked and missing access", async () => {
    expect(await accounts.getAccess(marina())).toEqual({
      status: "active",
      userId: DEMO_ACCOUNTS.client.profileId,
    });
    await accounts.setAccessBlocked(DEMO_ACCOUNTS.client.profileId, true);
    expect((await accounts.getAccess(marina())).status).toBe("blocked");
    expect(await accounts.getAccess({ user_id: "" })).toEqual({ status: "none", userId: null });
  });

  it("blocks sign-in while suspended and restores it after unblocking", async () => {
    const { email, password, profileId } = DEMO_ACCOUNTS.client;
    await accounts.setAccessBlocked(profileId, true);
    await expect(signInWithPassword(email, password)).rejects.toThrow(ACCESS_SUSPENDED);
    await expect(accounts.resetAccess(profileId)).rejects.toThrow(/Desbloqueie/);
    await accounts.setAccessBlocked(profileId, false);
    expect((await signInWithPassword(email, password)).profile.id).toBe(profileId);
  });

  it("never manages team accounts", async () => {
    await expect(accounts.setAccessBlocked(DEMO_ACCOUNTS.admin.profileId, true)).rejects.toThrow(
      /clientes/,
    );
  });

  it("creates access only for a client without one", async () => {
    await expect(accounts.createAccess(marina().id)).rejects.toThrow(/já tem acesso/);
    const client = marina();
    client.user_id = "";
    const { userId, link } = await accounts.createAccess(client.id);
    expect(getDB().clients.find((c) => c.id === client.id)!.user_id).toBe(userId);
    expect(link).toContain(".invalid");
  });

  it("changes the e-mail, refusing duplicates and invalid values", async () => {
    const other = getDB().clients.find((c) => c.id !== marina().id)!;
    await expect(accounts.changeClientEmail(marina().id, other.email)).rejects.toThrow(/Já existe/);
    await expect(accounts.changeClientEmail(marina().id, "nope")).rejects.toThrow(/inválido/);
    expect((await accounts.changeClientEmail(marina().id, " Nova@Exemplo.com ")).email).toBe(
      "nova@exemplo.com",
    );
  });
});
