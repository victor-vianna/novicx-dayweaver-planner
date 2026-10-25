// Real session (Supabase Auth). Same AuthContextValue as the mock provider, so
// pages do not know which one is active. Access control itself lives in RLS;
// the admin preview only changes which portal the admin is looking at.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AuthContext, type AuthStatus } from "@/features/auth/auth-context";
import { ACCESS_SUSPENDED } from "@/lib/access";
import * as auth from "@/services/supabase/auth";

type AppSession = auth.AppSession;

const PREVIEW_KEY = "novicx-planner:preview";

function readPreview() {
  try {
    return window.sessionStorage.getItem(PREVIEW_KEY);
  } catch {
    return null;
  }
}

function writePreview(clientId: string | null) {
  try {
    if (clientId) window.sessionStorage.setItem(PREVIEW_KEY, clientId);
    else window.sessionStorage.removeItem(PREVIEW_KEY);
  } catch {
    // ignore
  }
}

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AppSession | null>(null);
  const [previewClientId, setPreviewClientId] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const loadedUser = useRef<string | null>(null);

  const apply = useCallback((s: AppSession | null) => {
    loadedUser.current = s?.profile.id ?? null;
    setSession(s);
    const preview = s?.profile.role === "admin" ? readPreview() : null;
    if (!preview) writePreview(null);
    setPreviewClientId(preview);
    setStatus(s ? "signed_in" : "signed_out");
  }, []);

  useEffect(() => {
    let active = true;

    const restore = async (userId: string | null) => {
      if (!userId) return active && apply(null);
      if (userId === loadedUser.current) return;
      try {
        const s = await auth.loadSession(userId);
        if (!active) return;
        setSessionNotice(null);
        apply(s);
      } catch (reason) {
        await auth.signOut();
        if (!active) return;
        if (reason instanceof Error && reason.message === ACCESS_SUSPENDED) {
          setSessionNotice(ACCESS_SUSPENDED);
        }
        apply(null);
      }
    };

    auth.getCurrentUserId().then(restore, () => active && apply(null));
    const unsubscribe = auth.onAuthChange((event, current) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_OUT") return active && apply(null);
      // Defer: supabase-js forbids awaiting its own calls inside this callback.
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
        setTimeout(() => void restore(current?.user.id ?? null), 0);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [apply]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const s = await auth.signInWithPassword(email, password);
      setSessionNotice(null);
      writePreview(null);
      apply(s);
      return s;
    },
    [apply],
  );

  const signInAsDemo = useCallback(async (): Promise<AppSession> => {
    throw new Error("A demonstração só existe no modo mock.");
  }, []);

  const signOut = useCallback(() => {
    setSessionNotice(null);
    writePreview(null);
    apply(null);
    void auth.signOut();
  }, [apply]);

  const startPreview = useCallback(
    (clientId: string) => {
      if (session?.profile.role !== "admin") return;
      writePreview(clientId);
      setPreviewClientId(clientId);
    },
    [session],
  );

  const stopPreview = useCallback(() => {
    writePreview(null);
    setPreviewClientId(null);
  }, []);

  const completePasswordReset = useCallback(async (password: string) => {
    await auth.updatePassword(password);
    setPasswordRecovery(false);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

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
      requestPasswordReset: auth.requestPasswordReset,
      passwordRecovery,
      completePasswordReset,
      sessionNotice,
    }),
    [
      status,
      session,
      previewClientId,
      signIn,
      signInAsDemo,
      signOut,
      startPreview,
      stopPreview,
      passwordRecovery,
      completePasswordReset,
      sessionNotice,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
