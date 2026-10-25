import { addDays, todayISO } from "@/lib/dates";
import { distributeSlots, packageEndDate } from "@/lib/scheduling";
import { clone, commit, delay, getDB, uid } from "@/mocks/store";
import type { ClientPackage, Post } from "@/types/domain";

export async function listClientPackages(clientId: string): Promise<ClientPackage[]> {
  await delay();
  return clone(
    getDB()
      .packages.filter((p) => p.client_id === clientId)
      .sort((a, b) => b.start_date.localeCompare(a.start_date)),
  );
}

export async function getActivePackage(clientId: string): Promise<ClientPackage | null> {
  await delay(160);
  return clone(
    getDB().packages.find((p) => p.client_id === clientId && p.status === "active") ?? null,
  );
}

export async function listAllActivePackages(): Promise<ClientPackage[]> {
  await delay();
  return clone(getDB().packages.filter((p) => p.status === "active"));
}

/** Packages whose end date falls between today and today + `days`. */
export async function listEndingPackages(days = 15): Promise<ClientPackage[]> {
  await delay();
  const today = todayISO();
  const limit = addDays(today, days);
  return clone(
    getDB()
      .packages.filter((p) => p.status === "active" && p.end_date >= today && p.end_date <= limit)
      .sort((a, b) => a.end_date.localeCompare(b.end_date)),
  );
}

export interface AssignInput {
  clientId: string;
  planId: string;
  startDate: string;
  /** One per contracting intent: a repeated submission returns the same package. */
  requestId: string;
}

/** requestId → package id (demo only; the database keeps it in client_packages). */
const assigned = new Map<string, string>();

/**
 * Contracts a catalog plan for a client: snapshots name/quantity, closes the
 * previous active package and creates draft slots spread over allowed weekdays.
 */
export async function assignPlan({
  clientId,
  planId,
  startDate,
  requestId,
}: AssignInput): Promise<ClientPackage> {
  await delay(320);
  const db = getDB();
  const previous = db.packages.find((p) => p.id === assigned.get(requestId));
  if (previous) {
    if (previous.client_id !== clientId || previous.plan_id !== planId) {
      throw new Error("Identificador da contratação já usado em outra contratação");
    }
    return clone(previous);
  }
  const plan = db.plans.find((p) => p.id === planId);
  if (!plan) throw new Error("Plano não encontrado");

  for (const pkg of db.packages) {
    if (pkg.client_id === clientId && pkg.status === "active") pkg.status = "ended";
  }

  const pkg: ClientPackage = {
    id: uid("pkg"),
    client_id: clientId,
    plan_id: plan.id,
    plan_name_snapshot: plan.name,
    posts_total: plan.posts_per_period,
    start_date: startDate,
    end_date: packageEndDate(startDate, plan.period_days),
    status: "active",
  };
  db.packages.push(pkg);
  assigned.set(requestId, pkg.id);

  const slots = distributeSlots({
    startDate: pkg.start_date,
    endDate: pkg.end_date,
    count: plan.posts_per_period,
    weekdays: plan.default_weekdays,
    times: plan.default_times,
  });
  slots.forEach((slot, i) => {
    const post: Post = {
      id: uid("p"),
      client_id: clientId,
      client_package_id: pkg.id,
      format: "single",
      title: `Publicação ${i + 1}`,
      caption: null,
      scheduled_date: slot.date,
      scheduled_time: slot.time,
      status: "draft",
      published_at: null,
      published_by: null,
    };
    db.posts.push(post);
  });

  commit();
  return clone(pkg);
}
