import { useContext } from "react";

import { AuthContext } from "@/features/auth/auth-context";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an auth provider");
  return ctx;
}

/** The client whose portal is being shown: the signed-in client, or the admin's preview target. */
export function usePortalClientId() {
  const { session, previewClientId } = useAuth();
  if (!session) return null;
  if (session.profile.role === "client") return session.client?.id ?? null;
  return previewClientId;
}
