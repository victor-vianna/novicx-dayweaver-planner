// Validation of the client form, kept apart from the view so it is unit-tested.
import type { ClientInput } from "@/services/clients";
import type { Client } from "@/types/domain";

export type ClientDraft = ClientInput;

export const emptyDraft = (): ClientDraft => ({
  display_name: "",
  business_name: "",
  profession: "",
  email: "",
  phone: "",
});

export const toDraft = (client: Client): ClientDraft => ({
  display_name: client.display_name,
  business_name: client.business_name,
  profession: client.profession,
  email: client.email,
  phone: client.phone,
});

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns the input to save (trimmed, e-mail normalized), or the first problem in pt-BR. */
export function parseDraft(draft: ClientDraft): { input: ClientInput } | { error: string } {
  const display_name = draft.display_name.trim();
  if (!display_name) return { error: "Informe o nome de exibição." };
  const business_name = draft.business_name.trim();
  if (!business_name) return { error: "Informe o nome do negócio." };
  const email = normalizeEmail(draft.email);
  if (!email) return { error: "Informe o e-mail." };
  if (!EMAIL.test(email)) return { error: "E-mail inválido. Use o formato nome@dominio.com." };
  return {
    input: {
      display_name,
      business_name,
      profession: draft.profession.trim(),
      email,
      phone: draft.phone.trim(),
    },
  };
}
