// Timeline of a post's changes (admin only): status, date, arts, publication.
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { Skeleton } from "@/components/common/States";
import { adminPostEventsQuery } from "@/features/admin/queries";

import { actorLabel, describeEvent, formatWhen } from "./history";

export function PostHistory({ postId }: { postId: string }) {
  const eventsQuery = useQuery(adminPostEventsQuery(postId));
  const events = [...(eventsQuery.data ?? [])].reverse();

  return (
    <section aria-labelledby="post-history-title" className="border-t border-border pt-5">
      <h3
        id="post-history-title"
        className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        <History className="h-4 w-4 text-primary-glow" />
        Histórico
      </h3>
      {eventsQuery.isLoading ? (
        <Skeleton className="h-16 rounded-xl" />
      ) : eventsQuery.isError ? (
        <p className="text-sm text-muted-foreground">Não foi possível carregar o histórico.</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
      ) : (
        <ol className="space-y-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-xl bg-surface-2 px-3 py-2 text-sm"
            >
              <span className="min-w-0 text-foreground">{describeEvent(event)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {actorLabel(event)} · {formatWhen(event.created_at)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
