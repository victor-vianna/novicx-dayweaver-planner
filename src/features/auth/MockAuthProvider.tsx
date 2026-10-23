// Simulated session for the prototype. Isolated so it can be swapped for real
// auth later without touching pages. This is NOT a security boundary.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DEMO_ACCOUNTS } from "@/mocks/seed";
import { getSessionFor, signInWithPassword, type MockSession } from "@/services/auth";
import type { Role } from "@/types/domain";

const STORAGE_KEY = "novicx-planner:auth";

interface Stored {
  profileId: string;
  previewClientId: string | null;
}

type Status = "loading" | "signed_out" | "signed_in";

interface AuthContextValue {
  status: Status;
  session: MockSession | null;
  previewClientId: string | null;
  signIn: (email: string, password: string) => Promise<MockSession>;
  signInAsDemo: (role: Role) => Promise<MockSession>;
  signOut: () => void;
  startPreview: (clientId: string) => void;
  stopPreview: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
  const [status, setStatus] = useState<Status>("loading");
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
    async (role: Role) => {
      const account = role === "admin" ? DEMO_ACCOUNTS.admin : DEMO_ACCOUNTS.client;
      return finish(await signInWithPassword(account.email, account.password));
    },
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside MockAuthProvider");
  return ctx;
}

/** The client whose portal is being shown: the signed-in client, or the admin's preview target. */
export function usePortalClientId() {
  const { session, previewClientId } = useAuth();
  if (!session) return null;
  if (session.profile.role === "client") return session.client?.id ?? null;
  return previewClientId;
}
