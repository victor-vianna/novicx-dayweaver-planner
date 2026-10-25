// Client sheet (admin): data, portal access, active package, archive/restore
// and shortcuts. The access link is a temporary credential: it lives only in
// this component's state, shown once, never logged, toasted or cached.
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Copy,
  Eye,
  KeyRound,
  Link2,
  Pencil,
  Send,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { type ReactNode, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Skeleton } from "@/components/common/States";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { adminPackagesQuery } from "@/features/admin/queries";
import { formatNumeric } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  type AccessStatus,
  createAccess,
  resetAccess,
  setAccessBlocked,
} from "@/services/accounts";
import { setClientArchived } from "@/services/clients";
import type { Client } from "@/types/domain";

import { ClientForm, fieldClass, labelClass } from "./ClientForm";
import { adminAccessQuery, useClientMutation } from "./queries";

const ACCESS_LABEL: Record<AccessStatus, string> = {
  none: "Sem acesso",
  active: "Ativo",
  blocked: "Suspenso",
};

const ACCESS_TONE: Record<AccessStatus, string> = {
  none: "bg-surface-3 text-muted-foreground",
  active: "bg-success-soft text-success",
  blocked: "bg-warning-soft text-warning",
};

const sectionClass = "rounded-2xl border border-border bg-surface p-5 shadow-soft";
const sectionTitleClass = "text-[15px] font-semibold tracking-tight text-foreground";

function Confirm({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AccessLink({ link, onClose }: { link: string; onClose: () => void }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copy, setCopy] = useState<"copied" | "manual" | null>(null);

  const copyLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard indisponível");
      await navigator.clipboard.writeText(link);
      setCopy("copied");
    } catch {
      // Fallback: leave the text selected so the team copies it by hand.
      inputRef.current?.focus();
      inputRef.current?.select();
      setCopy("manual");
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-primary/30 bg-background/45 p-4">
      <label htmlFor={inputId} className={labelClass}>
        Link de acesso
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={inputId}
          ref={inputRef}
          className={fieldClass}
          value={link}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button type="button" variant="secondary" onClick={() => void copyLink()}>
          <Copy />
          Copiar
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Envie este link para a cliente definir a senha. Ele não será mostrado de novo.
      </p>
      <p role="status" className="mt-1 text-xs text-primary-glow">
        {copy === "copied"
          ? "Link copiado."
          : copy === "manual"
            ? "Não foi possível copiar automaticamente. O link está selecionado: copie manualmente."
            : ""}
      </p>
      <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={onClose}>
        Ocultar link
      </Button>
    </div>
  );
}

function AccessSection({ client }: { client: Client }) {
  const accessQuery = useQuery(adminAccessQuery(client));
  const [link, setLink] = useState<string | null>(null);
  // Account created but no link (Supabase may return an empty one).
  const [linkMissing, setLinkMissing] = useState(false);
  // Mutations never return the link: it must not sit in the mutation cache.
  const create = useClientMutation(async (): Promise<boolean> => {
    const { userId, link: first } = await createAccess(client.id);
    let next = first;
    if (!next) {
      // The account already exists: a failure here must not hide that.
      next = await resetAccess(userId).catch(() => "");
    }
    setLink(next || null);
    setLinkMissing(!next);
    return !!next;
  });
  const reset = useClientMutation(async (userId: string) => {
    const next = await resetAccess(userId);
    if (!next) throw new Error("Não foi possível gerar o link. Tente novamente.");
    setLink(next);
    setLinkMissing(false);
  }, "Novo link gerado.");
  const block = useClientMutation(
    async ({ userId, blocked }: { userId: string; blocked: boolean }) => {
      await setAccessBlocked(userId, blocked);
      if (blocked) {
        setLink(null);
        setLinkMissing(false);
      }
    },
  );

  const access = accessQuery.data;
  const busy = create.isPending || reset.isPending || block.isPending;

  return (
    <section aria-labelledby="client-access" className={sectionClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="client-access" className={sectionTitleClass}>
          Acesso ao portal
        </h2>
        {access && (
          <span
            className={cn(
              "rounded-full px-2 py-1 text-[11px] font-semibold",
              ACCESS_TONE[access.status],
            )}
          >
            {ACCESS_LABEL[access.status]}
          </span>
        )}
      </div>
      {accessQuery.isLoading ? (
        <Skeleton className="mt-4 h-11" />
      ) : accessQuery.isError || !access ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Não foi possível carregar o acesso.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            {access.status === "none"
              ? "A cliente ainda não tem login. Crie o acesso e envie o link para ela definir a senha."
              : access.status === "active"
                ? `A cliente entra com ${client.email}.`
                : "Acesso suspenso: a cliente não consegue entrar. Reative para gerar um novo link."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {access.status === "none" && (
              <Button
                onClick={() =>
                  create.mutate(undefined, {
                    onSuccess: (linked) => {
                      if (linked) toast.success("Acesso criado.");
                    },
                  })
                }
                disabled={busy}
              >
                <KeyRound />
                Criar acesso
              </Button>
            )}
            {access.status === "active" && access.userId && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => reset.mutate(access.userId!)}
                  disabled={busy}
                >
                  <Link2 />
                  Gerar novo link
                </Button>
                <Confirm
                  trigger={
                    <Button variant="outline" disabled={busy}>
                      <ShieldOff />
                      Suspender
                    </Button>
                  }
                  title={`Suspender o acesso de ${client.display_name}?`}
                  description="Ela deixa de conseguir entrar no portal até a equipe reativar. Os dados e as publicações são mantidos."
                  confirmLabel="Suspender acesso"
                  onConfirm={() =>
                    block.mutate(
                      { userId: access.userId!, blocked: true },
                      { onSuccess: () => toast.success("Acesso suspenso.") },
                    )
                  }
                />
              </>
            )}
            {access.status === "blocked" && access.userId && (
              <Confirm
                trigger={
                  <Button variant="secondary" disabled={busy}>
                    <ShieldCheck />
                    Reativar
                  </Button>
                }
                title={`Reativar o acesso de ${client.display_name}?`}
                description="Ela volta a conseguir entrar no portal com o mesmo e-mail e senha."
                confirmLabel="Reativar acesso"
                onConfirm={() =>
                  block.mutate(
                    { userId: access.userId!, blocked: false },
                    { onSuccess: () => toast.success("Acesso reativado.") },
                  )
                }
              />
            )}
          </div>
          {linkMissing && access.status === "active" && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              Acesso criado, mas o link não foi gerado. Use “Gerar novo link”.
            </p>
          )}
          {link && <AccessLink link={link} onClose={() => setLink(null)} />}
        </>
      )}
    </section>
  );
}

function PackageSection({ clientId }: { clientId: string }) {
  const packagesQuery = useQuery(adminPackagesQuery(clientId));
  const active = (packagesQuery.data ?? []).find((pkg) => pkg.status === "active") ?? null;
  return (
    <section aria-labelledby="client-package" className={sectionClass}>
      <h2 id="client-package" className={sectionTitleClass}>
        Pacote ativo
      </h2>
      {packagesQuery.isLoading ? (
        <Skeleton className="mt-4 h-11" />
      ) : packagesQuery.isError ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Não foi possível carregar os pacotes.
        </p>
      ) : active ? (
        <dl className="mt-3 grid gap-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Plano</dt>
            <dd className="min-w-0 text-right text-foreground">{active.plan_name_snapshot}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Publicações</dt>
            <dd className="text-right text-foreground">{active.posts_total}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Período</dt>
            <dd className="text-right text-foreground">
              {formatNumeric(active.start_date)} a {formatNumeric(active.end_date)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Sem pacote ativo.</p>
      )}
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground sm:text-right">{value || "—"}</dd>
    </div>
  );
}

export function ClientSheet({
  client,
  onBack,
  onOpenDelivery,
  onPreview,
}: {
  client: Client;
  onBack: () => void;
  onOpenDelivery: (clientId: string) => void;
  onPreview: (clientId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const accessQuery = useQuery(adminAccessQuery(client));
  const archived = !!client.archived_at;
  const archive = useClientMutation((next: boolean) => setClientArchived(client.id, next));
  const accessActive = accessQuery.data?.status === "active";

  return (
    <div className="page-enter min-w-0">
      <Button variant="ghost" size="sm" className="-ml-2 mb-4" onClick={onBack}>
        <ArrowLeft />
        Voltar para clientes
      </Button>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary-glow">Ficha da cliente</p>
          <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {client.business_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[client.display_name, client.profession].filter(Boolean).join(" · ")}
          </p>
        </div>
        {archived && (
          <span className="shrink-0 rounded-full bg-surface-3 px-2 py-1 text-[11px] font-semibold text-muted-foreground">
            Arquivada
          </span>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {editing ? (
          <div className="lg:col-span-2">
            <ClientForm client={client} onClose={() => setEditing(false)} />
          </div>
        ) : (
          <section aria-labelledby="client-data" className={sectionClass}>
            <div className="flex items-center justify-between gap-3">
              <h2 id="client-data" className={sectionTitleClass}>
                Dados
              </h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing(true)}
                aria-label={`Editar dados de ${client.business_name}`}
              >
                <Pencil />
                Editar
              </Button>
            </div>
            <dl className="mt-3 grid gap-2 text-xs">
              <DataRow label="Nome de exibição" value={client.display_name} />
              <DataRow label="Nome do negócio" value={client.business_name} />
              <DataRow label="Profissão" value={client.profession} />
              <DataRow label="E-mail" value={client.email} />
              <DataRow label="Telefone" value={client.phone} />
            </dl>
          </section>
        )}

        <AccessSection client={client} />
        <PackageSection clientId={client.id} />

        <section aria-labelledby="client-actions" className={sectionClass}>
          <h2 id="client-actions" className={sectionTitleClass}>
            Ações
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => onOpenDelivery(client.id)}>
              <Send />
              Abrir entregas
            </Button>
            <Button variant="secondary" onClick={() => onPreview(client.id)}>
              <Eye />
              Ver como cliente
            </Button>
          </div>
          {!archived && accessActive && (
            <p className="mt-4 text-xs text-muted-foreground">
              Arquivar não suspende o acesso. Para impedir o login, suspenda o acesso.
            </p>
          )}
          <div className="mt-3">
            {archived ? (
              <Confirm
                trigger={
                  <Button variant="outline" className="w-full" disabled={archive.isPending}>
                    <ArchiveRestore />
                    Restaurar
                  </Button>
                }
                title={`Restaurar ${client.business_name}?`}
                description="A cliente volta para a lista de ativas."
                confirmLabel="Restaurar cliente"
                onConfirm={() =>
                  archive.mutate(false, { onSuccess: () => toast.success("Cliente restaurada.") })
                }
              />
            ) : (
              <Confirm
                trigger={
                  <Button variant="outline" className="w-full" disabled={archive.isPending}>
                    <Archive />
                    Arquivar
                  </Button>
                }
                title={`Arquivar ${client.business_name}?`}
                description={
                  accessActive
                    ? "Ela sai da lista de ativas. Arquivar não suspende o acesso: a cliente continua conseguindo entrar."
                    : "Ela sai da lista de ativas. Os dados e o histórico são mantidos."
                }
                confirmLabel="Arquivar cliente"
                onConfirm={() =>
                  archive.mutate(true, { onSuccess: () => toast.success("Cliente arquivada.") })
                }
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
