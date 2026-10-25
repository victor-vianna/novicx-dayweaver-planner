// File cleanup after deleting a draft: Storage reports failures in `error` and
// a denied remove as a shorter list, never by throwing.
import { beforeEach, describe, expect, it, vi } from "vitest";

const remove = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  getSupabase: () => ({ storage: { from: () => ({ remove }) } }),
}));

import { removeFiles } from "./posts";

beforeEach(() => remove.mockReset());

describe("supabase removeFiles", () => {
  const paths = ["clients/c/posts/p/1.jpg", "clients/c/posts/p/2.jpg"];

  it("reports nothing left when every file is removed", async () => {
    remove.mockResolvedValue({ data: paths.map((name) => ({ name })), error: null });
    expect(await removeFiles(paths)).toBe(0);
  });

  it("counts every file as left when Storage returns an error", async () => {
    remove.mockResolvedValue({ data: null, error: new Error("boom") });
    expect(await removeFiles(paths)).toBe(2);
  });

  it("counts files Storage silently did not remove", async () => {
    remove.mockResolvedValue({ data: [{ name: paths[0] }], error: null });
    expect(await removeFiles(paths)).toBe(1);
  });

  it("skips the call without files", async () => {
    expect(await removeFiles([])).toBe(0);
    expect(remove).not.toHaveBeenCalled();
  });
});
