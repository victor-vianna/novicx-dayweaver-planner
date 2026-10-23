import { ImageOff, Layers } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { PostWithMedia } from "@/types/domain";

interface Props {
  post: Pick<PostWithMedia, "title" | "media" | "format">;
  className?: string;
  eager?: boolean;
  showCount?: boolean;
  rounded?: string;
}

/** Cover art in 4:5 with a gentle fade-in once loaded. */
export function PostArt({ post, className, eager, showCount = true, rounded = "rounded-2xl" }: Props) {
  const [loaded, setLoaded] = useState(false);
  const cover = post.media[0];
  return (
    <div className={cn("relative aspect-[4/5] overflow-hidden bg-surface-2", rounded, className)}>
      {cover ? (
        <img
          src={cover.url}
          alt={`Arte: ${post.title}`}
          width={cover.width}
          height={cover.height}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-subtle-foreground">
          <ImageOff className="h-5 w-5" aria-hidden />
          <span className="sr-only">Sem arte ainda</span>
        </div>
      )}
      {!loaded && cover && <div className="skeleton-shimmer absolute inset-0" aria-hidden />}
      {showCount && post.media.length > 1 && (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/75 px-2 py-1 text-[11px] font-semibold text-foreground backdrop-blur-sm">
          <Layers className="h-3 w-3" aria-hidden />
          {post.media.length}
        </span>
      )}
    </div>
  );
}
