import { describe, expect, it } from "vitest";

import { distributeSlots, packageEndDate } from "@/lib/scheduling";

describe("distributeSlots", () => {
  it("returns no slots for a non-positive count", () => {
    expect(
      distributeSlots({
        startDate: "2026-10-19",
        endDate: "2026-10-25",
        count: 0,
        weekdays: [],
        times: [],
      }),
    ).toEqual([]);
  });

  it("returns no slots for an inverted interval", () => {
    expect(
      distributeSlots({
        startDate: "2026-10-25",
        endDate: "2026-10-19",
        count: 1,
        weekdays: [],
        times: [],
      }),
    ).toEqual([]);
  });

  it("returns no slots when the interval has no allowed weekdays", () => {
    expect(
      distributeSlots({
        startDate: "2026-10-19",
        endDate: "2026-10-23",
        count: 2,
        weekdays: [0],
        times: ["09:00"],
      }),
    ).toEqual([]);
  });

  it("spreads posts without repeating a day when enough days exist", () => {
    const slots = distributeSlots({
      startDate: "2026-10-19",
      endDate: "2026-10-25",
      count: 3,
      weekdays: [],
      times: ["09:00", "15:00"],
    });

    expect(slots).toEqual([
      { date: "2026-10-19", time: "09:00" },
      { date: "2026-10-21", time: "15:00" },
      { date: "2026-10-23", time: "09:00" },
    ]);
    expect(new Set(slots.map((slot) => slot.date)).size).toBe(slots.length);
  });

  it("cycles days and rotates times while keeping chronological order", () => {
    const slots = distributeSlots({
      startDate: "2026-10-19",
      endDate: "2026-10-20",
      count: 5,
      weekdays: [1, 2],
      times: ["09:00", "15:00"],
    });

    expect(slots).toEqual([
      { date: "2026-10-19", time: "09:00" },
      { date: "2026-10-19", time: "09:00" },
      { date: "2026-10-19", time: "15:00" },
      { date: "2026-10-20", time: "09:00" },
      { date: "2026-10-20", time: "15:00" },
    ]);
  });

  it("treats empty weekdays as every day and empty times as 10:00", () => {
    expect(
      distributeSlots({
        startDate: "2026-10-23",
        endDate: "2026-10-23",
        count: 1,
        weekdays: [],
        times: [],
      }),
    ).toEqual([{ date: "2026-10-23", time: "10:00" }]);
  });
});

describe("packageEndDate", () => {
  it.each([
    [0, "2026-10-23"],
    [1, "2026-10-23"],
    [30, "2026-11-21"],
  ])("uses an inclusive period of %i days", (periodDays, expected) => {
    expect(packageEndDate("2026-10-23", periodDays)).toBe(expected);
  });
});
