import { cva } from "class-variance-authority";

import { STATUS_LABEL, STATUS_SHORT_LABEL, type DisplayStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

const badge = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-none",
  {
    variants: {
      status: {
        ready: "bg-primary-soft text-primary-glow",
        pending: "bg-warning-soft text-warning",
        published: "bg-success-soft text-success",
        draft: "border border-dashed border-border-strong bg-draft-soft text-draft",
      },
    },
  },
);

const dot = cva("inline-block shrink-0 rounded-full", {
  variants: {
    status: {
      ready: "bg-primary-glow",
      pending: "bg-warning",
      published: "bg-success",
      draft: "border border-draft bg-transparent",
    },
  },
});

export function StatusBadge({
  status,
  short,
  className,
}: {
  status: DisplayStatus;
  short?: boolean;
  className?: string;
}) {
  return (
    <span className={cn(badge({ status }), className)}>
      <span className={cn(dot({ status }), "h-1.5 w-1.5")} aria-hidden />
      {short ? STATUS_SHORT_LABEL[status] : STATUS_LABEL[status]}
    </span>
  );
}

export function StatusDot({ status, className }: { status: DisplayStatus; className?: string }) {
  return <span className={cn(dot({ status }), "h-1.5 w-1.5", className)} aria-hidden />;
}
