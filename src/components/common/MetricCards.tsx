import { BarChart3, Home } from "lucide-react";

import { cn } from "@/lib/utils";

export function MetricCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Home;
  value: number;
  label: string;
  tone: "success" | "primary" | "warning";
}) {
  const tones = {
    success: "bg-success-soft text-success",
    primary: "bg-primary-soft text-primary-glow",
    warning: "bg-warning-soft text-warning",
  };
  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5 shadow-soft sm:p-5">
      <span className={cn("grid h-9 w-9 place-items-center rounded-xl", tones[tone])}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-4 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground sm:text-xs">
        {label}
      </p>
    </div>
  );
}

export function AdminMetric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Home;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary-glow">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <BarChart3 className="h-4 w-4 text-subtle-foreground" />
      </div>
      <p className="mt-5 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
