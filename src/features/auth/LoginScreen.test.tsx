// Suspended accounts on the login screen (mock mode): the demo shortcut shows
// the real reason, and the notice from a suspended saved session is shown once.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginScreen } from "@/features/auth/LoginScreen";
import { MockAuthProvider } from "@/features/auth/MockAuthProvider";
import { useAuth } from "@/features/auth/useAuth";
import { ACCESS_SUSPENDED } from "@/lib/access";
import { DEMO_ACCOUNTS } from "@/mocks/seed";
import { commit, getDB, resetDB } from "@/mocks/store";

vi.mock("@/mocks/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/mocks/store")>()),
  delay: async () => {},
}));

function Shell() {
  const { status, signOut } = useAuth();
  if (status === "loading") return null;
  if (status === "signed_out") return <LoginScreen />;
  return (
    <button type="button" onClick={signOut}>
      Sair
    </button>
  );
}

const renderApp = () =>
  render(
    <MockAuthProvider>
      <Shell />
    </MockAuthProvider>,
  );

function blockDemoClient() {
  getDB().profiles.find((p) => p.id === DEMO_ACCOUNTS.client.profileId)!.blocked_at =
    "2026-10-25T00:00:00Z";
  commit();
}

beforeEach(() => {
  window.sessionStorage.clear();
  resetDB();
});
afterEach(() => resetDB());

describe("LoginScreen with a suspended account", () => {
  // T3-R1-001
  it("shows the suspension reason from the demo shortcut", async () => {
    blockDemoClient();
    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /Área cliente/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(ACCESS_SUSPENDED);
  });

  // T3-R1-004
  it("shows the notice of a suspended saved session once", async () => {
    blockDemoClient();
    window.sessionStorage.setItem(
      "novicx-planner:auth",
      JSON.stringify({ profileId: DEMO_ACCOUNTS.client.profileId, previewClientId: null }),
    );
    const { unmount } = renderApp();
    expect(await screen.findByRole("alert")).toHaveTextContent(ACCESS_SUSPENDED);

    fireEvent.click(screen.getByRole("button", { name: /Área equipe/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Sair" }));
    await screen.findByRole("button", { name: /Área cliente/ });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    unmount();
  });
});
