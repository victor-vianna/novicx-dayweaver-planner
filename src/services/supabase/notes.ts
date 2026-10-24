// Internal notes are agency-only; RLS returns nothing to clients.
import type { InternalNote } from "@/types/domain";

import { db, fail } from "./shared";

const COLUMNS = "id, client_id, post_id, body, created_at";

export async function listNotes(clientId: string): Promise<InternalNote[]> {
  const { data, error } = await db()
    .from("internal_notes")
    .select(COLUMNS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) fail(error, "Não foi possível carregar as notas.");
  return (data ?? []) as InternalNote[];
}

export async function addNote(
  clientId: string,
  body: string,
  postId: string | null = null,
): Promise<InternalNote> {
  const { data, error } = await db()
    .from("internal_notes")
    .insert({ client_id: clientId, post_id: postId, body })
    .select(COLUMNS)
    .single();
  if (error) fail(error, "Não foi possível salvar a nota.");
  return data as InternalNote;
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await db().from("internal_notes").delete().eq("id", id);
  if (error) fail(error, "Não foi possível excluir a nota.");
}
