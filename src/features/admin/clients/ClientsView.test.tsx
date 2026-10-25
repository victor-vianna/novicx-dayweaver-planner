// Clients screen in mock mode: create, edit (e-mail via changeClientEmail),
// archive/restore, search and filter, access lifecycle, no delete, 375 px.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDB, resetDB } from "@/mocks/store";
import * as accounts from "@/services/accounts";
import * as clientsService from "@/services/clients";
import * as mockAccounts from "@/services/mock/accounts";

import { ClientsView } from "./ClientsView";

vi.mock("@/mocks/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/mocks/store")>()),
  delay: async () => {},
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/clients", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/services/clients")>();
  return { ...mod, createClient: vi.fn(mod.createClient), updateClient: vi.fn(mod.updateClient) };
});
vi.mock("@/services/accounts", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/services/accounts")>();
  return {
    ...mod,
    changeClientEmail: vi.fn(mod.changeClientEmail),
    createAccess: vi.fn(mod.createAccess),
    resetAccess: vi.fn(mod.resetAccess),
  };
});

/** Supabase can create the account and still return an empty link. */
const createWithoutLink = async (clientId: string) => ({
  ...(await mockAccounts.createAccess(clientId)),
  link: "",
});

const onOpenDelivery = vi.fn();
const onPreview = vi.fn();

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ClientsView onOpenDelivery={onOpenDelivery} onPreview={onPreview} />
    </QueryClientProvider>,
  );
}

const rafael = () => getDB().clients.find((c) => c.id === "c-rafael")!;

async function openSheet(businessName: string) {
  fireEvent.click(await screen.findByRole("button", { name: `Abrir ficha de ${businessName}` }));
  return screen.findByRole("heading", { level: 1, name: businessName });
}

/** Confirms the open AlertDialog. */
async function confirm(label: string) {
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: label }));
}

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  resetDB();
  vi.clearAllMocks();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

describe("ClientsView", () => {
  it("creates a client without access and opens her sheet", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /Nova cliente/ }));
    const form = screen.getByRole("form", { name: "Nova cliente" });
    fireEvent.change(within(form).getByLabelText("Nome de exibição"), {
      target: { value: "Ana" },
    });
    fireEvent.change(within(form).getByLabelText("Nome do negócio"), {
      target: { value: "Ana Studio" },
    });
    fireEvent.change(within(form).getByLabelText("E-mail"), {
      target: { value: " Ana@Studio.com.br " },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Cadastrar cliente" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Ana Studio" })).toBeVisible();
    const created = getDB().clients.find((c) => c.business_name === "Ana Studio")!;
    expect(created).toMatchObject({ email: "ana@studio.com.br", user_id: "", archived_at: null });
    const access = screen.getByRole("region", { name: "Acesso ao portal" });
    expect(await within(access).findByText("Sem acesso")).toBeInTheDocument();
  });

  it("announces validation errors without calling the service", async () => {
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /Nova cliente/ }));
    const form = screen.getByRole("form", { name: "Nova cliente" });
    fireEvent.change(within(form).getByLabelText("Nome de exibição"), {
      target: { value: "   " },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Cadastrar cliente" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("nome de exibição");

    fireEvent.change(within(form).getByLabelText("Nome de exibição"), {
      target: { value: "Ana" },
    });
    fireEvent.change(within(form).getByLabelText("Nome do negócio"), {
      target: { value: "Ana Studio" },
    });
    fireEvent.change(within(form).getByLabelText("E-mail"), { target: { value: "ana@" } });
    fireEvent.click(within(form).getByRole("button", { name: "Cadastrar cliente" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("E-mail inválido");
    expect(clientsService.createClient).not.toHaveBeenCalled();
    expect(getDB().clients).toHaveLength(4);
  });

  it("edits data and changes the e-mail through changeClientEmail", async () => {
    renderView();
    await openSheet("RM Treinamento");
    fireEvent.click(screen.getByRole("button", { name: "Editar dados de RM Treinamento" }));
    const form = screen.getByRole("form", { name: "Editar RM Treinamento" });
    fireEvent.change(within(form).getByLabelText("Profissão"), {
      target: { value: "Treinador" },
    });
    fireEvent.change(within(form).getByLabelText("E-mail"), {
      target: { value: "Novo@RM.com.br" },
    });
    expect(within(form).getByText(/passa a entrar com o novo e-mail/)).toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(rafael().email).toBe("novo@rm.com.br"));
    expect(rafael().profession).toBe("Treinador");
    expect(accounts.changeClientEmail).toHaveBeenCalledWith("c-rafael", "novo@rm.com.br");
    expect(clientsService.updateClient).toHaveBeenCalledWith(
      "c-rafael",
      expect.not.objectContaining({ email: expect.anything() }),
    );
    expect(await screen.findByText("novo@rm.com.br")).toBeInTheDocument();
  });

  it("shows the service error when the e-mail is taken", async () => {
    const { toast } = await import("sonner");
    renderView();
    await openSheet("RM Treinamento");
    fireEvent.click(screen.getByRole("button", { name: "Editar dados de RM Treinamento" }));
    const form = screen.getByRole("form", { name: "Editar RM Treinamento" });
    fireEvent.change(within(form).getByLabelText("E-mail"), {
      target: { value: "helena@pradoadvocacia.com.br" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Já existe uma cliente com este e-mail."),
    );
    expect(rafael().email).toBe("rafael@rmtreinamento.com.br");
  });

  it("archives and restores with confirmation; archived stay out of the default list", async () => {
    renderView();
    await openSheet("RM Treinamento");
    expect(await screen.findByText(/Arquivar não suspende o acesso/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Arquivar" }));
    await confirm("Arquivar cliente");
    await waitFor(() => expect(rafael().archived_at).not.toBeNull());
    // Archiving keeps the account active.
    expect((await accounts.getAccess(rafael())).status).toBe("active");

    fireEvent.click(await screen.findByRole("button", { name: "Voltar para clientes" }));
    await screen.findByRole("button", { name: "Abrir ficha de Marina Alves" });
    expect(screen.queryByRole("button", { name: "Abrir ficha de RM Treinamento" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Arquivadas" }));
    expect(screen.getByRole("button", { name: "Arquivadas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Abrir ficha de Marina Alves" })).toBeNull();
    await openSheet("RM Treinamento");
    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
    await confirm("Restaurar cliente");
    await waitFor(() => expect(rafael().archived_at).toBeNull());
  });

  it("searches by name and e-mail, ignoring case and accents", async () => {
    renderView();
    const search = await screen.findByLabelText("Buscar cliente por nome ou e-mail");
    await screen.findByRole("button", { name: "Abrir ficha de Marina Alves" });
    fireEvent.change(search, { target: { value: "PRADOADVOCACIA" } });
    expect(screen.getAllByRole("button", { name: /Abrir ficha de/ })).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Abrir ficha de Prado Advocacia de Família" }),
    ).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "familia" } });
    expect(screen.getAllByRole("button", { name: /Abrir ficha de/ })).toHaveLength(1);
    fireEvent.change(search, { target: { value: "rafael" } });
    expect(
      screen.getByRole("button", { name: "Abrir ficha de RM Treinamento" }),
    ).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "ninguém" } });
    expect(screen.getByText("Nenhuma cliente encontrada")).toBeInTheDocument();
  });

  it("creates, copies, suspends and reactivates access; the link is never logged", async () => {
    const logs = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m),
    );
    getDB().clients.find((c) => c.id === "c-camila")!.user_id = "";
    renderView();
    await openSheet("Camila Reis Consultoria");
    const access = screen.getByRole("region", { name: "Acesso ao portal" });
    fireEvent.click(await within(access).findByRole("button", { name: "Criar acesso" }));

    const linkInput = await within(access).findByLabelText("Link de acesso");
    const link = (linkInput as HTMLInputElement).value;
    expect(link).toMatch(/^https:\/\//);
    expect(linkInput).toHaveAttribute("readonly");
    expect(await within(access).findByText("Ativo")).toBeInTheDocument();
    fireEvent.click(within(access).getByRole("button", { name: "Copiar" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(link));
    expect(await within(access).findByText("Link copiado.")).toBeInTheDocument();

    fireEvent.click(within(access).getByRole("button", { name: "Suspender" }));
    await confirm("Suspender acesso");
    expect(await within(access).findByText("Suspenso")).toBeInTheDocument();
    expect(within(access).queryByRole("button", { name: "Gerar novo link" })).toBeNull();
    expect(within(access).queryByLabelText("Link de acesso")).toBeNull();

    fireEvent.click(within(access).getByRole("button", { name: "Reativar" }));
    await confirm("Reativar acesso");
    expect(await within(access).findByText("Ativo")).toBeInTheDocument();
    fireEvent.click(within(access).getByRole("button", { name: "Gerar novo link" }));
    expect(await within(access).findByLabelText("Link de acesso")).toHaveValue(link);

    const { toast } = await import("sonner");
    const toasted = JSON.stringify([
      vi.mocked(toast.success).mock.calls,
      vi.mocked(toast.error).mock.calls,
    ]);
    expect(toasted).not.toContain(link);
    for (const spy of logs) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(link);
      spy.mockRestore();
    }
  });

  it("asks for a new link when createAccess returns an empty one", async () => {
    const { toast } = await import("sonner");
    vi.mocked(accounts.createAccess).mockImplementationOnce(createWithoutLink);
    getDB().clients.find((c) => c.id === "c-camila")!.user_id = "";
    renderView();
    await openSheet("Camila Reis Consultoria");
    const access = screen.getByRole("region", { name: "Acesso ao portal" });
    fireEvent.click(await within(access).findByRole("button", { name: "Criar acesso" }));

    const input = await within(access).findByLabelText("Link de acesso");
    const userId = getDB().clients.find((c) => c.id === "c-camila")!.user_id;
    expect(userId).not.toBe("");
    expect(accounts.resetAccess).toHaveBeenCalledWith(userId);
    expect((input as HTMLInputElement).value).toMatch(/^https:\/\//);
    expect(await within(access).findByText("Ativo")).toBeInTheDocument();
    expect(within(access).queryByRole("alert")).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("Acesso criado.");
  });

  it("explains when the account exists but no link could be generated", async () => {
    const { toast } = await import("sonner");
    vi.mocked(accounts.createAccess).mockImplementationOnce(createWithoutLink);
    vi.mocked(accounts.resetAccess).mockRejectedValueOnce(new Error("falhou"));
    getDB().clients.find((c) => c.id === "c-camila")!.user_id = "";
    renderView();
    await openSheet("Camila Reis Consultoria");
    const access = screen.getByRole("region", { name: "Acesso ao portal" });
    fireEvent.click(await within(access).findByRole("button", { name: "Criar acesso" }));

    expect(await within(access).findByRole("alert")).toHaveTextContent(
      "Acesso criado, mas o link não foi gerado. Use “Gerar novo link”.",
    );
    expect(await within(access).findByText("Ativo")).toBeInTheDocument();
    expect(within(access).getByRole("button", { name: "Gerar novo link" })).toBeEnabled();
    expect(within(access).queryByLabelText("Link de acesso")).toBeNull();
    expect(toast.success).not.toHaveBeenCalledWith("Acesso criado.");

    // The action recovers: a new link replaces the warning.
    fireEvent.click(within(access).getByRole("button", { name: "Gerar novo link" }));
    expect(await within(access).findByLabelText("Link de acesso")).toBeInTheDocument();
    expect(within(access).queryByRole("alert")).toBeNull();
  });

  it("falls back to selecting the link when the clipboard fails", async () => {
    writeText.mockRejectedValue(new Error("negado"));
    renderView();
    await openSheet("Marina Alves");
    const access = screen.getByRole("region", { name: "Acesso ao portal" });
    fireEvent.click(await within(access).findByRole("button", { name: "Gerar novo link" }));
    const input = (await within(access).findByLabelText("Link de acesso")) as HTMLInputElement;
    fireEvent.click(within(access).getByRole("button", { name: "Copiar" }));
    expect(await within(access).findByText(/copie manualmente/)).toBeInTheDocument();
    expect(document.activeElement).toBe(input);
  });

  it("never lists team accounts and has no delete button", async () => {
    renderView();
    await screen.findByRole("button", { name: "Abrir ficha de Marina Alves" });
    expect(screen.getAllByRole("button", { name: /Abrir ficha de/ })).toHaveLength(4);
    expect(screen.queryByText("Equipe NOVICX")).toBeNull();
    expect(screen.queryByRole("button", { name: /excluir|apagar|remover|deletar/i })).toBeNull();
    await openSheet("Marina Alves");
    expect(screen.queryByRole("button", { name: /excluir|apagar|remover|deletar/i })).toBeNull();
  });

  it("forwards the delivery and preview shortcuts", async () => {
    renderView();
    await openSheet("Marina Alves");
    fireEvent.click(screen.getByRole("button", { name: "Abrir entregas" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver como cliente" }));
    expect(onOpenDelivery).toHaveBeenCalledWith("c-marina");
    expect(onPreview).toHaveBeenCalledWith("c-marina");
  });

  it("has no fixed widths wider than a 375 px screen", async () => {
    const { container } = renderView();
    await screen.findByRole("button", { name: "Abrir ficha de Marina Alves" });
    const widths = () =>
      [...container.querySelectorAll("[class]")].flatMap((el) =>
        [...(el.getAttribute("class") ?? "").matchAll(/(?:^|\s)(?:min-)?w-\[(\d+)px\]/g)].map((m) =>
          Number(m[1]),
        ),
      );
    const grid = container.querySelector(".grid")!;
    // One column by default; extra columns only from md up.
    expect(grid.className).not.toMatch(/(?:^|\s)grid-cols-/);
    expect(widths().every((w) => w <= 375)).toBe(true);
    await openSheet("Marina Alves");
    expect(widths().every((w) => w <= 375)).toBe(true);
  });
});
