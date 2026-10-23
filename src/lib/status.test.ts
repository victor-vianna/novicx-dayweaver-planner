import { describe, expect, it } from "vitest";

import { getDisplayStatus } from "@/lib/status";

describe("getDisplayStatus", () => {
  const today = "2026-10-23";

  it("returns draft for drafts regardless of date", () => {
    expect(getDisplayStatus({ status: "draft", scheduled_date: "2026-10-01" }, today)).toBe(
      "draft",
    );
  });

  it("returns published for published posts regardless of date", () => {
    expect(getDisplayStatus({ status: "published", scheduled_date: "2026-11-01" }, today)).toBe(
      "published",
    );
  });

  it("returns pending for a ready post before today", () => {
    expect(getDisplayStatus({ status: "ready", scheduled_date: "2026-10-22" }, today)).toBe(
      "pending",
    );
  });

  it("returns ready on the scheduled day and in the future", () => {
    expect(getDisplayStatus({ status: "ready", scheduled_date: today }, today)).toBe("ready");
    expect(getDisplayStatus({ status: "ready", scheduled_date: "2026-10-24" }, today)).toBe(
      "ready",
    );
  });
});
