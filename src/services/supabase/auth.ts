// Real authentication (Supabase Auth, e-mail + password). Accounts are created
// in the Supabase dashboard; a database trigger links them to the client by e-mail.
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { ACCESS_SUSPENDED } from "@/lib/access";
import type { MockSession } from "@/services/mock/auth";
import type { Profile } from "@/types/domain";

import { db, fail, toClient } from "./shared";

export type AppSession = MockSession;

/** Loads profile + linked client for the signed-in user. */
export async function loadSession(userId: string): Promise<AppSession> {
  const { data: profile, error } = await db()
    .from("profiles")
    .select("id, role, full_name, blocked_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) fail(error, "Não foi possível carregar sua conta.");
  if (!profile) throw new Error("Conta não encontrada.");
  // A suspended account reads no client row (RLS), so check this first.
  if (profile.blocked_at) throw new Error(ACCESS_SUSPENDED);

  const { data: client, error: clientError } = await db()
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  if (clientError) fail(clientError, "Não foi possível carregar sua conta.");

  const session: AppSession = {
    profile: profile as Profile,
    client: client ? toClient(client) : null,
  };
  if (session.profile.role === "client" && !session.client) {
    throw new Error("Sua conta ainda não está vinculada a um cadastro. Fale com a equipe NOVICX.");
  }
  return session;
}

export async function signInWithPassword(email: string, password: string): Promise<AppSession> {
  const { data, error } = await db().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error?.code === "user_banned") throw new Error(ACCESS_SUSPENDED);
  if (error || !data.user) {
    throw new Error(
      error?.status === 400 || error?.code === "invalid_credentials"
        ? "E-mail ou senha incorretos."
        : "Não foi possível entrar. Tente novamente.",
    );
  }
  try {
    return await loadSession(data.user.id);
  } catch (reason) {
    await db().auth.signOut();
    throw reason;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await db().auth.getSession();
  return data.session?.user.id ?? null;
}

export async function signOut(): Promise<void> {
  await db().auth.signOut();
}

export function onAuthChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  const { data } = db().auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Informe um e-mail válido.");
  const { error } = await db().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/?redefinir-senha=1`,
  });
  if (error) fail(error, "Não foi possível enviar o e-mail de recuperação.");
}

export async function updatePassword(password: string): Promise<void> {
  if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  const { error } = await db().auth.updateUser({ password });
  if (error) fail(error, "Não foi possível alterar a senha.");
}
