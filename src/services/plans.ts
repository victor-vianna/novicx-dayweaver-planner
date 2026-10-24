// Facade: the UI imports from here; VITE_DATA_SOURCE picks the implementation.
import { isMockMode } from "@/lib/data-source";

import * as mock from "./mock/plans";
import * as remote from "./supabase/plans";

export type { PlanInput } from "./mock/plans";

const impl = (): typeof mock => (isMockMode() ? mock : remote);

export const listPlans: typeof mock.listPlans = (...args) => impl().listPlans(...args);
export const createPlan: typeof mock.createPlan = (...args) => impl().createPlan(...args);
export const updatePlan: typeof mock.updatePlan = (...args) => impl().updatePlan(...args);
