import { describe, expect, it } from "vitest";

import type { PostEvent } from "@/types/domain";

import { actorLabel, describeEvent, formatWhen } from "./history";

const event = (patch: Partial<PostEvent>): PostEvent => ({
  id: "1",
  post_id: "p",
  kind: "created",
  detail: {},
  actor_id: "u",
  actor_role: "admin",
  created_at: "2026-10-14T12:30:00Z",
  ...patch,
});

describe("history text", () => {
  it("describes each kind in pt-BR", () => {
    expect(describeEvent(event({}))).toBe("Publicação criada");
    expect(describeEvent(event({ kind: "status", detail: { from: "draft", to: "ready" } }))).toBe(
      "Status: Rascunho → Pronto para publicar",
    );
    expect(
      describeEvent(
        event({
          kind: "status",
          detail: { from: "ready", to: "published", published_by: "client" },
        }),
      ),
    ).toBe("Publicado pela cliente");
    expect(
      describeEvent(
        event({
          kind: "status",
          detail: { from: "ready", to: "published", published_by: "admin" },
        }),
      ),
    ).toBe("Marcado como publicado");
    expect(
      describeEvent(
        event({
          kind: "schedule",
          detail: {
            from_date: "2026-10-14",
            from_time: "10:00",
            to_date: "2026-10-15",
            to_time: "18:30",
          },
        }),
      ),
    ).toBe("Data: 14 out 10:00 → 15 out 18:30");
    expect(describeEvent(event({ kind: "media_replaced", detail: { position: 0 } }))).toBe(
      "Substituiu arte 1",
    );
    expect(describeEvent(event({ kind: "media_removed", detail: {} }))).toBe("Removeu arte");
  });

  it("names the actor and formats the time in São Paulo", () => {
    expect(actorLabel(event({}))).toBe("Equipe");
    expect(actorLabel(event({ actor_role: "client" }))).toBe("Cliente");
    expect(actorLabel(event({ actor_role: null }))).toBe("Sistema");
    expect(formatWhen("2026-10-14T12:30:00Z")).toBe("14/10, 09:30");
  });
});
