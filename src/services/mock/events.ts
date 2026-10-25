// Change history in the demo: the mock services record the same events the
// database triggers write (post_events). Admin only, like the RLS.
import { DEMO_ACCOUNTS } from "@/mocks/seed";
import { clone, delay, getDB, uid } from "@/mocks/store";
import type { Actor, PostEvent, PostEventKind } from "@/types/domain";

export async function listPostEvents(postId: string): Promise<PostEvent[]> {
  await delay(120);
  const rows = (getDB().events ?? []).filter((e) => e.post_id === postId);
  return clone(rows).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Called by the mock services; the caller commits. */
export function recordEvent(
  postId: string,
  kind: PostEventKind,
  detail: PostEvent["detail"] = {},
  actor: Actor = { role: "admin" },
) {
  const db = getDB();
  const client = db.clients.find((c) => c.id === (actor.role === "client" ? actor.clientId : ""));
  (db.events ??= []).push({
    id: uid("e"),
    post_id: postId,
    kind,
    detail,
    actor_id: actor.role === "admin" ? DEMO_ACCOUNTS.admin.profileId : (client?.user_id ?? null),
    actor_role: actor.role,
    created_at: new Date().toISOString(),
  });
}
