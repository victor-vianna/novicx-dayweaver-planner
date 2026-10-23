// Which backend the services talk to. Anything other than "supabase" falls back
// to the demo mocks, so a missing or mistyped env var never reaches a real database.
export type DataSource = "mock" | "supabase";

export function resolveDataSource(value: unknown): DataSource {
  return value === "supabase" ? "supabase" : "mock";
}

export const DATA_SOURCE: DataSource = resolveDataSource(import.meta.env.VITE_DATA_SOURCE);

export const isMockMode = () => DATA_SOURCE === "mock";
