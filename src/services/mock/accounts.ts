// Account access in the demo (mock mode): mirrors the admin-users Edge Function
// on the in-memory store. NOT a security boundary — nothing leaves the browser.
import { clone, commit, delay, getDB, uid } from "@/mocks/store";
import type { Client } from "@/types/domain";

export type AccessStatus = "none" | "active" | "blocked";

export interface AccountAccess {
  status: AccessStatus;
  userId: string | null;
}

/** Demo links point nowhere: the real one comes from Supabase Auth. */
const DEMO_LINK = "https://exemplo.invalid/definir-senha?demonstracao=1";

export async function getAccess(client: Pick<Client, "user_id">): Promise<AccountAccess> {
  await delay(100);
  const profile = client.user_id ? getDB().profiles.find((p) => p.id === client.user_id) : null;
  if (!profile) return { status: "none", userId: null };
  return { status: profile.blocked_at ? "blocked" : "active", userId: profile.id };
}

export async function createAccess(clientId: string): Promise<{ userId: string; link: string }> {
  await delay();
  const db = getDB();
  const client = db.clients.find((c) => c.id === clientId);
  if (!client) throw new Error("Cliente não encontrada.");
  if (client.user_id && db.profiles.some((p) => p.id === client.user_id)) {
    throw new Error("Esta cliente já tem acesso.");
  }
  const userId = uid("u");
  db.profiles.push({
    id: userId,
    role: "client",
    full_name: client.display_name,
    blocked_at: null,
  });
  client.user_id = userId;
  commit();
  return { userId, link: DEMO_LINK };
}

export async function setAccessBlocked(userId: string, blocked: boolean): Promise<void> {
  await delay();
  const profile = getDB().profiles.find((p) => p.id === userId);
  if (!profile) throw new Error("Conta não encontrada.");
  if (profile.role !== "client") throw new Error("Só contas de clientes são gerenciadas aqui.");
  profile.blocked_at = blocked ? new Date().toISOString() : null;
  commit();
}

export async function resetAccess(userId: string): Promise<string> {
  await delay();
  const profile = getDB().profiles.find((p) => p.id === userId);
  if (!profile) throw new Error("Conta não encontrada.");
  if (profile.role !== "client") throw new Error("Só contas de clientes são gerenciadas aqui.");
  if (profile.blocked_at) throw new Error("Desbloqueie a conta antes de gerar um novo link.");
  return DEMO_LINK;
}

export async function changeClientEmail(clientId: string, email: string): Promise<Client> {
  await delay();
  const db = getDB();
  const next = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) throw new Error("E-mail inválido.");
  const client = db.clients.find((c) => c.id === clientId);
  if (!client) throw new Error("Cliente não encontrada.");
  if (db.clients.some((c) => c.id !== clientId && c.email.trim().toLowerCase() === next)) {
    throw new Error("Já existe uma cliente com este e-mail.");
  }
  client.email = next;
  commit();
  return clone(client);
}
