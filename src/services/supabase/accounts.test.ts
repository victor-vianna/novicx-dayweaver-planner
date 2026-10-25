// Requests to the admin-users function and how its errors reach the UI.
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  getSupabase: () => ({ functions: { invoke } }),
}));

import { createAccess, resetAccess, setAccessBlocked } from "./accounts";

beforeEach(() => invoke.mockReset());

describe("supabase accounts", () => {
  it("sends the action, ids and the password-setup redirect", async () => {
    invoke.mockResolvedValue({ data: { user_id: "u1", action_link: "https://link" }, error: null });
    expect(await createAccess("c1")).toEqual({ userId: "u1", link: "https://link" });
    expect(invoke).toHaveBeenCalledWith("admin-users", {
      body: {
        action: "create_account",
        client_id: "c1",
        redirect_to: `${window.location.origin}/?redefinir-senha=1`,
      },
    });
  });

  it("shows the function's pt-BR message", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ error: "Conta não encontrada." })) },
    });
    await expect(setAccessBlocked("u1", true)).rejects.toThrow("Conta não encontrada.");
  });

  it("falls back to a generic message without a JSON body", async () => {
    invoke.mockResolvedValue({ data: null, error: { context: undefined } });
    await expect(resetAccess("u1")).rejects.toThrow("Não foi possível concluir a operação.");
  });
});
