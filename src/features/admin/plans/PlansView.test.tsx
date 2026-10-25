// Plans screen in mock mode: create, edit and pause a plan; validation errors
// are announced; contracted packages keep their snapshot.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDB, resetDB } from "@/mocks/store";

import { PlansView } from "./PlansView";

vi.mock("@/mocks/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/mocks/store")>()),
  delay: async () => {},
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PlansView />
    </QueryClientProvider>,
  );
}

beforeEach(() => resetDB());

describe("PlansView", () => {
  it("creates a plan", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /Novo plano/ }));
    const form = screen.getByRole("form", { name: "Novo plano" });
    fireEvent.change(within(form).getByLabelText("Nome"), { target: { value: "Teste 6" } });
    fireEvent.change(within(form).getByLabelText(/Publicações por período/), {
      target: { value: "6" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Criar plano" }));
    expect(await screen.findByRole("heading", { name: "Teste 6" })).toBeInTheDocument();
    expect(getDB().plans.some((p) => p.name === "Teste 6" && p.posts_per_period === 6)).toBe(true);
  });

  it("announces validation errors without saving", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /Novo plano/ }));
    const form = screen.getByRole("form", { name: "Novo plano" });
    fireEvent.change(within(form).getByLabelText("Nome"), { target: { value: "X" } });
    fireEvent.change(within(form).getByLabelText(/Horários/), { target: { value: "9h" } });
    const count = getDB().plans.length;
    fireEvent.click(within(form).getByRole("button", { name: "Criar plano" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent(/HH:mm/);
    expect(getDB().plans).toHaveLength(count);
  });

  it("pauses a plan without touching contracted packages", async () => {
    const plan = getDB().plans.find((p) => p.active)!;
    const packages = JSON.stringify(getDB().packages);
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: `Editar ${plan.name}` }));
    const form = screen.getByRole("form", { name: `Editar ${plan.name}` });
    expect(within(form).getByText(/Pacotes já contratados mantêm/)).toBeInTheDocument();
    fireEvent.click(within(form).getByLabelText(/Disponível para novas contratações/));
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));
    await screen.findByRole("button", { name: /Novo plano/ });
    expect(getDB().plans.find((p) => p.id === plan.id)!.active).toBe(false);
    expect(JSON.stringify(getDB().packages)).toBe(packages);
  });
});
