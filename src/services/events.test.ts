// Mock-mode history: the same events the database triggers write (T7).
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEMO_ACCOUNTS } from "@/mocks/seed";
import { getDB, resetDB } from "@/mocks/store";

import { listPostEvents } from "./events";
import { removePostMedia, reorderPostMedia, replacePostMedia, uploadPostMedia } from "./media";
import { createPost, deletePost, markPostPublished, updatePost } from "./posts";

vi.mock("@/mocks/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/mocks/store")>()),
  delay: async () => {},
}));
vi.mock("@/lib/media-files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/media-files")>()),
  readImageSize: async () => ({ width: 1080, height: 1350 }),
}));

const jpeg = () => new File(["x"], "a.jpg", { type: "image/jpeg" });
const kinds = async (postId: string) => (await listPostEvents(postId)).map((e) => e.kind);

beforeEach(() => {
  resetDB();
  URL.createObjectURL = () => "blob:test";
});

async function newDraft() {
  return createPost({
    clientId: "c-marina",
    packageId: "pkg-marina",
    scheduledDate: "2026-10-05",
    scheduledTime: "10:00",
    title: "Histórico",
  });
}

describe("mock post history", () => {
  it("records each relevant change once, with the actor", async () => {
    const post = await newDraft();
    expect(await kinds(post.id)).toEqual(["created"]);

    const withArt = await uploadPostMedia(post.id, [jpeg(), jpeg()]);
    await updatePost(post.id, { status: "ready" });
    await updatePost(post.id, { title: "Outro título", caption: "Legenda" });
    await updatePost(post.id, { scheduled_date: "2026-10-06", scheduled_time: "11:30" });
    await replacePostMedia(withArt.media[0]!.id, jpeg());
    await reorderPostMedia(post.id, [withArt.media[1]!.id, withArt.media[0]!.id]);
    await updatePost(post.id, { status: "ready" });
    expect(await kinds(post.id)).toEqual([
      "created",
      "media_added",
      "media_added",
      "status",
      "schedule",
      "media_replaced",
    ]);

    const events = await listPostEvents(post.id);
    expect(events[3]!.detail).toMatchObject({ from: "draft", to: "ready" });
    expect(events[4]!.detail).toEqual({
      from_date: "2026-10-05",
      from_time: "10:00",
      to_date: "2026-10-06",
      to_time: "11:30",
    });
    expect(events.every((e) => e.actor_role === "admin")).toBe(true);
    expect(events[0]!.actor_id).toBe(DEMO_ACCOUNTS.admin.profileId);

    await markPostPublished(post.id, { role: "client", clientId: "c-marina" });
    const last = (await listPostEvents(post.id)).at(-1)!;
    expect(last).toMatchObject({
      kind: "status",
      actor_role: "client",
      actor_id: DEMO_ACCOUNTS.client.profileId,
      detail: { from: "ready", to: "published", published_by: "client" },
    });
  });

  it("records removed arts and drops the history of a deleted draft", async () => {
    const post = await newDraft();
    const withArt = await uploadPostMedia(post.id, [jpeg()]);
    await removePostMedia(withArt.media[0]!.id);
    expect((await kinds(post.id)).at(-1)).toBe("media_removed");
    await deletePost(post.id);
    expect(await listPostEvents(post.id)).toEqual([]);
    expect((getDB().events ?? []).some((e) => e.post_id === post.id)).toBe(false);
  });

  it("works with a saved demo session that has no history yet", async () => {
    delete getDB().events;
    const post = await newDraft();
    expect(await kinds(post.id)).toEqual(["created"]);
  });
});
