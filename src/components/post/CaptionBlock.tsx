import { Check, Copy, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { copyText } from "@/lib/share";
import { cn } from "@/lib/utils";

export function useCopyCaption() {
  const [copied, setCopied] = useState(false);
  const copy = async (caption: string) => {
    try {
      await copyText(caption);
      setCopied(true);
      toast.success("Legenda copiada");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  };
  return { copied, copy };
}

export function CaptionBlock({
  caption,
  className,
}: {
  caption: string | null;
  className?: string;
}) {
  const { copied, copy } = useCopyCaption();

  if (!caption) {
    return (
      <section
        className={cn("rounded-2xl border border-border bg-surface p-4", className)}
        aria-label="Legenda"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
            <FileText className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Sem legenda nesta publicação</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              A legenda não faz parte deste conteúdo. Use o seu próprio texto ao publicar.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn("rounded-2xl border border-border bg-surface", className)}
      aria-label="Legenda"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Legenda</h2>
        <button
          type="button"
          onClick={() => copy(caption)}
          className={cn(
            "pressable inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold",
            copied
              ? "bg-success-soft text-success"
              : "bg-primary-soft text-primary-glow hover:bg-primary/25",
          )}
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          {copied ? "Copiada" : "Copiar legenda"}
        </button>
      </div>
      <p className="whitespace-pre-line px-4 py-4 text-[14.5px] leading-relaxed text-foreground/90">
        {caption}
      </p>
    </section>
  );
}
