// Clients in the demo (mock mode): same shape and rules as the Supabase service.
import { clone, commit, delay, getDB, uid } from "@/mocks/store";
import type { Client } from "@/types/domain";

export type ClientInput = Pick<
  Client,
  "display_name" | "business_name" | "profession" | "email" | "phone"
>;

export async function listClients(opts: { includeArchived?: boolean } = {}): Promise<Client[]> {
  await delay();
  const rows = getDB().clients.filter((c) => opts.includeArchived || !c.archived_at);
  return clone(rows).sort((a, b) => a.business_name.localeCompare(b.business_name, "pt-BR"));
}

export async function getClient(id: string): Promise<Client | null> {
  await delay(150);
  return clone(getDB().clients.find((c) => c.id === id) ?? null);
}

/** Like Supabase: the client is born without an account; access comes from createAccess. */
export async function createClient(input: ClientInput): Promise<Client> {
  await delay();
  const client: Client = {
    id: uid("c"),
    user_id: "",
    archived_at: null,
    ...input,
    email: input.email.trim().toLowerCase(),
  };
  getDB().clients.push(client);
  commit();
  return clone(client);
}

export async function updateClient(id: string, patch: Partial<ClientInput>): Promise<Client> {
  await delay();
  const client = getDB().clients.find((c) => c.id === id);
  if (!client) throw new Error("Cliente não encontrada");
  Object.assign(client, patch);
  commit();
  return clone(client);
}

export async function setClientArchived(id: string, archived: boolean): Promise<Client> {
  await delay();
  const client = getDB().clients.find((c) => c.id === id);
  if (!client) throw new Error("Cliente não encontrada");
  client.archived_at = archived ? new Date().toISOString() : null;
  commit();
  return clone(client);
}
