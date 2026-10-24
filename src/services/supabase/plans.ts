import type { PlanInput } from "@/services/mock/plans";
import type { Plan } from "@/types/domain";

import { db, fail, toPlan } from "./shared";

export async function listPlans(): Promise<Plan[]> {
  const { data, error } = await db().from("plans").select("*").order("name");
  if (error) fail(error, "Não foi possível carregar os planos.");
  return (data ?? []).map(toPlan);
}

export async function createPlan(input: PlanInput): Promise<Plan> {
  const { data, error } = await db().from("plans").insert(input).select("*").single();
  if (error) fail(error, "Não foi possível criar o plano.");
  return toPlan(data);
}

/** Catalog edits never touch existing packages (they keep their snapshot). */
export async function updatePlan(id: string, patch: Partial<PlanInput>): Promise<Plan> {
  const { data, error } = await db()
    .from("plans")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) fail(error, "Não foi possível salvar o plano.");
  if (!data) throw new Error("Plano não encontrado");
  return toPlan(data);
}
