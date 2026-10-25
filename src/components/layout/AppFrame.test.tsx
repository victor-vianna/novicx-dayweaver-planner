import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Home } from "lucide-react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppFrame } from "./AppFrame";

const auth = vi.hoisted(() => ({ signOut: vi.fn(), stopPreview: vi.fn() }));

vi.mock("@/features/auth/useAuth", () => ({ useAuth: () => auth }));

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

function mockResponsiveQueries() {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query === "(min-width: 64rem)" && window.innerWidth >= 1024,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function TestFrame() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <AppFrame
      name="Marina Alves"
      role="Cliente"
      nav={[{ id: "home", label: "Início", icon: Home }]}
      active="home"
      onNavigate={vi.fn()}
      menuOpen={menuOpen}
      onMenuOpen={setMenuOpen}
    >
      Conteúdo
    </AppFrame>
  );
}

describe("AppFrame mobile menu", () => {
  beforeEach(() => {
    setViewportWidth(375);
    mockResponsiveQueries();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setViewportWidth(1024);
  });

  it("exposes state, isolates the closed panel, and manages focus with Escape", async () => {
    render(<TestFrame />);

    const trigger = screen.getByRole("button", { name: "Abrir menu" });
    const panelId = trigger.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;

    expect(panel).not.toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(panel).toHaveAttribute("inert"));
    expect(panel).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAccessibleName("Fechar menu");
    expect(panel).not.toHaveAttribute("inert");
    expect(panel).not.toHaveAttribute("aria-hidden");
    await waitFor(() => expect(panel).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(trigger).toHaveAccessibleName("Abrir menu");
    expect(panel).toHaveAttribute("inert");
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(trigger).toHaveFocus();
  });

  it("keeps the closed panel isolated up to the desktop breakpoint", async () => {
    setViewportWidth(800);
    render(<TestFrame />);

    const trigger = screen.getByRole("button", { name: "Abrir menu" });
    const panel = document.getElementById(trigger.getAttribute("aria-controls") ?? "");

    await waitFor(() => expect(panel).toHaveAttribute("inert"));
    expect(panel).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the desktop sidebar available while the mobile menu state is closed", () => {
    setViewportWidth(1280);
    render(<TestFrame />);

    const panel = screen.getByRole("complementary", { name: "Menu principal" });

    expect(panel).not.toHaveAttribute("inert");
    expect(panel).not.toHaveAttribute("aria-hidden");
    expect(panel).toHaveClass("lg:translate-x-0", "-translate-x-full");
    expect(within(panel).getByRole("button", { name: "Início" })).toBeEnabled();
  });
});
