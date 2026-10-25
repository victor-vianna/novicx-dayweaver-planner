// Clients screen (admin): search, active/archived filter, create, and the
// client sheet. There is no delete: clients are archived instead.
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus, Search, Users } from "lucide-react";
import { useState } from "react";

import { EmptyState, ErrorState, Skeleton } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { adminClientsQuery } from "@/features/admin/queries";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import type { Client } from "@/types/domain";

import { ClientForm, fieldClass } from "./ClientForm";
import { ClientSheet } from "./ClientSheet";

type Filter = "active" | "archived";

/** Case- and accent-insensitive, so "helena" finds "Helena" and "joao" finds "João". */
const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function matchesSearch(client: Client, search: string) {
  const term = fold(search.trim());
  if (!term) return true;
  return [client.display_name, client.business_name, client.email].some((v) =>
    fold(v).includes(term),
  );
}

function ClientRow({ client, onOpen }: { client: Client; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir ficha de ${client.business_name}`}
      className="pressable group w-full min-w-0 rounded-2xl border border-border bg-surface p-4 text-left shadow-soft hover:border-primary/35 hover:bg-surface-2"
    >
      <div className="flex items-center gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-xs font-bold text-primary-glow">
          {initials(client.business_name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{client.business_name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[client.display_name, client.profession].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-0.5 truncate text-xs text-subtle-foreground">{client.email}</p>
        </div>
        {client.archived_at && (
          <span className="shrink-0 rounded-full bg-surface-3 px-2 py-1 text-[11px] font-semibold text-muted-foreground">
            Arquivada
          </span>
        )}
        <ChevronRight
          className="h-4 w-4 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary-glow"
          aria-hidden
        />
      </div>
    </button>
  );
}

export function ClientsView({
  onOpenDelivery,
  onPreview,
}: {
  onOpenDelivery: (clientId: string) => void;
  onPreview: (clientId: string) => void;
}) {
  const clientsQuery = useQuery(adminClientsQuery(true));
  const [filter, setFilter] = useState<Filter>("active");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const all = clientsQuery.data ?? [];
  const selected = selectedId ? all.find((c) => c.id === selectedId) : undefined;
  if (selected) {
    return (
      <ClientSheet
        key={selected.id}
        client={selected}
        onBack={() => setSelectedId(null)}
        onOpenDelivery={onOpenDelivery}
        onPreview={onPreview}
      />
    );
  }

  const clients = all.filter(
    (c) => (filter === "archived") === !!c.archived_at && matchesSearch(c, search),
  );

  return (
    <div className="page-enter min-w-0">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary-glow">Relacionamento</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Clientes
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cadastre clientes, gerencie o acesso ao portal e abra as entregas.
          </p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Nova cliente
          </Button>
        )}
      </header>

      {creating && (
        <div className="mb-6">
          <ClientForm
            client={null}
            onClose={() => setCreating(false)}
            onSaved={(client) => setSelectedId(client.id)}
          />
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Buscar cliente por nome ou e-mail</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground"
            aria-hidden
          />
          <input
            type="search"
            className={cn(fieldClass, "pl-10")}
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div
          role="group"
          aria-label="Filtrar clientes"
          className="flex shrink-0 gap-1 rounded-xl border border-border bg-surface p-1"
        >
          {(
            [
              ["active", "Ativas"],
              ["archived", "Arquivadas"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "pressable h-9 flex-1 rounded-lg px-4 text-xs font-semibold sm:flex-none",
                filter === value
                  ? "bg-primary-soft text-primary-glow"
                  : "text-muted-foreground hover:bg-surface-2",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {clientsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : clientsQuery.isError ? (
        <ErrorState onRetry={() => void clientsQuery.refetch()} />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            search.trim()
              ? "Nenhuma cliente encontrada"
              : filter === "archived"
                ? "Nenhuma cliente arquivada"
                : "Nenhuma cliente ativa"
          }
          description={
            search.trim()
              ? "Confira o nome ou o e-mail digitado."
              : filter === "active"
                ? "Cadastre a primeira cliente para começar."
                : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <ClientRow key={client.id} client={client} onOpen={() => setSelectedId(client.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
