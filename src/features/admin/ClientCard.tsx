import { ChevronRight } from "lucide-react";

import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import type { Client, ClientPackage } from "@/types/domain";

export function ClientCard({
  client,
  pkg,
  onPreview,
  expanded,
}: {
  client: Client;
  pkg?: ClientPackage | undefined;
  onPreview: () => void;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPreview}
      className={cn(
        "pressable group w-full rounded-2xl border border-border bg-surface p-4 text-left shadow-soft hover:border-primary/35 hover:bg-surface-2",
        expanded && "p-5",
      )}
    >
      <div className="flex items-center gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-xs font-bold text-primary-glow">
          {initials(client.business_name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{client.business_name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{client.profession}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-subtle-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary-glow" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px]">
        <span className="truncate text-muted-foreground">
          {pkg?.plan_name_snapshot ?? "Sem pacote ativo"}
        </span>
        <span
          className={cn(
            "ml-3 shrink-0 rounded-full px-2 py-1 font-semibold",
            pkg ? "bg-success-soft text-success" : "bg-surface-3 text-muted-foreground",
          )}
        >
          {pkg ? "Ativo" : "Inativo"}
        </span>
      </div>
    </button>
  );
}
