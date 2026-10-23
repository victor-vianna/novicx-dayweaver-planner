import { useEffect, useState } from "react";
import { toast } from "sonner";

import { mediaFilename, prepareFiles, saveImages, saveResultMessage, slugify, type ShareItem } from "@/lib/share";
import type { PostWithMedia } from "@/types/domain";

export function shareItemsFor(post: Pick<PostWithMedia, "title" | "media">): ShareItem[] {
  return post.media.map((m, i) => ({ url: m.url, filename: mediaFilename(post.title, i, post.media.length) }));
}

/** Save one/all images of a post with share-sheet → zip → download fallbacks. */
export function useSaveArt(post: Pick<PostWithMedia, "title" | "media"> | null | undefined) {
  const [busy, setBusy] = useState<"one" | "all" | null>(null);

  useEffect(() => {
    if (post?.media.length) prepareFiles(shareItemsFor(post));
  }, [post]);

  const run = async (items: ShareItem[], kind: "one" | "all") => {
    if (!post || items.length === 0) return;
    setBusy(kind);
    try {
      const result = await saveImages(items, { zipName: `${slugify(post.title) || "artes"}.zip` });
      const msg = saveResultMessage(result, items.length);
      if (msg) toast.success(msg);
    } catch {
      toast.error("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setBusy(null);
    }
  };

  return {
    busy,
    saveOne: (index: number) => post && run([shareItemsFor(post)[index]].filter(Boolean), "one"),
    saveAll: () => post && run(shareItemsFor(post), "all"),
  };
}
