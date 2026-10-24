import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { moveItem } from "@/features/admin/delivery/order";
import { validateImageFile } from "@/lib/media-files";
import { resetDB } from "@/mocks/store";
import {
  removePostMedia,
  reorderPostMedia,
  replacePostMedia,
  uploadPostMedia,
} from "@/services/media";
import { getPost } from "@/services/posts";

async function settle<T>(promise: Promise<T>) {
  await vi.runAllTimersAsync();
  return promise;
}

const jpg = (name: string, size = 1000) =>
  new File([new Uint8Array(size)], name, { type: "image/jpeg" });

describe("media service (mock)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    resetDB();
    vi.useFakeTimers();
    vi.stubGlobal("createImageBitmap", async () => ({ width: 1080, height: 1350, close() {} }));
    URL.createObjectURL = vi.fn(() => "blob:test");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uploads a carousel to an empty draft and switches the format", async () => {
    const post = await settle(uploadPostMedia("p-m-7", [jpg("a.jpg"), jpg("b.jpg")]));

    expect(post.media.map((m) => m.position)).toEqual([0, 1]);
    expect(post.media[0]).toMatchObject({ width: 1080, height: 1350 });
    expect(post.format).toBe("carousel");
  });

  it("rejects unsupported files before uploading", async () => {
    const gif = new File(["x"], "a.gif", { type: "image/gif" });
    await expect(uploadPostMedia("p-m-7", [gif])).rejects.toThrow("não é JPG, PNG ou WebP");
  });

  it("reorders, replaces and removes arts keeping positions compact", async () => {
    const before = await settle(getPost("p-m-2", { includeDrafts: true }));
    const ids = before!.media.map((m) => m.id);

    const reordered = await settle(reorderPostMedia("p-m-2", [ids[2]!, ids[0]!, ids[1]!]));
    expect(reordered.media.map((m) => m.id)).toEqual([ids[2], ids[0], ids[1]]);

    const replaced = await settle(replacePostMedia(ids[0]!, jpg("novo.jpg")));
    expect(replaced.media.find((m) => m.id === ids[0])?.url).toBe("blob:test");

    const removed = await settle(removePostMedia(ids[2]!));
    expect(removed.media.map((m) => m.position)).toEqual([0, 1]);

    const single = await settle(removePostMedia(ids[1]!));
    expect(single.format).toBe("single");
  });
});

describe("upload helpers", () => {
  it("validates type and size", () => {
    expect(validateImageFile({ name: "a.png", type: "image/png", size: 10 })).toBeNull();
    expect(
      validateImageFile({ name: "a.jpg", type: "image/jpeg", size: 16 * 1024 * 1024 }),
    ).toMatch("15 MB");
  });

  it("moves items within bounds", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});
