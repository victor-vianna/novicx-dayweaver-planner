import { addDays, todayISO } from "@/lib/dates";
import { DRAFT_ONLY } from "@/lib/status";
import type { NewPostInput, PostPatch } from "@/services/mock/posts";
import type { Actor, PostWithMedia } from "@/types/domain";

import { db, fail, MEDIA_BUCKET, POST_WITH_MEDIA, toPostsWithMedia } from "./shared";

// RLS enforces the portal boundary: clients only receive their own non-draft
// posts, whatever filters are sent. The filters below only shape admin views.

interface ListOpts {
  clientId?: string;
  packageId?: string;
  includeDrafts?: boolean;
}

export async function listPosts(opts: ListOpts = {}): Promise<PostWithMedia[]> {
  let query = db()
    .from("posts")
    .select(POST_WITH_MEDIA)
    .order("scheduled_date")
    .order("scheduled_time");
  if (opts.clientId) query = query.eq("client_id", opts.clientId);
  if (opts.packageId) query = query.eq("client_package_id", opts.packageId);
  if (!opts.includeDrafts) query = query.neq("status", "draft");
  const { data, error } = await query;
  if (error) fail(error, "Não foi possível carregar as publicações.");
  return toPostsWithMedia(data ?? []);
}

export async function getPost(
  id: string,
  opts: { includeDrafts?: boolean; clientId?: string } = {},
): Promise<PostWithMedia | null> {
  let query = db().from("posts").select(POST_WITH_MEDIA).eq("id", id);
  if (opts.clientId) query = query.eq("client_id", opts.clientId);
  if (!opts.includeDrafts) query = query.neq("status", "draft");
  const { data, error } = await query.maybeSingle();
  if (error) fail(error, "Não foi possível carregar a publicação.");
  if (!data) return null;
  const [post] = await toPostsWithMedia([data]);
  return post ?? null;
}

async function requirePost(id: string) {
  const post = await getPost(id, { includeDrafts: true });
  if (!post) throw new Error("Publicação não encontrada");
  return post;
}

/**
 * Admin edit. Text and schedule are written directly; status goes through
 * admin_set_post_status, which sets the publication fields and derives the
 * format in one transaction (the table no longer accepts direct status writes).
 */
export async function updatePost(id: string, patch: PostPatch): Promise<PostWithMedia> {
  const { status, ...fields } = patch;
  if (Object.keys(fields).length) {
    const { data, error } = await db().from("posts").update(fields).eq("id", id).select("id");
    if (error) fail(error, "Não foi possível salvar a publicação.");
    if (!data?.length) throw new Error("Publicação não encontrada");
  }
  if (status) {
    const { error } = await db().rpc("admin_set_post_status", { p_post_id: id, p_status: status });
    if (error) fail(error, "Não foi possível atualizar o status da publicação.");
  }
  return requirePost(id);
}

/**
 * Admin. Only drafts can be deleted (RLS); their files are removed after the
 * row. Returns how many files could not be removed, so the UI never claims a
 * clean delete that left files behind (they stay invisible to clients: no
 * post_media row points to them).
 */
export async function deletePost(id: string): Promise<{ filesLeft: number }> {
  const post = await requirePost(id);
  if (post.status !== "draft") throw new Error(DRAFT_ONLY);
  const { data, error } = await db().from("posts").delete().eq("id", id).select("id");
  if (error) fail(error, "Não foi possível excluir a publicação.");
  if (!data?.length) throw new Error(DRAFT_ONLY);
  return { filesLeft: await removeFiles(post.media.map((m) => m.storage_path)) };
}

/** Removes files; returns how many were not removed (error or denied). */
export async function removeFiles(paths: string[]): Promise<number> {
  if (!paths.length) return 0;
  // Storage reports failures in `error`, and a denied remove as a short list.
  const { data, error } = await db().storage.from(MEDIA_BUCKET).remove(paths);
  if (error) return paths.length;
  return paths.length - (data?.length ?? 0);
}

async function setPublished(id: string, published: boolean) {
  const { error } = await db().rpc("set_post_published", { p_post_id: id, p_published: published });
  if (error) fail(error, "Não foi possível atualizar a publicação.");
  return requirePost(id);
}

// The actor is resolved server-side from the session; the parameter is kept
// so both implementations share one signature.
export async function markPostPublished(id: string, _actor: Actor): Promise<PostWithMedia> {
  return setPublished(id, true);
}

export async function unmarkPostPublished(id: string, _actor: Actor): Promise<PostWithMedia> {
  return setPublished(id, false);
}

export async function setPostMedia(): Promise<PostWithMedia> {
  throw new Error("Use o envio de arquivos (services/media) no modo Supabase.");
}

export async function listUpcomingDeliveries(days = 7): Promise<PostWithMedia[]> {
  const today = todayISO();
  const { data, error } = await db()
    .from("posts")
    .select(POST_WITH_MEDIA)
    .gte("scheduled_date", today)
    .lte("scheduled_date", addDays(today, days))
    .neq("status", "published")
    .order("scheduled_date")
    .order("scheduled_time");
  if (error) fail(error, "Não foi possível carregar as próximas entregas.");
  return toPostsWithMedia(data ?? []);
}

export async function createPost(input: NewPostInput): Promise<PostWithMedia> {
  const { data, error } = await db()
    .from("posts")
    .insert({
      client_id: input.clientId,
      client_package_id: input.packageId,
      title: input.title,
      scheduled_date: input.scheduledDate,
      scheduled_time: input.scheduledTime,
    })
    .select("id")
    .single();
  if (error) fail(error, "Não foi possível criar a publicação.");
  return requirePost(data.id as string);
}
