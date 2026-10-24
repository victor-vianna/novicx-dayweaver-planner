// Facade: the UI imports from here; VITE_DATA_SOURCE picks the implementation.
import { isMockMode } from "@/lib/data-source";

import * as mock from "./mock/notes";
import * as remote from "./supabase/notes";

const impl = (): typeof mock => (isMockMode() ? mock : remote);

export const listNotes: typeof mock.listNotes = (...args) => impl().listNotes(...args);
export const addNote: typeof mock.addNote = (...args) => impl().addNote(...args);
export const deleteNote: typeof mock.deleteNote = (...args) => impl().deleteNote(...args);
