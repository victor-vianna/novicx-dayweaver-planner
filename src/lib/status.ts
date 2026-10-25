import type { Post } from "@/types/domain";

/**
 * What a post looks like to people.
 * - draft: only the agency sees it.
 * - ready: art is ready; date is today or later → "Pronto para publicar".
 * - pending: ready but the suggested date already passed → "Pendente" (never "Atrasado").
 * - published: the client confirmed the publication.
 */
export type DisplayStatus = "draft" | "ready" | "pending" | "published";

export function getDisplayStatus(
  post: Pick<Post, "status" | "scheduled_date">,
  today: string,
): DisplayStatus {
  if (post.status === "draft") return "draft";
  if (post.status === "published") return "published";
  return post.scheduled_date < today ? "pending" : "ready";
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: "Rascunho",
  ready: "Pronto para publicar",
  pending: "Pendente",
  published: "Publicado",
};

export const STATUS_SHORT_LABEL: Record<DisplayStatus, string> = {
  draft: "Rascunho",
  ready: "Pronto",
  pending: "Pendente",
  published: "Publicado",
};

/** Drafts are never shown in the client portal. */
export function isClientVisible(post: Pick<Post, "status">) {
  return post.status !== "draft";
}

/** Only drafts can be deleted (published history is kept). */
export const DRAFT_ONLY = "Só rascunhos podem ser excluídos.";

/** Releasing a post (anything but draft) needs at least one art. */
export const NEEDS_ART = "Envie ao menos uma arte antes de liberar para a cliente.";
