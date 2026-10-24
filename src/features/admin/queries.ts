// Admin data hooks. Admin views include drafts and internal notes.
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getClient, listClients } from "@/services/clients";
import { listNotes } from "@/services/notes";
import { listAllActivePackages, listClientPackages, listEndingPackages } from "@/services/packages";
import { listPlans } from "@/services/plans";
import { getPost, listPosts, listUpcomingDeliveries } from "@/services/posts";

export const adminClientsQuery = (includeArchived = true) =>
  queryOptions({
    queryKey: ["admin", "clients", includeArchived],
    queryFn: () => listClients({ includeArchived }),
  });

export const adminClientQuery = (id: string) =>
  queryOptions({ queryKey: ["admin", "client", id], queryFn: () => getClient(id) });

export const adminPlansQuery = () =>
  queryOptions({ queryKey: ["admin", "plans"], queryFn: listPlans });

export const adminPackagesQuery = (clientId: string) =>
  queryOptions({
    queryKey: ["admin", "packages", clientId],
    queryFn: () => listClientPackages(clientId),
  });

export const adminActivePackagesQuery = () =>
  queryOptions({ queryKey: ["admin", "packages", "active"], queryFn: listAllActivePackages });

export const adminPostsQuery = (clientId: string) =>
  queryOptions({
    queryKey: ["admin", "posts", clientId],
    queryFn: () => listPosts({ clientId, includeDrafts: true }),
  });

export const adminPostQuery = (id: string) =>
  queryOptions({
    queryKey: ["admin", "post", id],
    queryFn: () => getPost(id, { includeDrafts: true }),
  });

export const adminNotesQuery = (clientId: string) =>
  queryOptions({ queryKey: ["admin", "notes", clientId], queryFn: () => listNotes(clientId) });

export const adminUpcomingQuery = () =>
  queryOptions({ queryKey: ["admin", "upcoming"], queryFn: () => listUpcomingDeliveries(7) });

export const adminEndingQuery = () =>
  queryOptions({ queryKey: ["admin", "ending"], queryFn: () => listEndingPackages(15) });

// Delivery mutations (C6). Every success refreshes admin views and the
// client's portal cache, so a preview right after shows the new state.
export function useDeliveryMutation<TVars, TData>(
  clientId: string,
  mutationFn: (vars: TVars) => Promise<TData>,
  successMessage?: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin"] }),
        qc.invalidateQueries({ queryKey: ["portal", clientId] }),
      ]);
      if (successMessage) toast.success(successMessage);
    },
    onError: (error) => toast.error(error.message || "Não foi possível salvar."),
  });
}
