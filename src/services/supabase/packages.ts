import { addDays, todayISO } from "@/lib/dates";
import { distributeSlots, packageEndDate } from "@/lib/scheduling";
import type { ClientPackage } from "@/types/domain";

import { db, fail, toPlan } from "./shared";

export async function listClientPackages(clientId: string): Promise<ClientPackage[]> {
  const { data, error } = await db()
    .from("client_packages")
    .select("*")
    .eq("client_id", clientId)
    .order("start_date", { ascending: false });
  if (error) fail(error, "Não foi possível carregar os pacotes.");
  return (data ?? []) as ClientPackage[];
}

export async function getActivePackage(clientId: string): Promise<ClientPackage | null> {
  const { data, error } = await db()
    .from("client_packages")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (error) fail(error, "Não foi possível carregar o pacote.");
  return (data as ClientPackage | null) ?? null;
}

export async function listAllActivePackages(): Promise<ClientPackage[]> {
  const { data, error } = await db().from("client_packages").select("*").eq("status", "active");
  if (error) fail(error, "Não foi possível carregar os pacotes.");
  return (data ?? []) as ClientPackage[];
}

export async function listEndingPackages(days = 15): Promise<ClientPackage[]> {
  const today = todayISO();
  const { data, error } = await db()
    .from("client_packages")
    .select("*")
    .eq("status", "active")
    .gte("end_date", today)
    .lte("end_date", addDays(today, days))
    .order("end_date");
  if (error) fail(error, "Não foi possível carregar os pacotes.");
  return (data ?? []) as ClientPackage[];
}

interface AssignInput {
  clientId: string;
  planId: string;
  startDate: string;
}

/** Slots are computed by the shared scheduler and validated by the RPC. */
export async function assignPlan({
  clientId,
  planId,
  startDate,
}: AssignInput): Promise<ClientPackage> {
  const { data: planRow, error: planError } = await db()
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (planError) fail(planError, "Não foi possível carregar o plano.");
  if (!planRow) throw new Error("Plano não encontrado");
  const plan = toPlan(planRow);

  const slots = distributeSlots({
    startDate,
    endDate: packageEndDate(startDate, plan.period_days),
    count: plan.posts_per_period,
    weekdays: plan.default_weekdays,
    times: plan.default_times,
  });

  const { data, error } = await db().rpc("assign_plan", {
    p_client_id: clientId,
    p_plan_id: planId,
    p_start_date: startDate,
    p_slots: slots,
  });
  if (error) fail(error, "Não foi possível contratar o plano.");
  return data as ClientPackage;
}
