// Internal notes are agency-only. The client portal must never call these.
import { clone, commit, delay, getDB, uid } from "@/mocks/store";
import type { InternalNote } from "@/types/domain";

export async function listNotes(clientId: string): Promise<InternalNote[]> {
  await delay();
  return clone(
    getDB()
      .notes.filter((n) => n.client_id === clientId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  );
}

export async function addNote(clientId: string, body: string, postId: string | null = null): Promise<InternalNote> {
  await delay();
  const note: InternalNote = {
    id: uid("n"),
    client_id: clientId,
    post_id: postId,
    body,
    created_at: new Date().toISOString(),
  };
  getDB().notes.push(note);
  commit();
  return clone(note);
}

export async function deleteNote(id: string): Promise<void> {
  await delay(160);
  const db = getDB();
  db.notes = db.notes.filter((n) => n.id !== id);
  commit();
}
