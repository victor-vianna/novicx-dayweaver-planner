// Facade: the UI imports from here; VITE_DATA_SOURCE picks the implementation.
import { isMockMode } from "@/lib/data-source";

import * as mock from "./mock/media";
import * as remote from "./supabase/media";

const impl = (): typeof mock => (isMockMode() ? mock : remote);

export const uploadPostMedia: typeof mock.uploadPostMedia = (...args) =>
  impl().uploadPostMedia(...args);
export const replacePostMedia: typeof mock.replacePostMedia = (...args) =>
  impl().replacePostMedia(...args);
export const removePostMedia: typeof mock.removePostMedia = (...args) =>
  impl().removePostMedia(...args);
export const reorderPostMedia: typeof mock.reorderPostMedia = (...args) =>
  impl().reorderPostMedia(...args);
