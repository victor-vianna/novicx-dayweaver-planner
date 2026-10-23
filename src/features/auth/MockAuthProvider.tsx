// Simulated session for the prototype. Isolated so it can be swapped for real
// auth later without touching pages. This is NOT a security boundary.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { AuthContext, type AuthStatus } from "@/features/auth/auth-context";
import {
  getSessionFor,
  signInAsDemo as signInAsDemoService,
  signInWithPassword,
  type MockSession,
} from "@/services/auth";

const STORAGE_KEY = "novicx-planner:auth";

interface Stored {
  profileId: string;
  previewClientId: string | null;
}

function readStored(): Stored | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function writeStored(value: Stored | null) {
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<MockSession | null>(null);
  const [previewClientId, setPreviewClientId] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStored();
    if (!stored) {
      setStatus("signed_out");
      return;
    }
    getSessionFor(stored.profileId)
      .then((s) => {
        setSession(s);
        setPreviewClientId(s.profile.role === "admin" ? stored.previewClientId : null);
        setStatus("signed_in");
      })
      .catch(() => {
        writeStored(null);
        setStatus("signed_out");
      });
  }, []);

  const finish = useCallback((s: MockSession) => {
    writeStored({ profileId: s.profile.id, previewClientId: null });
    setSession(s);
    setPreviewClientId(null);
    setStatus("signed_in");
    return s;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => finish(await signInWithPassword(email, password)),
    [finish],
  );

  const signInAsDemo = useCallback(
    async (role: "client" | "admin") => finish(await signInAsDemoService(role)),
    [finish],
  );

  const signOut = useCallback(() => {
    writeStored(null);
    setSession(null);
    setPreviewClientId(null);
    setStatus("signed_out");
  }, []);

  const startPreview = useCallback(
    (clientId: string) => {
      if (!session || session.profile.role !== "admin") return;
      writeStored({ profileId: session.profile.id, previewClientId: clientId });
      setPreviewClientId(clientId);
    },
    [session],
  );

  const stopPreview = useCallback(() => {
    if (!session) return;
    writeStored({ profileId: session.profile.id, previewClientId: null });
    setPreviewClientId(null);
  }, [session]);

  const value = useMemo(
    () => ({
      status,
      session,
      previewClientId,
      signIn,
      signInAsDemo,
      signOut,
      startPreview,
      stopPreview,
    }),
    [status, session, previewClientId, signIn, signInAsDemo, signOut, startPreview, stopPreview],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
