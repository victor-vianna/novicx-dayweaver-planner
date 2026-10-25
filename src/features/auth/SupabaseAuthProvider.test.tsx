// T3-R1-004 in Supabase mode: the suspension notice from a restored session is
// single-use — a valid sign-in or an explicit sign-out clears it.
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SupabaseAuthProvider } from "@/features/auth/SupabaseAuthProvider";
import { useAuth } from "@/features/auth/useAuth";
import { ACCESS_SUSPENDED } from "@/lib/access";

const session = { profile: { id: "u-admin", role: "admin", full_name: "Equipe" }, client: null };

vi.mock("@/services/supabase/auth", () => ({
  getCurrentUserId: async () => "u-blocked",
  loadSession: async () => {
    throw new Error(ACCESS_SUSPENDED);
  },
  signOut: async () => {},
  onAuthChange: () => () => {},
  signInWithPassword: async () => session,
  requestPasswordReset: async () => {},
  updatePassword: async () => {},
}));

let api: ReturnType<typeof useAuth>;
function Probe() {
  api = useAuth();
  return <span data-testid="notice">{api.sessionNotice ?? "none"}</span>;
}

describe("SupabaseAuthProvider sessionNotice", () => {
  it("is set by a suspended restore and cleared by sign-in and sign-out", async () => {
    render(
      <SupabaseAuthProvider>
        <Probe />
      </SupabaseAuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("notice")).toHaveTextContent(ACCESS_SUSPENDED));

    await act(async () => {
      await api.signIn("equipe@example.com", "x");
    });
    expect(screen.getByTestId("notice")).toHaveTextContent("none");
    expect(api.status).toBe("signed_in");

    act(() => api.signOut());
    expect(screen.getByTestId("notice")).toHaveTextContent("none");
  });
});
