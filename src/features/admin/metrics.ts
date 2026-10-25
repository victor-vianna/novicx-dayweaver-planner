// Overview indicators, defined like the database would count them:
// active client = not archived and with at least one package in status active.
import type { Client, ClientPackage } from "@/types/domain";

export function activeClientIds(clients: Client[], packages: ClientPackage[]): Set<string> {
  const current = new Set(clients.filter((c) => !c.archived_at).map((c) => c.id));
  return new Set(
    packages
      .filter((p) => p.status === "active" && current.has(p.client_id))
      .map((p) => p.client_id),
  );
}
