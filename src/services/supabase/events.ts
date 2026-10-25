import type { PostEvent } from "@/types/domain";

import { db, fail } from "./shared";

// Written only by database triggers; RLS lets only an active admin read.
export async function listPostEvents(postId: string): Promise<PostEvent[]> {
  const { data, error } = await db()
    .from("post_events")
    .select("id, post_id, kind, detail, actor_id, actor_role, created_at")
    .eq("post_id", postId)
    .order("id");
  if (error) fail(error, "Não foi possível carregar o histórico.");
  return (data ?? []).map((row) => ({
    ...row,
    id: String(row.id),
    kind: row.kind as PostEvent["kind"],
    detail: (row.detail ?? {}) as PostEvent["detail"],
  }));
}
