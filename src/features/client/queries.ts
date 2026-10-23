// Client-portal data hooks. UI → hooks → services → mocks.
// Every call here excludes drafts and is scoped to one client.
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { getClient } from "@/services/clients";
import { listClientPackages } from "@/services/packages";
import { getPost, listPosts, markPostPublished, unmarkPostPublished } from "@/services/posts";

export const portalKeys = {
  client: (clientId: string) => ["portal", clientId, "client"] as const,
  posts: (clientId: string) => ["portal", clientId, "posts"] as const,
  packages: (clientId: string) => ["portal", clientId, "packages"] as const,
  post: (clientId: string, postId: string) => ["portal", clientId, "post", postId] as const,
};

export const portalClientQuery = (clientId: string) =>
  queryOptions({ queryKey: portalKeys.client(clientId), queryFn: () => getClient(clientId) });

export const portalPostsQuery = (clientId: string) =>
  queryOptions({ queryKey: portalKeys.posts(clientId), queryFn: () => listPosts({ clientId }) });

export const portalPackagesQuery = (clientId: string) =>
  queryOptions({ queryKey: portalKeys.packages(clientId), queryFn: () => listClientPackages(clientId) });

export const portalPostQuery = (clientId: string, postId: string) =>
  queryOptions({
    queryKey: portalKeys.post(clientId, postId),
    queryFn: () => getPost(postId, { clientId }),
  });

export function useTogglePublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, published }: { postId: string; published: boolean }) =>
      published ? markPostPublished(postId) : unmarkPostPublished(postId),
    onSuccess: () => qc.invalidateQueries(),
  });
}
