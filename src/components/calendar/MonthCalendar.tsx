import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { StatusDot } from "@/components/post/StatusBadge";
import { formatLong, monthGrid, monthLabel, WEEKDAYS_SHORT, WEEKDAYS_INITIAL } from "@/lib/dates";
import { STATUS_SHORT_LABEL, type DisplayStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

export interface CalendarEntry {
  id: string;
  date: string;
  status: DisplayStatus;
}

interface Props {
  year: number;
  month: number;
  onMonthChange: (delta: -1 | 1) => void;
  selected: string | null;
  onSelect: (iso: string) => void;
  entries: CalendarEntry[];
  today: string;
  compact?: boolean;
  className?: string;
}

const ORDER: DisplayStatus[] = ["pending", "ready", "published", "draft"];

export function MonthCalendar({
  year,
  month,
  onMonthChange,
  selected,
  onSelect,
  entries,
  today,
  compact,
  className,
}: Props) {
  const [direction, setDirection] = useState<"left" | "right">("left");
  const touch = useRef<{ x: number; y: number } | null>(null);
  const cells = useMemo(() => monthGrid(year, month), [year, month]);

  const byDate = useMemo(() => {
    const map = new Map<string, DisplayStatus[]>();
    for (const e of entries) {
      const list = map.get(e.date) ?? [];
      list.push(e.status);
      map.set(e.date, list);
    }
    return map;
  }, [entries]);

  const change = (delta: -1 | 1) => {
    setDirection(delta === 1 ? "left" : "right");
    onMonthChange(delta);
  };

  // Hide the 6th row when it's entirely outside the month.
  const visible = cells.slice(35).some((c) => c.inMonth) ? cells : cells.slice(0, 35);

  return (
    <div className={cn("select-none", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => change(-1)}
          aria-label="Mês anterior"
          className="pressable grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-[15px]")} aria-live="polite">
          {monthLabel(year, month)}
        </p>
        <button
          type="button"
          onClick={() => change(1)}
          aria-label="Próximo mês"
          className="pressable grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center" aria-hidden>
        {WEEKDAYS_SHORT.map((w, i) => (
          <span key={w} className="pb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle-foreground">
            <span className="sm:hidden">{compact ? WEEKDAYS_INITIAL[i] : w}</span>
            <span className="hidden sm:inline">{w}</span>
          </span>
        ))}
      </div>

      <div
        key={`${year}-${month}`}
        className={cn("grid grid-cols-7 gap-y-1", direction === "left" ? "slide-left" : "slide-right")}
        role="grid"
        aria-label={monthLabel(year, month)}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) touch.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const t = e.changedTouches[0];
          if (!t) return;
          const dx = t.clientX - touch.current.x;
          const dy = t.clientY - touch.current.y;
          touch.current = null;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) change(dx < 0 ? 1 : -1);
        }}
      >
        {visible.map((cell) => {
          const statuses = byDate.get(cell.iso) ?? [];
          const unique = ORDER.filter((s) => statuses.includes(s));
          const isSelected = selected === cell.iso;
          const isToday = today === cell.iso;
          const label = `${formatLong(cell.iso)}${
            statuses.length
              ? `, ${statuses.length} ${statuses.length > 1 ? "publicações" : "publicação"}: ${unique
                  .map((s) => STATUS_SHORT_LABEL[s])
                  .join(", ")}`
              : ""
          }`;
          return (
            <div key={cell.iso} role="gridcell" className="flex justify-center">
              <button
                type="button"
                onClick={() => onSelect(cell.iso)}
                aria-label={label}
                aria-pressed={isSelected}
                className={cn(
                  "pressable relative flex flex-col items-center justify-center rounded-xl font-medium tabular-nums",
                  compact ? "h-10 w-10 text-[13px]" : "h-12 w-full max-w-14 text-sm sm:h-14",
                  !cell.inMonth && "text-subtle-foreground/50",
                  cell.inMonth && !isSelected && "text-foreground hover:bg-surface-2",
                  isSelected && "bg-primary text-primary-foreground shadow-glow",
                  isToday && !isSelected && "ring-1 ring-inset ring-primary/60",
                )}
              >
                <span>{cell.day}</span>
                <span className="mt-1 flex h-1.5 items-center gap-[3px]">
                  {unique.slice(0, 3).map((s) => (
                    <StatusDot
                      key={s}
                      status={s}
                      className={cn(isSelected && "bg-primary-foreground border-primary-foreground")}
                    />
                  ))}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarLegend({ includeDraft, className }: { includeDraft?: boolean; className?: string }) {
  const items: DisplayStatus[] = includeDraft ? ["ready", "pending", "published", "draft"] : ["ready", "pending", "published"];
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)} aria-label="Legenda do calendário">
      {items.map((s) => (
        <li key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <StatusDot status={s} className="h-2 w-2" />
          {STATUS_SHORT_LABEL[s]}
        </li>
      ))}
    </ul>
  );
}
