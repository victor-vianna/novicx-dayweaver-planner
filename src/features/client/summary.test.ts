import { describe, expect, it } from "vitest";

import { summarizeClientPosts } from "@/features/client/summary";
import type { ClientPackage, PostStatus, PostWithMedia } from "@/types/domain";

const today = "2026-10-23";

function makePackage(overrides: Partial<ClientPackage> = {}): ClientPackage {
  return {
    id: "pkg-active",
    client_id: "c-marina",
    plan_id: "plan-1",
    plan_name_snapshot: "Plano",
    posts_total: 4,
    start_date: "2026-10-01",
    end_date: "2026-10-30",
    status: "active",
    ...overrides,
  };
}

function makePost(
  id: string,
  status: PostStatus,
  scheduledDate: string,
  packageId = "pkg-active",
): PostWithMedia {
  return {
    id,
    client_id: "c-marina",
    client_package_id: packageId,
    format: "single",
    title: id,
    caption: null,
    scheduled_date: scheduledDate,
    scheduled_time: "10:00",
    status,
    published_at: status === "published" ? "2026-10-20T13:00:00.000Z" : null,
    published_by: status === "published" ? "client" : null,
    media: [],
  };
}

describe("summarizeClientPosts", () => {
  it("counts published, pending and ready posts", () => {
    const summary = summarizeClientPosts(
      [
        makePost("published", "published", "2026-10-20"),
        makePost("pending", "ready", "2026-10-22"),
        makePost("ready", "ready", today),
      ],
      [makePackage()],
      today,
    );

    expect(summary.published).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.ready).toBe(1);
    expect(summary.upcoming.map((post) => post.id)).toEqual(["pending", "ready"]);
  });

  it("reports zero progress for a package without posts", () => {
    const summary = summarizeClientPosts([], [makePackage()], today);

    expect(summary.usedInPackage).toBe(0);
    expect(summary.packageProgress).toBe(0);
  });

  it("guards progress when posts_total is zero", () => {
    const summary = summarizeClientPosts(
      [makePost("published", "published", "2026-10-20")],
      [makePackage({ posts_total: 0 })],
      today,
    );

    expect(summary.usedInPackage).toBe(1);
    expect(summary.packageProgress).toBe(0);
  });

  it("does not count posts from a previous package in current progress", () => {
    const summary = summarizeClientPosts(
      [
        makePost("previous", "published", "2026-09-20", "pkg-previous"),
        makePost("current", "published", "2026-10-20"),
      ],
      [makePackage({ posts_total: 2 })],
      today,
    );

    expect(summary.published).toBe(2);
    expect(summary.usedInPackage).toBe(1);
    expect(summary.packageProgress).toBe(50);
  });

  it("limits upcoming posts to the first four in the supplied order", () => {
    const posts = Array.from({ length: 5 }, (_, index) =>
      makePost(`post-${index + 1}`, "ready", `2026-10-${24 + index}`),
    );

    const summary = summarizeClientPosts(posts, [makePackage()], today);

    expect(summary.upcoming.map((post) => post.id)).toEqual([
      "post-1",
      "post-2",
      "post-3",
      "post-4",
    ]);
  });
});
