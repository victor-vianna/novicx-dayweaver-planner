import { describe, expect, it } from "vitest";

import { emptyDraft, parseDraft, toDraft } from "./plan-form";

describe("parseDraft", () => {
  it("normalizes a valid draft", () => {
    const result = parseDraft({
      ...emptyDraft(),
      name: "  Essencial ",
      default_weekdays: [5, 1, 1],
      default_times: "18:30, 10:00, 10:00",
    });
    expect(result).toEqual({
      input: {
        name: "Essencial",
        posts_per_period: 4,
        period_days: 30,
        default_weekdays: [1, 5],
        default_times: ["10:00", "18:30"],
        active: true,
      },
    });
  });

  it.each([
    [{ name: " " }, /nome/],
    [{ posts_per_period: "0" }, /1 a 60/],
    [{ posts_per_period: "2.5" }, /1 a 60/],
    [{ period_days: "400" }, /1 a 365/],
    [{ default_weekdays: [] }, /dia da semana/],
    [{ default_times: "25:00" }, /HH:mm/],
    [{ default_times: " , " }, /HH:mm/],
  ])("rejects %o", (patch, message) => {
    const result = parseDraft({ ...emptyDraft(), name: "P", ...patch });
    expect("error" in result && result.error).toMatch(message);
  });

  it("round-trips a saved plan", () => {
    const plan = {
      name: "P",
      posts_per_period: 8,
      period_days: 30,
      default_weekdays: [2, 4] as (0 | 1 | 2 | 3 | 4 | 5 | 6)[],
      default_times: ["09:00", "17:00"],
      active: false,
    };
    expect(parseDraft(toDraft(plan))).toEqual({ input: plan });
  });
});
