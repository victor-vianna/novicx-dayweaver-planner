// T5 in mock mode: a repeated contracting request returns the same package, and
// later catalog edits leave contracted packages untouched.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDB, resetDB } from "@/mocks/store";

import { assignPlan } from "./mock/packages";
import { updatePlan } from "./mock/plans";

vi.mock("@/mocks/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/mocks/store")>()),
  delay: async () => {},
}));

const clientId = () => getDB().clients[0]!.id;
const input = (requestId: string) => ({
  clientId: clientId(),
  planId: "plan-dp4",
  startDate: "2026-11-02",
  requestId,
});

beforeEach(() => resetDB());

describe("assignPlan (mock)", () => {
  it("returns the same package for a repeated request", async () => {
    const first = await assignPlan(input("r-1"));
    const again = await assignPlan(input("r-1"));
    expect(again.id).toBe(first.id);
    const own = getDB().packages.filter((p) => p.client_id === clientId());
    expect(own.filter((p) => p.status === "active").map((p) => p.id)).toEqual([first.id]);
    expect(getDB().posts.filter((p) => p.client_package_id === first.id)).toHaveLength(
      first.posts_total,
    );
  });

  it("refuses a request id reused for another plan or start date", async () => {
    await assignPlan(input("r-2"));
    await expect(assignPlan({ ...input("r-2"), planId: "plan-cd8" })).rejects.toThrow(/já usado/);
    // T5-001: same client and plan, another start date.
    await expect(assignPlan({ ...input("r-2"), startDate: "2026-12-01" })).rejects.toThrow(
      /já usado/,
    );
  });

  it("keeps the contracted package when the catalog changes", async () => {
    const pkg = await assignPlan(input("r-3"));
    await updatePlan("plan-dp4", { name: "Outro nome", posts_per_period: 20 });
    const stored = getDB().packages.find((p) => p.id === pkg.id)!;
    expect(stored.plan_name_snapshot).toBe(pkg.plan_name_snapshot);
    expect(stored.posts_total).toBe(pkg.posts_total);
  });
});
