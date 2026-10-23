import { describe, expect, it } from "vitest";

import {
  addDays,
  diffDays,
  formatLong,
  formatNumeric,
  isValidISO,
  isValidTime,
  monthGrid,
  relativeDayLabel,
  shiftMonth,
  todayISO,
} from "@/lib/dates";

describe("date helpers", () => {
  it("uses the America/Sao_Paulo calendar day", () => {
    expect(todayISO(new Date("2026-10-24T02:30:00Z"))).toBe("2026-10-23");
  });

  it("adds days across month, year and leap-day boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("calculates signed differences in calendar days", () => {
    expect(diffDays("2026-11-02", "2026-10-30")).toBe(3);
    expect(diffDays("2026-10-30", "2026-11-02")).toBe(-3);
  });

  it("shifts months across year boundaries", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ y: 2027, m: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ y: 2025, m: 12 });
  });

  it("builds a six-week Sunday-first month grid", () => {
    const grid = monthGrid(2026, 10);

    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ iso: "2026-09-27", day: 27, inMonth: false });
    expect(grid[41]).toEqual({ iso: "2026-11-07", day: 7, inMonth: false });
    expect(grid.filter((cell) => cell.inMonth)).toHaveLength(31);
  });

  it("formats long and numeric dates", () => {
    expect(formatLong("2026-10-14")).toBe("14 de outubro de 2026");
    expect(formatNumeric("2026-10-04")).toBe("04/10/2026");
  });

  it("labels only yesterday, today and tomorrow", () => {
    expect(relativeDayLabel("2026-10-22", "2026-10-23")).toBe("Ontem");
    expect(relativeDayLabel("2026-10-23", "2026-10-23")).toBe("Hoje");
    expect(relativeDayLabel("2026-10-24", "2026-10-23")).toBe("Amanhã");
    expect(relativeDayLabel("2026-10-25", "2026-10-23")).toBeNull();
  });

  it("validates ISO calendar dates", () => {
    expect(isValidISO("2024-02-29")).toBe(true);
    expect(isValidISO("2026-02-29")).toBe(false);
    expect(isValidISO("2026-13-01")).toBe(false);
    expect(isValidISO("26-10-01")).toBe(false);
  });

  it("validates 24-hour times", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("9:30")).toBe(false);
  });
});
