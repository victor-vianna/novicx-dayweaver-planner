// X9 — accessibility and phone layout of the admin screens (mock mode):
// named fields and buttons, announced errors, named dialogs that close with
// Esc, and no layout wider than a 375 px screen.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDB, resetDB } from "@/mocks/store";

import { multiColumnGrids, unlabelledFields, unnamedButtons, wideFixedWidths } from "./a11y-checks";
import { ClientsView } from "./clients/ClientsView";
import { ClientDelivery } from "./delivery/ClientDelivery";
import { PlansView } from "./plans/PlansView";

vi.mock("@/mocks/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/mocks/store")>()),
  delay: async () => {},
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

function renderScreen(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

function expectAccessible(root: ParentNode = document.body) {
  expect(unlabelledFields(root).map((el) => el.outerHTML.slice(0, 120))).toEqual([]);
  expect(unnamedButtons(root).map((el) => el.outerHTML.slice(0, 120))).toEqual([]);
  expect(wideFixedWidths(root)).toEqual([]);
  expect(multiColumnGrids(root)).toEqual([]);
}

beforeEach(() => resetDB());

describe("admin a11y (X9)", () => {
  it("Planos: list and form", async () => {
    renderScreen(<PlansView />);
    fireEvent.click(await screen.findByRole("button", { name: /Novo plano/ }));
    const form = screen.getByRole("form", { name: "Novo plano" });
    expectAccessible();
    fireEvent.change(within(form).getByLabelText("Nome"), { target: { value: " " } });
    fireEvent.click(within(form).getByRole("button", { name: "Criar plano" }));
    expect(await within(form).findByRole("alert")).toBeInTheDocument();
  });

  it("Clientes: list, form and client sheet with a named confirmation dialog", async () => {
    const client = getDB().clients.find((c) => !c.archived_at)!;
    renderScreen(<ClientsView onOpenDelivery={vi.fn()} onPreview={vi.fn()} />);
    await screen.findByText(client.business_name);
    expectAccessible();

    fireEvent.click(screen.getByRole("button", { name: /Nova cliente/ }));
    expectAccessible();
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));

    fireEvent.click(screen.getAllByText(client.business_name)[0]!);
    await screen.findByRole("button", { name: /Arquivar/ });
    expectAccessible();
    const trigger = screen.getByRole("button", { name: /Arquivar/ });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleName();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("Entrega: workspace and post editor dialog", async () => {
    const client = getDB().clients.find((c) =>
      getDB().packages.some((p) => p.client_id === c.id && p.status === "active"),
    )!;
    renderScreen(<ClientDelivery clientId={client.id} onBack={vi.fn()} onPreview={vi.fn()} />);
    await screen.findByRole("heading", { name: client.business_name });
    expectAccessible();

    // "Adicionar" creates a post on the selected day and opens its editor.
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName("Editar publicação");
    expectAccessible(dialog);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
