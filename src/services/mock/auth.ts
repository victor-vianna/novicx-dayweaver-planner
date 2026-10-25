// Simulated authentication. NOT secure — it only routes the demo experience.
// Replace with real auth (invites + per-client row security) in the next stage.
import { ACCESS_SUSPENDED } from "@/lib/access";
import { DEMO_ACCOUNTS } from "@/mocks/seed";
import { clone, delay, getDB } from "@/mocks/store";
import type { Client, Profile, Role } from "@/types/domain";

export interface MockSession {
  profile: Profile;
  client: Client | null;
}

export const DEMO_LOGIN_PREFILL = {
  email: DEMO_ACCOUNTS.client.email,
  password: DEMO_ACCOUNTS.client.password,
} as const;

export async function signInWithPassword(email: string, password: string): Promise<MockSession> {
  await delay(450);
  const normalized = email.trim().toLowerCase();
  const account = Object.values(DEMO_ACCOUNTS).find((a) => a.email === normalized);
  if (!account || account.password !== password) {
    throw new Error("E-mail ou senha incorretos.");
  }
  return getSessionFor(account.profileId);
}

export async function signInAsDemo(role: Role): Promise<MockSession> {
  const account = role === "admin" ? DEMO_ACCOUNTS.admin : DEMO_ACCOUNTS.client;
  return signInWithPassword(account.email, account.password);
}

export async function getSessionFor(profileId: string): Promise<MockSession> {
  const db = getDB();
  const profile = db.profiles.find((p) => p.id === profileId);
  if (!profile) throw new Error("Conta não encontrada.");
  if (profile.blocked_at) throw new Error(ACCESS_SUSPENDED);
  const client = db.clients.find((c) => c.user_id === profileId) ?? null;
  return clone({ profile, client });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await delay(500);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Informe um e-mail válido.");
  // Demo only: nothing is sent.
}
