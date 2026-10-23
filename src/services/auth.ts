// Simulated authentication. NOT secure — it only routes the demo experience.
// Replace with real auth (invites + per-client row security) in the next stage.
import { DEMO_ACCOUNTS } from "@/mocks/seed";
import { clone, delay, getDB } from "@/mocks/store";
import type { Client, Profile } from "@/types/domain";

export interface MockSession {
  profile: Profile;
  client: Client | null;
}

export async function signInWithPassword(email: string, password: string): Promise<MockSession> {
  await delay(450);
  const normalized = email.trim().toLowerCase();
  const account = Object.values(DEMO_ACCOUNTS).find((a) => a.email === normalized);
  if (!account || account.password !== password) {
    throw new Error("E-mail ou senha incorretos.");
  }
  return getSessionFor(account.profileId);
}

export async function getSessionFor(profileId: string): Promise<MockSession> {
  const db = getDB();
  const profile = db.profiles.find((p) => p.id === profileId);
  if (!profile) throw new Error("Conta não encontrada.");
  const client = db.clients.find((c) => c.user_id === profileId) ?? null;
  return clone({ profile, client });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await delay(500);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Informe um e-mail válido.");
  // Demo only: nothing is sent.
}
