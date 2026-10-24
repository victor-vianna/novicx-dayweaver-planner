// Upload failure path: the object sent to Storage must be removed when the
// post_media row cannot be written (no orphan left behind).
import { beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn();
const remove = vi.fn();
const insert = vi.fn();

const postRow = {
  id: "post-1",
  client_id: "client-1",
  client_package_id: "pkg-1",
  format: "single",
  title: "T",
  caption: null,
  scheduled_date: "2026-10-23",
  scheduled_time: "10:00:00",
  status: "draft",
  published_at: null,
  published_by: null,
  post_media: [],
};

// Minimal chainable stand-in for the query builder.
function select() {
  const chain = {
    eq: () => chain,
    maybeSingle: async () => ({ data: postRow, error: null }),
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  getSupabase: () => ({
    from: (table: string) =>
      table === "post_media" ? { insert } : { select, update: () => ({ eq: async () => ({}) }) },
    storage: {
      from: () => ({ upload, remove, createSignedUrls: async () => ({ data: [], error: null }) }),
    },
  }),
}));

const { uploadPostMedia } = await import("./media");

describe("supabase uploadPostMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("createImageBitmap", async () => ({ width: 10, height: 10, close() {} }));
    upload.mockResolvedValue({ data: {}, error: null });
    remove.mockResolvedValue({ data: [], error: null });
  });

  it("removes the uploaded object when the row insert fails", async () => {
    insert.mockResolvedValue({ error: { message: "insert failed" } });
    const file = new File([new Uint8Array(4)], "a.jpg", { type: "image/jpeg" });

    await expect(uploadPostMedia("post-1", [file])).rejects.toThrow();

    const path = upload.mock.calls[0]![0] as string;
    expect(path).toMatch(/^clients\/client-1\/posts\/post-1\/[0-9a-f-]{36}\.jpg$/);
    expect(remove).toHaveBeenCalledWith([path]);
  });

  it("does not upload files with an unsupported type", async () => {
    const file = new File(["x"], "a.gif", { type: "image/gif" });

    await expect(uploadPostMedia("post-1", [file])).rejects.toThrow("não é JPG");
    expect(upload).not.toHaveBeenCalled();
  });
});
