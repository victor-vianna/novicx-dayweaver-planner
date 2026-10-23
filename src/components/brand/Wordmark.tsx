import { cn } from "@/lib/utils";

interface Props {
  variant?: "stacked" | "inline";
  className?: string;
}

export function Wordmark({ variant = "stacked", className }: Props) {
  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-baseline gap-2 leading-none", className)}>
        <span className="font-display text-[22px] font-semibold tracking-[0.14em] text-foreground">
          NOVICX
        </span>
        <span className="text-[13px] font-semibold tracking-[0.02em] text-primary-glow">
          Planner
        </span>
      </span>
    );
  }
  return (
    <span
      className={cn("inline-flex flex-col items-center leading-none", className)}
      aria-label="NOVICX Planner"
    >
      <span className="font-display text-[34px] font-semibold tracking-[0.2em] text-foreground">
        NOVICX
      </span>
      <span className="mt-2 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.42em] text-primary-glow">
        <span className="h-px w-6 bg-border-strong" aria-hidden />
        Planner
        <span className="h-px w-6 bg-border-strong" aria-hidden />
      </span>
    </span>
  );
}
