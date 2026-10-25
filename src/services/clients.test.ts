// Mock-mode clients: a new client has no account (as in Supabase) until
// createAccess; list, get, update and archive keep working.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDB, resetDB } from "@/mocks/store";

import * as accounts from "./mock/accounts";
import * as clients from "./mock/clients";

vi.mock("@/mocks/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/mocks/store")>()),
  delay: async () => {},
}));

const input = {
  display_name: "Ana",
  business_name: "Ana Studio",
  profession: "Fotógrafa",
  email: " Ana@Studio.com.br ",
  phone: "",
};

beforeEach(() => resetDB());

describe("mock clients", () => {
  it("creates a client without an account", async () => {
    const profiles = getDB().profiles.length;
    const client = await clients.createClient(input);
    expect(client.user_id).toBe("");
    expect(client.archived_at).toBeNull();
    expect(client.email).toBe("ana@studio.com.br");
    expect(getDB().profiles).toHaveLength(profiles);
    expect(await accounts.getAccess(client)).toEqual({ status: "none", userId: null });

    const { userId } = await accounts.createAccess(client.id);
    const stored = (await clients.getClient(client.id))!;
    expect(stored.user_id).toBe(userId);
    expect((await accounts.getAccess(stored)).status).toBe("active");
  });

  it("lists, updates, archives and restores", async () => {
    const client = await clients.createClient(input);
    expect((await clients.listClients()).map((c) => c.id)).toContain(client.id);

    const updated = await clients.updateClient(client.id, { profession: "Designer" });
    expect(updated.profession).toBe("Designer");
    expect(updated.email).toBe("ana@studio.com.br");

    await clients.setClientArchived(client.id, true);
    expect((await clients.listClients()).map((c) => c.id)).not.toContain(client.id);
    const all = await clients.listClients({ includeArchived: true });
    expect(all.find((c) => c.id === client.id)?.archived_at).toEqual(expect.any(String));

    await clients.setClientArchived(client.id, false);
    expect((await clients.listClients()).map((c) => c.id)).toContain(client.id);
  });

  it("rejects unknown ids", async () => {
    expect(await clients.getClient("c-nope")).toBeNull();
    await expect(clients.updateClient("c-nope", { phone: "1" })).rejects.toThrow(
      "Cliente não encontrada",
    );
    await expect(clients.setClientArchived("c-nope", true)).rejects.toThrow(
      "Cliente não encontrada",
    );
  });
});
