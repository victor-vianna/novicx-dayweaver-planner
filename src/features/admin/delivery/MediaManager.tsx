// Arts of one post: add (one or many), replace, remove and reorder.
import { ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/media-files";
import type { PostMedia } from "@/types/domain";

import { moveItem } from "./order";

const ACCEPT = ACCEPTED_IMAGE_TYPES.join(",");

interface Props {
  media: PostMedia[];
  busy: boolean;
  onAdd: (files: File[]) => void;
  onReplace: (mediaId: string, file: File) => void;
  onRemove: (mediaId: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function MediaManager({ media, busy, onAdd, onReplace, onRemove, onReorder }: Props) {
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replacing = useRef<string | null>(null);
  const ids = media.map((m) => m.id);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground">
          Artes {media.length > 1 ? `· carrossel com ${media.length}` : ""}
        </p>
        {busy && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Enviando…
          </span>
        )}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {media.map((item, index) => (
          <li key={item.id} className="overflow-hidden rounded-xl border border-border bg-surface">
            <img
              src={item.url}
              alt={`Arte ${index + 1}`}
              className="aspect-[4/5] w-full object-cover"
              loading="lazy"
            />
            <div className="flex items-center justify-between gap-1 p-1.5">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Mover arte ${index + 1} para a esquerda`}
                disabled={busy || index === 0}
                onClick={() => onReorder(moveItem(ids, index, index - 1))}
              >
                <ArrowLeft />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Substituir arte ${index + 1}`}
                disabled={busy}
                onClick={() => {
                  replacing.current = item.id;
                  replaceInput.current?.click();
                }}
              >
                <RefreshCw />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Remover arte ${index + 1}`}
                disabled={busy}
                onClick={() => onRemove(item.id)}
              >
                <Trash2 />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Mover arte ${index + 1} para a direita`}
                disabled={busy || index === media.length - 1}
                onClick={() => onReorder(moveItem(ids, index, index + 1))}
              >
                <ArrowRight />
              </Button>
            </div>
          </li>
        ))}
        <li>
          <button
            type="button"
            disabled={busy}
            onClick={() => addInput.current?.click()}
            className="grid aspect-[4/5] w-full place-items-center rounded-xl border border-dashed border-border-strong bg-surface/60 text-center text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-primary-glow disabled:opacity-50"
          >
            <span className="flex flex-col items-center gap-2 px-2">
              <ImagePlus className="h-6 w-6" />
              {media.length ? "Adicionar artes" : "Enviar arte ou carrossel"}
              <span className="font-normal">JPG, PNG ou WebP · até 15 MB</span>
            </span>
          </button>
        </li>
      </ul>

      <input
        ref={addInput}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) onAdd(files);
        }}
      />
      <input
        ref={replaceInput}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file && replacing.current) onReplace(replacing.current, file);
          replacing.current = null;
        }}
      />
    </div>
  );
}
