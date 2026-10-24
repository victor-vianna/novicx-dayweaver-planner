import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DemoTag } from "./States";

const mode = vi.hoisted(() => ({ mock: true }));
vi.mock("@/lib/data-source", () => ({ isMockMode: () => mode.mock }));

describe("DemoTag", () => {
  afterEach(() => {
    mode.mock = true;
  });

  it("shows the demo label in mock mode", () => {
    render(<DemoTag />);
    expect(screen.getByText("Modo demonstração — dados fictícios")).toBeInTheDocument();
  });

  it("renders nothing with real data (supabase)", () => {
    mode.mock = false;
    const { container } = render(<DemoTag />);
    expect(container).toBeEmptyDOMElement();
  });
});
