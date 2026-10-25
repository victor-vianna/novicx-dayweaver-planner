// Facade: the UI imports from here; VITE_DATA_SOURCE picks the implementation.
import { isMockMode } from "@/lib/data-source";

import * as mock from "./mock/events";
import * as remote from "./supabase/events";

const impl = (): Pick<typeof mock, "listPostEvents"> => (isMockMode() ? mock : remote);

export const listPostEvents: typeof mock.listPostEvents = (...args) =>
  impl().listPostEvents(...args);
