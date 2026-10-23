import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MockAuthProvider } from "@/features/auth/MockAuthProvider";
import { PlannerApp } from "@/features/planner/PlannerApp";

const STORAGE_KEY = "novicx-planner:auth";

function renderPlanner() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <PlannerApp />
      </MockAuthProvider>
    </QueryClientProvider>,
  );
}

describe("PlannerApp", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the login screen without a session", async () => {
    renderPlanner();

    expect(await screen.findByRole("button", { name: "Entrar no Planner" })).toBeInTheDocument();
  });

  it("shows the client overview for a restored demo session", async () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profileId: "u-marina", previewClientId: null }),
    );

    renderPlanner();

    expect(
      await screen.findByText("Próximas publicações", {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  });
});
