import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { MockAuthProvider } from "@/features/auth/MockAuthProvider";
import { useAuth } from "@/features/auth/useAuth";

const STORAGE_KEY = "novicx-planner:auth";

function Probe() {
  const auth = useAuth();

  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="profile">{auth.session?.profile.id ?? "none"}</span>
      <span data-testid="preview">{auth.previewClientId ?? "none"}</span>
      <button type="button" onClick={auth.signOut}>
        Sair
      </button>
      <button type="button" onClick={() => auth.startPreview("c-rafael")}>
        Visualizar
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <MockAuthProvider>
      <Probe />
    </MockAuthProvider>,
  );
}

describe("MockAuthProvider", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("becomes signed out when there is no stored session", async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("signed_out"));
    expect(screen.getByTestId("profile")).toHaveTextContent("none");
  });

  it("restores an admin session and its preview target", async () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profileId: "u-admin", previewClientId: "c-marina" }),
    );

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("signed_in"));
    expect(screen.getByTestId("profile")).toHaveTextContent("u-admin");
    expect(screen.getByTestId("preview")).toHaveTextContent("c-marina");
  });

  it("clears storage when signing out", async () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profileId: "u-admin", previewClientId: null }),
    );
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("signed_in"));

    act(() => fireEvent.click(screen.getByRole("button", { name: "Sair" })));

    expect(screen.getByTestId("status")).toHaveTextContent("signed_out");
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("ignores preview requests from a client session", async () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profileId: "u-marina", previewClientId: null }),
    );
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("signed_in"));

    act(() => fireEvent.click(screen.getByRole("button", { name: "Visualizar" })));

    expect(screen.getByTestId("preview")).toHaveTextContent("none");
  });
});
