import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetDB } from "@/mocks/store";
import { getPost, listPosts, markPostPublished, unmarkPostPublished } from "@/services/posts";

async function settle<T>(promise: Promise<T>) {
  await vi.runAllTimersAsync();
  return promise;
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
});
