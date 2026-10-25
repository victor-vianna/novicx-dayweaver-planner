// Demo uploads: files stay in the browser as object URLs (lost on reload).
import { imageExtension, readImageSize, validateImageFile } from "@/lib/media-files";
import { clone, commit, delay, getDB, uid } from "@/mocks/store";
import type { PostMedia, PostWithMedia } from "@/types/domain";

import { recordEvent } from "./events";

function findPost(postId: string) {
  const post = getDB().posts.find((p) => p.id === postId);
  if (!post) throw new Error("Publicação não encontrada");
  return post;
}

function snapshot(postId: string): PostWithMedia {
  const db = getDB();
  const post = findPost(postId);
  const media = db.media
    .filter((m) => m.post_id === postId)
    .sort((a, b) => a.position - b.position);
  // Format follows the number of arts.
  post.format = media.length > 1 ? "carousel" : "single";
  media.forEach((m, i) => (m.position = i));
  commit();
  return clone({ ...post, media });
}

function assertValid(files: File[]) {
  for (const file of files) {
    const problem = validateImageFile(file);
    if (problem) throw new Error(problem);
  }
}

export async function uploadPostMedia(postId: string, files: File[]): Promise<PostWithMedia> {
  assertValid(files);
  await delay(300);
  const db = getDB();
  const post = findPost(postId);
  let position = db.media.filter((m) => m.post_id === postId).length;
  for (const file of files) {
    const { width, height } = await readImageSize(file);
    recordEvent(postId, "media_added", { position });
    db.media.push({
      id: uid("m"),
      post_id: postId,
      storage_path: `clients/${post.client_id}/posts/${postId}/${uid("f")}.${imageExtension(file.type)}`,
      url: URL.createObjectURL(file),
      position: position++,
      width,
      height,
    });
  }
  return snapshot(postId);
}

function findMedia(mediaId: string): PostMedia {
  const media = getDB().media.find((m) => m.id === mediaId);
  if (!media) throw new Error("Arte não encontrada");
  return media;
}

export async function replacePostMedia(mediaId: string, file: File): Promise<PostWithMedia> {
  assertValid([file]);
  await delay(300);
  const media = findMedia(mediaId);
  const { width, height } = await readImageSize(file);
  Object.assign(media, { url: URL.createObjectURL(file), width, height });
  recordEvent(media.post_id, "media_replaced", { position: media.position });
  return snapshot(media.post_id);
}

export async function removePostMedia(mediaId: string): Promise<PostWithMedia> {
  await delay(200);
  const db = getDB();
  const media = findMedia(mediaId);
  db.media = db.media.filter((m) => m.id !== mediaId);
  recordEvent(media.post_id, "media_removed", { position: media.position });
  return snapshot(media.post_id);
}

export async function reorderPostMedia(
  postId: string,
  orderedIds: string[],
): Promise<PostWithMedia> {
  await delay(160);
  const current = getDB().media.filter((m) => m.post_id === postId);
  if (current.length !== orderedIds.length || current.some((m) => !orderedIds.includes(m.id))) {
    throw new Error("Lista de artes não confere com a publicação");
  }
  for (const m of current) m.position = orderedIds.indexOf(m.id);
  return snapshot(postId);
}
