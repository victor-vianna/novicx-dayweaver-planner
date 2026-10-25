// Create or edit a client. Editing saves the e-mail through changeClientEmail,
// which keeps the login (Auth) and the clients row together.
import { LoaderCircle } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { changeClientEmail } from "@/services/accounts";
import { type ClientInput, createClient, updateClient } from "@/services/clients";
import type { Client } from "@/types/domain";

import { type ClientDraft, emptyDraft, normalizeEmail, parseDraft, toDraft } from "./client-form";
import { useClientMutation } from "./queries";

export const fieldClass =
  "h-11 w-full min-w-0 rounded-xl border border-input bg-background/45 px-4 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20";
export const labelClass = "mb-2 block text-xs font-semibold text-muted-foreground";

async function saveClient({
  client,
  input,
}: {
  client: Client | null;
  input: ClientInput;
}): Promise<Client> {
  if (!client) return createClient(input);
  const { email, ...rest } = input;
  // E-mail first: it is the step most likely to be refused (duplicate).
  if (email !== normalizeEmail(client.email)) await changeClientEmail(client.id, email);
  return updateClient(client.id, rest);
}

export function ClientForm({
  client,
  onClose,
  onSaved,
}: {
  client: Client | null;
  onClose: () => void;
  onSaved?: (client: Client) => void;
}) {
  const [draft, setDraft] = useState<ClientDraft>(() => (client ? toDraft(client) : emptyDraft()));
  const [error, setError] = useState("");
  const save = useClientMutation(
    saveClient,
    client ? "Cliente atualizada." : "Cliente cadastrada.",
  );
  const set = (key: keyof ClientDraft, value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const emailChanged = !!client && normalizeEmail(draft.email) !== normalizeEmail(client.email);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseDraft(draft);
    if ("error" in parsed) return setError(parsed.error);
    setError("");
    save.mutate(
      { client, input: parsed.input },
      {
        onSuccess: (saved) => {
          onSaved?.(saved);
          onClose();
        },
      },
    );
  };

  const title = client ? `Editar ${client.business_name}` : "Nova cliente";
  return (
    <form
      onSubmit={submit}
      aria-label={title}
      noValidate
      className="rounded-2xl border border-primary/30 bg-surface p-5 shadow-soft"
    >
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Nome de exibição</span>
          <input
            className={fieldClass}
            value={draft.display_name}
            onChange={(e) => set("display_name", e.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <label className="block">
          <span className={labelClass}>Nome do negócio</span>
          <input
            className={fieldClass}
            value={draft.business_name}
            onChange={(e) => set("business_name", e.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <label className="block">
          <span className={labelClass}>Profissão</span>
          <input
            className={fieldClass}
            value={draft.profession}
            onChange={(e) => set("profession", e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Telefone</span>
          <input
            className={fieldClass}
            type="tel"
            inputMode="tel"
            value={draft.phone}
            onChange={(e) => set("phone", e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelClass}>E-mail</span>
          <input
            className={fieldClass}
            type="email"
            inputMode="email"
            value={draft.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="off"
            required
          />
        </label>
        {emailChanged && client.user_id && (
          <p className="text-xs text-warning sm:col-span-2">
            Este e-mail é o login da cliente. Ao salvar, ela passa a entrar com o novo e-mail.
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <LoaderCircle className="animate-spin" />}
          {client ? "Salvar" : "Cadastrar cliente"}
        </Button>
      </div>
    </form>
  );
}
