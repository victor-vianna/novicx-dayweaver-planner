import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { isMockMode } from "@/lib/data-source";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer rounded-xl", className)} aria-hidden />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fade-in flex flex-col items-center rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center",
        className,
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-4 text-[15px] font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="fade-in rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-6 text-center">
      <p className="text-sm font-semibold text-foreground">Não foi possível carregar agora.</p>
      <p className="mt-1 text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="pressable mt-4 h-10 rounded-lg bg-surface-2 px-4 text-sm font-semibold text-foreground hover:bg-surface-3"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{children}</h2>
      {action}
    </div>
  );
}

/** Only in mock mode: real data must never be labelled as fictitious. */
export function DemoTag({ className }: { className?: string }) {
  if (!isMockMode()) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
      Modo demonstração — dados fictícios
    </span>
  );
}
