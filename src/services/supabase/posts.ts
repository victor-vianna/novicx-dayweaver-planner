import { addDays, todayISO } from "@/lib/dates";
import type { NewPostInput, PostPatch } from "@/services/mock/posts";
import type { Actor, Post, PostWithMedia } from "@/types/domain";

import { db, fail, POST_WITH_MEDIA, toPostsWithMedia } from "./shared";

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

/** Admin edit. Publication fields follow the status, like the mock. */
export async function updatePost(id: string, patch: PostPatch): Promise<PostWithMedia> {
  const row: PostPatch & Partial<Pick<Post, "published_at" | "published_by">> = { ...patch };
  if (patch.status && patch.status !== "published") {
    row.published_at = null;
    row.published_by = null;
  }
  if (patch.status === "published") {
    const current = await requirePost(id);
    if (current.status !== "published") {
      row.published_at = new Date().toISOString();
      row.published_by = "admin";
    }
  }
  const { data, error } = await db().from("posts").update(row).eq("id", id).select("id");
  if (error) fail(error, "Não foi possível salvar a publicação.");
  if (!data?.length) throw new Error("Publicação não encontrada");
  return requirePost(id);
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
      status: "draft",
    })
    .select("id")
    .single();
  if (error) fail(error, "Não foi possível criar a publicação.");
  return requirePost(data.id as string);
}
