import type { ClientInput } from "@/services/mock/clients";
import type { Client } from "@/types/domain";

import { db, fail, toClient } from "./shared";

export async function listClients(opts: { includeArchived?: boolean } = {}): Promise<Client[]> {
  let query = db().from("clients").select("*");
  if (!opts.includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) fail(error, "Não foi possível carregar as clientes.");
  return (data ?? [])
    .map(toClient)
    .sort((a, b) => a.business_name.localeCompare(b.business_name, "pt-BR"));
}

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await db().from("clients").select("*").eq("id", id).maybeSingle();
  if (error) fail(error, "Não foi possível carregar a cliente.");
  return data ? toClient(data) : null;
}

/** The login is created in the Supabase dashboard; it links by e-mail. */
export async function createClient(input: ClientInput): Promise<Client> {
  const { data, error } = await db()
    .from("clients")
    .insert({ ...input, email: input.email.trim().toLowerCase() })
    .select("*")
    .single();
  if (error) fail(error, "Não foi possível cadastrar a cliente.");
  return toClient(data);
}

export async function updateClient(id: string, patch: Partial<ClientInput>): Promise<Client> {
  const row = patch.email ? { ...patch, email: patch.email.trim().toLowerCase() } : patch;
  const { data, error } = await db()
    .from("clients")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) fail(error, "Não foi possível salvar a cliente.");
  if (!data) throw new Error("Cliente não encontrada");
  return toClient(data);
}

export async function setClientArchived(id: string, archived: boolean): Promise<Client> {
  const { data, error } = await db()
    .from("clients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) fail(error, "Não foi possível arquivar a cliente.");
  if (!data) throw new Error("Cliente não encontrada");
  return toClient(data);
}
