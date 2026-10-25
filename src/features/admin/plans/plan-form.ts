// Validation of the plan form, kept apart from the view so it is unit-tested.
import type { PlanInput } from "@/services/plans";
import type { Weekday } from "@/types/domain";

export interface PlanDraft {
  name: string;
  posts_per_period: string;
  period_days: string;
  default_weekdays: Weekday[];
  /** Comma-separated HH:mm. */
  default_times: string;
  active: boolean;
}

export const emptyDraft = (): PlanDraft => ({
  name: "",
  posts_per_period: "4",
  period_days: "30",
  default_weekdays: [1, 3, 5],
  default_times: "10:00",
  active: true,
});

export const toDraft = (plan: PlanInput): PlanDraft => ({
  name: plan.name,
  posts_per_period: String(plan.posts_per_period),
  period_days: String(plan.period_days),
  default_weekdays: [...plan.default_weekdays].sort(),
  default_times: plan.default_times.join(", "),
  active: plan.active,
});

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Returns the input to save, or the first problem in pt-BR. */
export function parseDraft(draft: PlanDraft): { input: PlanInput } | { error: string } {
  const name = draft.name.trim();
  if (!name) return { error: "Informe o nome do plano." };
  const posts = Number(draft.posts_per_period);
  if (!Number.isInteger(posts) || posts < 1 || posts > 60) {
    return { error: "Publicações por período: um número inteiro de 1 a 60." };
  }
  const days = Number(draft.period_days);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return { error: "Duração do período: um número inteiro de 1 a 365 dias." };
  }
  if (draft.default_weekdays.length === 0) return { error: "Escolha ao menos um dia da semana." };
  const times = draft.default_times
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (times.length === 0 || !times.every((t) => TIME.test(t))) {
    return { error: "Horários no formato HH:mm, separados por vírgula (ex.: 10:00, 18:30)." };
  }
  return {
    input: {
      name,
      posts_per_period: posts,
      period_days: days,
      default_weekdays: [...new Set(draft.default_weekdays)].sort(),
      default_times: [...new Set(times)].sort(),
      active: draft.active,
    },
  };
}
