// Facade: the UI imports from here; VITE_DATA_SOURCE picks the implementation.
import { isMockMode } from "@/lib/data-source";

import * as mock from "./mock/accounts";
import * as remote from "./supabase/accounts";

export type { AccessStatus, AccountAccess } from "./mock/accounts";

const impl = (): typeof mock => (isMockMode() ? mock : remote);

export const getAccess: typeof mock.getAccess = (...args) => impl().getAccess(...args);
export const createAccess: typeof mock.createAccess = (...args) => impl().createAccess(...args);
export const setAccessBlocked: typeof mock.setAccessBlocked = (...args) =>
  impl().setAccessBlocked(...args);
export const resetAccess: typeof mock.resetAccess = (...args) => impl().resetAccess(...args);
export const changeClientEmail: typeof mock.changeClientEmail = (...args) =>
  impl().changeClientEmail(...args);
