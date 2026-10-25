import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DRAFT_ONLY, NEEDS_ART } from "@/lib/status";
import { getDB, resetDB } from "@/mocks/store";
import {
  deletePost,
  getPost,
  listPosts,
  markPostPublished,
  unmarkPostPublished,
  updatePost,
} from "@/services/posts";

async function settle<T>(promise: Promise<T>) {
  await vi.runAllTimersAsync();
  return promise;
}

async function settleRejection(promise: Promise<unknown>, message: string) {
  const assertion = expect(promise).rejects.toThrow(message);
  await vi.runAllTimersAsync();
  await assertion;
}

describe("post service authorization", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    resetDB();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never lists drafts for the client portal", async () => {
    const posts = await settle(listPosts({ clientId: "c-marina" }));

    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((post) => post.status !== "draft")).toBe(true);
  });

  it("hides a post requested with another client id", async () => {
    const post = await settle(getPost("p-r-2", { clientId: "c-marina" }));

    expect(post).toBeNull();
  });

  it("lets the owning client mark a post as published", async () => {
    const post = await settle(markPostPublished("p-m-3", { role: "client", clientId: "c-marina" }));

    expect(post.status).toBe("published");
    expect(post.published_at).not.toBeNull();
    expect(post.published_by).toBe("client");
  });

  it("does not reveal a post owned by another client", async () => {
    const attempt = markPostPublished("p-r-2", {
      role: "client",
      clientId: "c-marina",
    });
    const assertion = expect(attempt).rejects.toThrow("Publicação não encontrada");

    await vi.runAllTimersAsync();
    await assertion;
  });

  it("blocks publishing drafts for every role", async () => {
    const attempt = markPostPublished("p-m-7", { role: "admin" });
    const assertion = expect(attempt).rejects.toThrow("Esta publicação ainda não está disponível");

    await vi.runAllTimersAsync();
    await assertion;
  });

  it("records an admin as the publisher while previewing", async () => {
    const post = await settle(markPostPublished("p-r-2", { role: "admin" }));

    expect(post.status).toBe("published");
    expect(post.published_by).toBe("admin");
  });

  it("unmarks a publication and clears its audit fields", async () => {
    const post = await settle(
      unmarkPostPublished("p-m-1", { role: "client", clientId: "c-marina" }),
    );

    expect(post.status).toBe("ready");
    expect(post.published_at).toBeNull();
    expect(post.published_by).toBeNull();
  });

  it("does not turn a draft into a ready post when unmarking", async () => {
    const attempt = unmarkPostPublished("p-m-7", { role: "admin" });
    const assertion = expect(attempt).rejects.toThrow("Esta publicação ainda não está disponível");

    await vi.runAllTimersAsync();
    await assertion;
  });

  // T6: same rules as admin_set_post_status and the draft-only delete policy.
  describe("admin status and delete", () => {
    // The seed has no draft with art: give one two arts.
    const draftWithArt = () => {
      const post = draftWithoutArt();
      for (const position of [0, 1]) {
        getDB().media.push({
          id: `m-test-${position}`,
          post_id: post.id,
          storage_path: `clients/${post.client_id}/posts/${post.id}/${position}.jpg`,
          url: "/x.jpg",
          position,
          width: 1080,
          height: 1350,
        });
      }
      return post;
    };
    const draftWithoutArt = () =>
      getDB().posts.find(
        (p) => p.status === "draft" && !getDB().media.some((m) => m.post_id === p.id),
      )!;

    it("refuses to release a post without art", async () => {
      const post = draftWithoutArt();
      await settleRejection(updatePost(post.id, { status: "ready" }), NEEDS_ART);
      expect(getDB().posts.find((p) => p.id === post.id)!.status).toBe("draft");
    });

    it("derives the format from the arts and keeps the original publication record", async () => {
      const post = draftWithArt();
      const published = await settle(updatePost(post.id, { status: "published" }));
      expect(published.format).toBe("carousel");
      expect(published.published_by).toBe("admin");
      getDB().posts.find((p) => p.id === post.id)!.published_at = "2026-01-01T00:00:00.000Z";
      const again = await settle(
        updatePost(post.id, { title: "Novo título", status: "published" }),
      );
      expect(again.published_at).toBe("2026-01-01T00:00:00.000Z");
      expect(again.title).toBe("Novo título");
    });

    it("deletes only drafts, with their arts", async () => {
      const draft = draftWithArt();
      const ready = getDB().posts.find((p) => p.status !== "draft")!;
      await settleRejection(deletePost(ready.id), DRAFT_ONLY);
      expect(getDB().posts.some((p) => p.id === ready.id)).toBe(true);
      await settle(deletePost(draft.id));
      expect(getDB().posts.some((p) => p.id === draft.id)).toBe(false);
      expect(getDB().media.some((m) => m.post_id === draft.id)).toBe(false);
    });
  });
});
