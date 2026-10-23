import { clone, commit, delay, getDB, uid } from "@/mocks/store";
import type { Plan } from "@/types/domain";

export type PlanInput = Omit<Plan, "id">;

export async function listPlans(): Promise<Plan[]> {
  await delay();
  return clone(getDB().plans);
}

export async function createPlan(input: PlanInput): Promise<Plan> {
  await delay();
  const plan: Plan = { id: uid("plan"), ...input };
  getDB().plans.push(plan);
  commit();
  return clone(plan);
}

/** Catalog edits never touch existing packages (they keep their snapshot). */
export async function updatePlan(id: string, patch: Partial<PlanInput>): Promise<Plan> {
  await delay();
  const plan = getDB().plans.find((p) => p.id === id);
  if (!plan) throw new Error("Plano não encontrado");
  Object.assign(plan, patch);
  commit();
  return clone(plan);
}
