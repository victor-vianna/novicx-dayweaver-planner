import { describe, expect, it } from "vitest";

import { getSupabase } from "@/integrations/supabase/client";
import { DATA_SOURCE, resolveDataSource } from "@/lib/data-source";

describe("data source", () => {
  it("only selects supabase on the exact value", () => {
    expect(resolveDataSource("supabase")).toBe("supabase");
    expect(resolveDataSource("mock")).toBe("mock");
    expect(resolveDataSource(undefined)).toBe("mock");
    expect(resolveDataSource("Supabase")).toBe("mock");
    expect(resolveDataSource("")).toBe("mock");
  });

  it("defaults to mock when the env var is not set", () => {
    expect(DATA_SOURCE).toBe("mock");
  });

  it("refuses to create a Supabase client in mock mode", () => {
    expect(() => getSupabase()).toThrow(/VITE_DATA_SOURCE/);
  });
});
