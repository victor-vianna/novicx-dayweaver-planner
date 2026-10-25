// Client screen data: access status per client and a mutation helper that
// refreshes every admin view (same pattern as PlansView/useDeliveryMutation).
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getAccess } from "@/services/accounts";
import type { Client } from "@/types/domain";

/** user_id is in the key: creating access changes it and must refetch. */
export const adminAccessQuery = (client: Pick<Client, "id" | "user_id">) =>
  queryOptions({
    queryKey: ["admin", "access", client.id, client.user_id],
    queryFn: () => getAccess(client),
  });

export function useClientMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  successMessage?: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      if (successMessage) toast.success(successMessage);
    },
    onError: (error) => toast.error(error.message || "Não foi possível salvar."),
  });
}
