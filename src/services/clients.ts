// Facade: the UI imports from here; VITE_DATA_SOURCE picks the implementation.
import { isMockMode } from "@/lib/data-source";

import * as mock from "./mock/clients";
import * as remote from "./supabase/clients";

export type { ClientInput } from "./mock/clients";

const impl = (): typeof mock => (isMockMode() ? mock : remote);

export const listClients: typeof mock.listClients = (...args) => impl().listClients(...args);
export const getClient: typeof mock.getClient = (...args) => impl().getClient(...args);
export const createClient: typeof mock.createClient = (...args) => impl().createClient(...args);
export const updateClient: typeof mock.updateClient = (...args) => impl().updateClient(...args);
export const setClientArchived: typeof mock.setClientArchived = (...args) =>
  impl().setClientArchived(...args);
