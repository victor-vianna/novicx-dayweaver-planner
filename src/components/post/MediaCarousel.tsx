import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { PostMedia } from "@/types/domain";

interface Props {
  media: Pick<PostMedia, "id" | "url" | "width" | "height">[];
  title: string;
  onIndexChange?: (index: number) => void;
  className?: string;
  showThumbs?: boolean;
}

/** Swipeable 4:5 viewer with dots, counter and (on larger screens) arrows + thumbnails. */
export function MediaCarousel({ media, title, onIndexChange, className, showThumbs }: Props) {
  const [ref, api] = useEmblaCarousel({ loop: false, align: "center" });
  const [index, setIndex] = useState(0);
  const total = media.length;

  const onSelect = useCallback(() => {
    if (!api) return;
    const i = api.selectedScrollSnap();
    setIndex(i);
    onIndexChange?.(i);
  }, [api, onIndexChange]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api, onSelect]);

  useEffect(() => {
    api?.reInit();
  }, [api, total]);

  if (total === 0) {
    return (
      <div
        className={cn(
          "grid aspect-[4/5] place-items-center rounded-2xl border border-dashed border-border-strong bg-surface text-subtle-foreground",
          className,
        )}
      >
        <div className="flex flex-col items-center gap-2 text-sm">
          <ImageOff className="h-5 w-5" aria-hidden />
          Nenhuma arte adicionada
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        className="group relative"
        role="region"
        aria-roledescription="carrossel"
        aria-label={`Artes de ${title}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") api?.scrollPrev();
          if (e.key === "ArrowRight") api?.scrollNext();
        }}
      >
        <div className="overflow-hidden rounded-2xl bg-surface-2" ref={ref}>
          <div className="flex touch-pan-y">
            {media.map((m, i) => (
              <div
                key={m.id}
                className="relative aspect-[4/5] min-w-0 shrink-0 grow-0 basis-full"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} de ${total}`}
              >
                <img
                  src={m.url}
                  alt={total > 1 ? `${title} — arte ${i + 1} de ${total}` : `Arte: ${title}`}
                  width={m.width}
                  height={m.height}
                  loading={i === 0 ? "eager" : "lazy"}
                  draggable={false}
                  className="h-full w-full select-none object-cover"
                />
              </div>
            ))}
          </div>
        </div>

        {total > 1 && (
          <>
            <span className="absolute right-3 top-3 rounded-full bg-background/75 px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground backdrop-blur-sm">
              {index + 1}/{total}
            </span>
            <button
              type="button"
              onClick={() => api?.scrollPrev()}
              disabled={index === 0}
              aria-label="Arte anterior"
              className="pressable absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/75 text-foreground backdrop-blur-sm hover:bg-background disabled:opacity-0 md:grid"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => api?.scrollNext()}
              disabled={index === total - 1}
              aria-label="Próxima arte"
              className="pressable absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/75 text-foreground backdrop-blur-sm hover:bg-background disabled:opacity-0 md:grid"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
          {media.map((m, i) => (
            <span
              key={m.id}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                i === index ? "w-5 bg-primary-glow" : "w-1.5 bg-surface-3",
              )}
            />
          ))}
        </div>
      )}

      {showThumbs && total > 1 && (
        <div className="mt-3 hidden grid-cols-5 gap-2 md:grid">
          {media.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => api?.scrollTo(i)}
              aria-label={`Ver arte ${i + 1}`}
              className={cn(
                "pressable aspect-[4/5] overflow-hidden rounded-lg border-2",
                i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <img src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
