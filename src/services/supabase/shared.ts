// Helpers shared by the Supabase services: row → domain mapping, signed URLs
// and pt-BR errors. Access rules live in RLS; nothing here is a security check.
import type { PostgrestError } from "@supabase/supabase-js";

import { getSupabase } from "@/integrations/supabase/client";
import type { Client, Plan, Post, PostMedia, PostWithMedia, Weekday } from "@/types/domain";

export const MEDIA_BUCKET = "post-media";
/** Signed URLs last one hour; queries refetch well before that. */
export const SIGNED_URL_TTL = 60 * 60;

export const db = () => getSupabase();

/** Throws a readable error. RPC messages are already written in pt-BR. */
export function fail(error: PostgrestError | Error | null, fallback: string): never {
  const message = error?.message?.trim();
  throw new Error(
    message && !/^(JWT|permission denied|new row)/i.test(message) ? message : fallback,
  );
}

/** Postgres `time` → "HH:mm". */
export const hhmm = (value: string) => value.slice(0, 5);

// Raw rows as PostgREST returns them (time columns come as "HH:mm:ss").
type ClientRow = Omit<Client, "user_id"> & { user_id: string | null };
type PlanRow = Omit<Plan, "default_times"> & { default_times: string[] | null };
type MediaRow = Omit<PostMedia, "url">;
type PostRow = Post & { post_media?: MediaRow[] | null };

export function toClient(row: ClientRow): Client {
  return { ...row, user_id: row.user_id ?? "" };
}

export function toPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    posts_per_period: row.posts_per_period,
    period_days: row.period_days,
    default_weekdays: (row.default_weekdays ?? []) as Weekday[],
    default_times: (row.default_times ?? []).map(hhmm),
    active: row.active,
  };
}

export function toPost(row: PostRow): Post {
  return {
    id: row.id,
    client_id: row.client_id,
    client_package_id: row.client_package_id,
    format: row.format,
    title: row.title,
    caption: row.caption ?? null,
    scheduled_date: row.scheduled_date,
    scheduled_time: hhmm(row.scheduled_time),
    status: row.status,
    published_at: row.published_at ?? null,
    published_by: row.published_by ?? null,
  };
}

/** Columns for a post with its media, as used by every post query. */
export const POST_WITH_MEDIA = "*, post_media(id, post_id, storage_path, position, width, height)";

/** Maps rows selected with POST_WITH_MEDIA and signs every media path in one call. */
export async function toPostsWithMedia(rows: PostRow[]): Promise<PostWithMedia[]> {
  const urls = await signPaths(
    rows.flatMap((r) => (r.post_media ?? []).map((m) => m.storage_path)),
  );
  return rows.map((row) => ({
    ...toPost(row),
    media: (row.post_media ?? [])
      .map((m): PostMedia => ({ ...m, url: urls.get(m.storage_path) ?? "" }))
      .sort((a, b) => a.position - b.position),
  }));
}

export async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;
  const { data, error } = await db()
    .storage.from(MEDIA_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);
  if (error) fail(error, "Não foi possível carregar as artes.");
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) result.set(item.path, item.signedUrl);
  }
  return result;
}
