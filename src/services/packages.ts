// Facade: the UI imports from here; VITE_DATA_SOURCE picks the implementation.
import { isMockMode } from "@/lib/data-source";

import * as mock from "./mock/packages";
import * as remote from "./supabase/packages";

const impl = (): typeof mock => (isMockMode() ? mock : remote);

export const listClientPackages: typeof mock.listClientPackages = (...args) =>
  impl().listClientPackages(...args);
export const getActivePackage: typeof mock.getActivePackage = (...args) =>
  impl().getActivePackage(...args);
export const listAllActivePackages: typeof mock.listAllActivePackages = (...args) =>
  impl().listAllActivePackages(...args);
export const listEndingPackages: typeof mock.listEndingPackages = (...args) =>
  impl().listEndingPackages(...args);
export const assignPlan: typeof mock.assignPlan = (...args) => impl().assignPlan(...args);
