// Account access through the admin-users Edge Function (the only code with the
// service_role). The function checks that the caller is an active admin; this
// module only shapes requests and pt-BR errors.
import type * as mock from "@/services/mock/accounts";
import { db, fail, toClient } from "./shared";

const FALLBACK = "Não foi possível concluir a operação.";

// Outside a browser (E2E in Node) Auth falls back to the project Site URL.
const redirectTo = () =>
  typeof window === "undefined" ? undefined : `${window.location.origin}/?redefinir-senha=1`;

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().functions.invoke<T>("admin-users", { body });
  if (error) {
    let message: unknown;
    try {
      // FunctionsHttpError keeps the Response; the function answers { error }.
      message = ((await (error.context as Response).json()) as { error?: unknown }).error;
    } catch {
      // Network/relay errors carry no JSON body.
    }
    throw new Error(typeof message === "string" && message ? message : FALLBACK);
  }
  return data as T;
}

export const getAccess: typeof mock.getAccess = async (client) => {
  if (!client.user_id) return { status: "none", userId: null };
  const { data, error } = await db()
    .from("profiles")
    .select("id, blocked_at")
    .eq("id", client.user_id)
    .maybeSingle();
  if (error) fail(error, "Não foi possível carregar o acesso.");
  if (!data) return { status: "none", userId: null };
  return { status: data.blocked_at ? "blocked" : "active", userId: data.id };
};

export const createAccess: typeof mock.createAccess = async (clientId) => {
  const res = await call<{ user_id: string; action_link: string | null }>({
    action: "create_account",
    client_id: clientId,
    redirect_to: redirectTo(),
  });
  // A null link means the account exists but the link failed: ask for a new one.
  return { userId: res.user_id, link: res.action_link ?? "" };
};

export const setAccessBlocked: typeof mock.setAccessBlocked = async (userId, blocked) => {
  await call({ action: "set_access", user_id: userId, blocked });
};

export const resetAccess: typeof mock.resetAccess = async (userId) => {
  const res = await call<{ action_link: string }>({
    action: "reset_access",
    user_id: userId,
    redirect_to: redirectTo(),
  });
  return res.action_link;
};

export const changeClientEmail: typeof mock.changeClientEmail = async (clientId, email) => {
  await call({ action: "update_email", client_id: clientId, email });
  const { data, error } = await db().from("clients").select("*").eq("id", clientId).single();
  if (error) fail(error, "Não foi possível carregar a cliente.");
  return toClient(data);
};
