// Admin overview in mock mode: the "Clientes ativas" indicator matches the
// data, and the screen survives a reload (sessionStorage, per profile).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthContextValue } from "@/features/auth/auth-context";
import { DEMO_ACCOUNTS } from "@/mocks/seed";
import { getDB, resetDB } from "@/mocks/store";
import type { MockSession } from "@/services/auth";

import { AdminWorkspace } from "./AdminWorkspace";
import { activeClientIds } from "./metrics";
import { readAdminNav } from "./navigation";

vi.mock("@/mocks/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/mocks/store")>()),
  delay: async () => {},
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const ADMIN = DEMO_ACCOUNTS.admin.profileId;

function renderWorkspace() {
  const session = {
    profile: { id: ADMIN, role: "admin", full_name: "Equipe NOVICX" },
    client: null,
  } as unknown as MockSession;
  const auth = { session, startPreview: vi.fn() } as unknown as AuthContextValue;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={qc}>
        <AdminWorkspace />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  resetDB();
  window.sessionStorage.clear();
});

describe("AdminWorkspace", () => {
  it("counts active clients like the database: not archived, with an active package", async () => {
    const db = getDB();
    const withPackage = db.clients.find((c) =>
      db.packages.some((p) => p.client_id === c.id && p.status === "active"),
    )!;
    withPackage.archived_at = new Date().toISOString();
    const expected = activeClientIds(db.clients, db.packages).size;
    expect(expected).toBe(
      new Set(
        db.packages
          .filter((p) => p.status === "active")
          .filter((p) => !db.clients.find((c) => c.id === p.client_id)!.archived_at)
          .map((p) => p.client_id),
      ).size,
    );

    renderWorkspace();
    const label = await screen.findByText("Clientes ativas", { selector: "p" });
    expect(within(label.parentElement!).getByText(String(expected))).toBeInTheDocument();
    expect(screen.queryByText(withPackage.business_name)).toBeNull();
  });

  it("reopens the last screen after a reload", async () => {
    const first = renderWorkspace();
    const nav = await screen.findAllByRole("button", { name: "Planos" });
    fireEvent.click(nav[0]!);
    expect(await screen.findByRole("heading", { name: "Planos", level: 1 })).toBeInTheDocument();
    expect(readAdminNav(ADMIN).view).toBe("plans");
    first.unmount();

    renderWorkspace();
    expect(await screen.findByRole("heading", { name: "Planos", level: 1 })).toBeInTheDocument();
  });

  it("ignores a corrupted saved state", async () => {
    window.sessionStorage.setItem(`novicx-planner:admin-nav:${ADMIN}`, "{not json");
    expect(readAdminNav(ADMIN)).toEqual({ view: "overview", deliveryClientId: null });
    window.sessionStorage.setItem(
      `novicx-planner:admin-nav:${ADMIN}`,
      JSON.stringify({ view: "hack", deliveryClientId: 3 }),
    );
    expect(readAdminNav(ADMIN)).toEqual({ view: "overview", deliveryClientId: null });
    renderWorkspace();
    expect(await screen.findByText("Clientes ativas", { selector: "p" })).toBeInTheDocument();
  });
});
