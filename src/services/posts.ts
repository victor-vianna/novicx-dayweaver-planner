import { addDays, todayISO } from "@/lib/dates";
import { clone, commit, delay, getDB, uid } from "@/mocks/store";
import type { Post, PostMedia, PostWithMedia } from "@/types/domain";

interface ListOpts {
  clientId?: string;
  packageId?: string;
  /** Admin only. The client portal never requests drafts. */
  includeDrafts?: boolean;
}

function withMedia(post: Post): PostWithMedia {
  const media = getDB()
    .media.filter((m) => m.post_id === post.id)
    .sort((a, b) => a.position - b.position);
  return { ...post, media };
}

function sortBySchedule(a: Post, b: Post) {
  return (a.scheduled_date + a.scheduled_time).localeCompare(b.scheduled_date + b.scheduled_time);
}

export async function listPosts(opts: ListOpts = {}): Promise<PostWithMedia[]> {
  await delay();
  const rows = getDB()
    .posts.filter((p) => (opts.clientId ? p.client_id === opts.clientId : true))
    .filter((p) => (opts.packageId ? p.client_package_id === opts.packageId : true))
    .filter((p) => opts.includeDrafts || p.status !== "draft")
    .sort(sortBySchedule)
    .map(withMedia);
  return clone(rows);
}

export async function getPost(
  id: string,
  opts: { includeDrafts?: boolean; clientId?: string } = {},
): Promise<PostWithMedia | null> {
  await delay(180);
  const post = getDB().posts.find((p) => p.id === id);
  if (!post) return null;
  if (!opts.includeDrafts && post.status === "draft") return null;
  if (opts.clientId && post.client_id !== opts.clientId) return null;
  return clone(withMedia(post));
}

export type PostPatch = Partial<
  Pick<Post, "title" | "caption" | "format" | "scheduled_date" | "scheduled_time" | "status">
>;

export async function updatePost(id: string, patch: PostPatch): Promise<PostWithMedia> {
  await delay();
  const post = getDB().posts.find((p) => p.id === id);
  if (!post) throw new Error("Publicação não encontrada");
  Object.assign(post, patch);
  if (patch.status && patch.status !== "published") {
    post.published_at = null;
    post.published_by = null;
  }
  if (patch.status === "published" && !post.published_at) {
    post.published_at = new Date().toISOString();
    post.published_by = "admin";
  }
  commit();
  return clone(withMedia(post));
}

export async function markPostPublished(id: string): Promise<PostWithMedia> {
  await delay(260);
  const post = getDB().posts.find((p) => p.id === id);
  if (!post) throw new Error("Publicação não encontrada");
  if (post.status === "draft") throw new Error("Esta publicação ainda não está disponível");
  post.status = "published";
  post.published_at = new Date().toISOString();
  post.published_by = "client";
  commit();
  return clone(withMedia(post));
}

export async function unmarkPostPublished(id: string): Promise<PostWithMedia> {
  await delay(200);
  const post = getDB().posts.find((p) => p.id === id);
  if (!post) throw new Error("Publicação não encontrada");
  post.status = "ready";
  post.published_at = null;
  post.published_by = null;
  commit();
  return clone(withMedia(post));
}

export async function setPostMedia(
  postId: string,
  items: Pick<PostMedia, "url" | "width" | "height">[],
): Promise<PostWithMedia> {
  await delay();
  const db = getDB();
  const post = db.posts.find((p) => p.id === postId);
  if (!post) throw new Error("Publicação não encontrada");
  db.media = db.media.filter((m) => m.post_id !== postId);
  items.forEach((item, i) => {
    db.media.push({
      id: uid("m"),
      post_id: postId,
      storage_path: `clients/${post.client_id}/posts/${postId}/${i + 1}.jpg`,
      url: item.url,
      position: i,
      width: item.width,
      height: item.height,
    });
  });
  commit();
  return clone(withMedia(post));
}

/** All posts (any client) scheduled from today through today + `days`. */
export async function listUpcomingDeliveries(days = 7): Promise<PostWithMedia[]> {
  await delay();
  const today = todayISO();
  const limit = addDays(today, days);
  return clone(
    getDB()
      .posts.filter((p) => p.scheduled_date >= today && p.scheduled_date <= limit)
      .filter((p) => p.status !== "published")
      .sort(sortBySchedule)
      .map(withMedia),
  );
}
