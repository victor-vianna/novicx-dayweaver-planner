import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTogglePublished } from "@/features/client/queries";
import { markPostPublished } from "@/services/posts";
import type { PostWithMedia } from "@/types/domain";
import { toast } from "sonner";

vi.mock("@/services/posts", () => ({
  getPost: vi.fn(),
  listPosts: vi.fn(),
  markPostPublished: vi.fn(),
  unmarkPostPublished: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

const post: PostWithMedia = {
  id: "p-m-3",
  client_id: "c-marina",
  client_package_id: "pkg-marina",
  format: "single",
  title: "Um canto para respirar",
  caption: null,
  scheduled_date: "2026-10-23",
  scheduled_time: "10:00",
  status: "published",
  published_at: "2026-10-23T13:00:00.000Z",
  published_by: "client",
  media: [],
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useTogglePublished({ role: "client", clientId: "c-marina" }), {
    wrapper,
  });

  return { ...hook, invalidate };
}

describe("useTogglePublished", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates only the affected portal and the admin cache", async () => {
    vi.mocked(markPostPublished).mockResolvedValue(post);
    const { result, invalidate } = setup();

    await act(async () => {
      await result.current.mutateAsync({ postId: post.id, published: true });
    });

    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenNthCalledWith(1, { queryKey: ["portal", "c-marina"] });
    expect(invalidate).toHaveBeenNthCalledWith(2, { queryKey: ["admin"] });
  });

  it("shows the service error in a toast", async () => {
    vi.mocked(markPostPublished).mockRejectedValue(new Error("Falha simulada"));
    const { result } = setup();

    await act(async () => {
      await expect(
        result.current.mutateAsync({ postId: post.id, published: true }),
      ).rejects.toThrow("Falha simulada");
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Falha simulada"));
  });
});
