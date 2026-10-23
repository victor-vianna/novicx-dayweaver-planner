// In-memory demo database persisted to sessionStorage, so demo changes stay
// coherent during the browser session. Only services/ may import this file.
import { todayISO } from "@/lib/dates";
import { createSeed, DB_VERSION, type MockDB } from "./seed";

const STORAGE_KEY = "novicx-planner:db";

let db: MockDB | null = null;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function load(): MockDB {
  if (canUseStorage()) {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDB;
        // Re-seed on a new day so relative demo dates stay meaningful.
        if (parsed.version === DB_VERSION && parsed.seededFor === todayISO()) return parsed;
      }
    } catch {
      // Corrupt storage: fall back to a fresh seed.
    }
  }
  return createSeed();
}

export function getDB(): MockDB {
  if (!db) db = load();
  return db;
}

export function commit() {
  if (!db || !canUseStorage()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage full (e.g. large local images): keep changes in memory only.
  }
}

export function resetDB() {
  db = createSeed();
  commit();
}

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Simulated latency so loading states are visible and realistic. */
export function delay(ms = 220) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
