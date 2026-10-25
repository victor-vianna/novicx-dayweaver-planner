// Text of each history event, kept apart from the view so it is unit-tested.
import { formatShort, TIMEZONE } from "@/lib/dates";
import { STATUS_LABEL } from "@/lib/status";
import type { PostEvent, PostStatus } from "@/types/domain";

const status = (value: unknown) => STATUS_LABEL[value as PostStatus] ?? String(value);
const art = (position: unknown) => (typeof position === "number" ? `arte ${position + 1}` : "arte");
const slot = (date: unknown, time: unknown) =>
  typeof date === "string" ? `${formatShort(date)}${time ? ` ${String(time)}` : ""}` : "—";

export function describeEvent(event: PostEvent): string {
  const d = event.detail;
  switch (event.kind) {
    case "created":
      return "Publicação criada";
    case "status":
      if (d["to"] === "published") {
        return d["published_by"] === "client" ? "Publicado pela cliente" : "Marcado como publicado";
      }
      return `Status: ${status(d["from"])} → ${status(d["to"])}`;
    case "schedule":
      return `Data: ${slot(d["from_date"], d["from_time"])} → ${slot(d["to_date"], d["to_time"])}`;
    case "media_added":
      return `Enviou ${art(d["position"])}`;
    case "media_replaced":
      return `Substituiu ${art(d["position"])}`;
    case "media_removed":
      return `Removeu ${art(d["position"])}`;
  }
}

export function actorLabel(event: PostEvent): string {
  if (event.actor_role === "admin") return "Equipe";
  if (event.actor_role === "client") return "Cliente";
  return "Sistema";
}

const WHEN = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** "14/10, 09:30" in America/Sao_Paulo. */
export const formatWhen = (iso: string) => WHEN.format(new Date(iso));
