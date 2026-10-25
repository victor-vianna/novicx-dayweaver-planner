import { fireEvent, render, screen } from "@testing-library/react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route } from "../routes/__root";

const { invalidate } = vi.hoisted(() => ({
  invalidate: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();

  return {
    ...actual,
    Link: ({ children, to, ...props }: React.ComponentProps<"a"> & { to: string }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    useRouter: () => ({ invalidate }),
  };
});

vi.mock("../lib/lovable-error-reporting", () => ({
  reportLovableError: vi.fn(),
}));

const NotFoundComponent = Route.options.notFoundComponent as React.ComponentType;
const ErrorComponent = Route.options.errorComponent as React.ComponentType<ErrorComponentProps>;

describe("páginas de estado da rota raiz", () => {
  beforeEach(() => {
    invalidate.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("apresenta a página 404 em português e permite voltar ao início", () => {
    render(<NotFoundComponent />);

    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Página não encontrada" })).toBeInTheDocument();
    expect(
      screen.getByText("A página que você procura não existe ou foi movida."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
  });

  it("apresenta erro sem detalhes técnicos e permite tentar novamente ou voltar", () => {
    const reset = vi.fn();
    const error = new Error("segredo-interno");
    error.stack = "stack-trace-interna";

    render(<ErrorComponent error={error} reset={reset} info={{ componentStack: "" }} />);

    expect(
      screen.getByRole("heading", { name: "Não foi possível carregar esta página" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Algo deu errado. Você pode tentar novamente ou voltar ao início."),
    ).toBeInTheDocument();
    expect(screen.queryByText("segredo-interno")).not.toBeInTheDocument();
    expect(screen.queryByText("stack-trace-interna")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(invalidate).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
  });
});
