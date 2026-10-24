// Art uploads to the private bucket. Path: clients/{client}/posts/{post}/{uuid}.{ext}
// (a new uuid per file avoids stale caches when an art is replaced).
// Storage and table writes are not atomic, so every failure path removes the
// object it just uploaded; a leftover orphan is invisible to clients anyway.
import { imageExtension, readImageSize, validateImageFile } from "@/lib/media-files";
import type { PostWithMedia } from "@/types/domain";

import { db, fail, MEDIA_BUCKET, POST_WITH_MEDIA, toPostsWithMedia } from "./shared";

const bucket = () => db().storage.from(MEDIA_BUCKET);

async function loadPost(postId: string): Promise<PostWithMedia> {
  const { data, error } = await db()
    .from("posts")
    .select(POST_WITH_MEDIA)
    .eq("id", postId)
    .maybeSingle();
  if (error) fail(error, "Não foi possível carregar a publicação.");
  if (!data) throw new Error("Publicação não encontrada");
  const [post] = await toPostsWithMedia([data]);
  return post!;
}

/** Keeps `format` in sync with the number of arts. */
async function syncFormat(post: PostWithMedia): Promise<PostWithMedia> {
  const format = post.media.length > 1 ? "carousel" : "single";
  if (post.format === format) return post;
  const { error } = await db().from("posts").update({ format }).eq("id", post.id);
  if (error) fail(error, "Não foi possível atualizar o formato da publicação.");
  return { ...post, format };
}

async function putFile(clientId: string, postId: string, file: File) {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);
  const path = `clients/${clientId}/posts/${postId}/${crypto.randomUUID()}.${imageExtension(file.type)}`;
  const { error } = await bucket().upload(path, file, { contentType: file.type, upsert: false });
  if (error) fail(error, `Não foi possível enviar "${file.name}".`);
  return path;
}

async function discard(paths: string[]) {
  if (paths.length) await bucket().remove(paths);
}

export async function uploadPostMedia(postId: string, files: File[]): Promise<PostWithMedia> {
  for (const file of files) {
    const problem = validateImageFile(file);
    if (problem) throw new Error(problem);
  }
  const post = await loadPost(postId);
  let position = post.media.reduce((max, m) => Math.max(max, m.position + 1), 0);

  for (const file of files) {
    const [path, size] = await Promise.all([
      putFile(post.client_id, postId, file),
      readImageSize(file),
    ]);
    const { error } = await db()
      .from("post_media")
      .insert({ post_id: postId, storage_path: path, position: position++, ...size });
    if (error) {
      await discard([path]);
      fail(error, `Não foi possível registrar "${file.name}".`);
    }
  }
  return syncFormat(await loadPost(postId));
}

async function mediaRow(mediaId: string) {
  const { data, error } = await db()
    .from("post_media")
    .select("id, post_id, storage_path")
    .eq("id", mediaId)
    .maybeSingle();
  if (error) fail(error, "Não foi possível carregar a arte.");
  if (!data) throw new Error("Arte não encontrada");
  return data as { id: string; post_id: string; storage_path: string };
}

export async function replacePostMedia(mediaId: string, file: File): Promise<PostWithMedia> {
  const media = await mediaRow(mediaId);
  const post = await loadPost(media.post_id);
  const [path, size] = await Promise.all([
    putFile(post.client_id, post.id, file),
    readImageSize(file),
  ]);
  const { error } = await db()
    .from("post_media")
    .update({ storage_path: path, ...size })
    .eq("id", mediaId);
  if (error) {
    await discard([path]);
    fail(error, "Não foi possível substituir a arte.");
  }
  await discard([media.storage_path]);
  return loadPost(post.id);
}

export async function reorderPostMedia(
  postId: string,
  orderedIds: string[],
): Promise<PostWithMedia> {
  const { error } = await db().rpc("reorder_post_media", {
    p_post_id: postId,
    p_media_ids: orderedIds,
  });
  if (error) fail(error, "Não foi possível reordenar as artes.");
  return loadPost(postId);
}

export async function removePostMedia(mediaId: string): Promise<PostWithMedia> {
  const media = await mediaRow(mediaId);
  const { error } = await db().from("post_media").delete().eq("id", mediaId);
  if (error) fail(error, "Não foi possível remover a arte.");
  await discard([media.storage_path]);
  const post = await loadPost(media.post_id);
  // Close the gap left in the carousel order.
  const compact = post.media.length
    ? await reorderPostMedia(
        post.id,
        post.media.map((m) => m.id),
      )
    : post;
  return syncFormat(compact);
}
