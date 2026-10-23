import { addDays, diffDays, weekday } from "@/lib/dates";
import type { Weekday } from "@/types/domain";

export interface Slot {
  date: string;
  time: string;
}

interface DistributeInput {
  startDate: string;
  endDate: string;
  count: number;
  weekdays: Weekday[];
  times: string[];
}

/**
 * Spreads `count` posts evenly across the allowed weekdays between start and end
 * (inclusive). Pure and deterministic — no AI, no randomness.
 * When there are enough allowed days, no day receives two posts.
 */
export function distributeSlots({
  startDate,
  endDate,
  count,
  weekdays,
  times,
}: DistributeInput): Slot[] {
  if (count <= 0) return [];
  const span = diffDays(endDate, startDate);
  if (span < 0) return [];

  const allowed = new Set<number>(weekdays.length ? weekdays : [0, 1, 2, 3, 4, 5, 6]);
  const days: string[] = [];
  for (let i = 0; i <= span; i++) {
    const iso = addDays(startDate, i);
    if (allowed.has(weekday(iso))) days.push(iso);
  }
  if (days.length === 0) return [];

  const safeTimes = times.length ? times : ["10:00"];
  const slots: Slot[] = [];

  if (count <= days.length) {
    for (let i = 0; i < count; i++) {
      const idx = Math.floor((i * days.length) / count);
      slots.push({ date: days[idx]!, time: safeTimes[i % safeTimes.length]! });
    }
  } else {
    // More posts than allowed days: cycle through days, rotating times.
    for (let i = 0; i < count; i++) {
      const dayIdx = i % days.length;
      const round = Math.floor(i / days.length);
      slots.push({ date: days[dayIdx]!, time: safeTimes[round % safeTimes.length]! });
    }
    slots.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }
  return slots;
}

/** End date of a package: start + period − 1 day. */
export function packageEndDate(startDate: string, periodDays: number) {
  return addDays(startDate, Math.max(1, periodDays) - 1);
}
