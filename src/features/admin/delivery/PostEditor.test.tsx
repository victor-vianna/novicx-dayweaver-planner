// Post editor in mock mode: only a draft offers "Excluir rascunho", and the
// deletion asks for confirmation first.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDB, resetDB } from "@/mocks/store";
import type { PostWithMedia } from "@/types/domain";

import { PostEditor } from "./PostEditor";

vi.mock("@/mocks/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/mocks/store")>()),
  delay: async () => {},
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderEditor(status: "draft" | "ready", onClose = vi.fn()) {
  const row = getDB().posts.find((p) => p.status === status)!;
  const post: PostWithMedia = {
    ...row,
    media: getDB().media.filter((m) => m.post_id === row.id),
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <PostEditor post={post} clientId={post.client_id} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { post, onClose };
}

beforeEach(() => resetDB());

describe("PostEditor", () => {
  it("offers no delete for a released post", () => {
    renderEditor("ready");
    expect(screen.queryByRole("button", { name: /Excluir rascunho/ })).toBeNull();
  });

  it("deletes a draft after confirmation", async () => {
    const { post, onClose } = renderEditor("draft");
    fireEvent.click(screen.getByRole("button", { name: /Excluir rascunho/ }));
    expect(getDB().posts.some((p) => p.id === post.id)).toBe(true);
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(getDB().posts.some((p) => p.id === post.id)).toBe(false);
  });
});
