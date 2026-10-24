// Delivery workspace for one client: package, calendar with every slot
// (drafts included), the day's publications and the post editor.
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Eye, LoaderCircle, PackagePlus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { CalendarLegend, MonthCalendar } from "@/components/calendar/MonthCalendar";
import { EmptyState, ErrorState, SectionTitle, Skeleton } from "@/components/common/States";
import { PostListItem } from "@/components/post/PostListItem";
import { Button } from "@/components/ui/button";
import {
  adminClientQuery,
  adminPackagesQuery,
  adminPlansQuery,
  adminPostsQuery,
  useDeliveryMutation,
} from "@/features/admin/queries";
import { formatLong, formatNumeric, parseISO, shiftMonth, todayISO } from "@/lib/dates";
import { getDisplayStatus } from "@/lib/status";
import { assignPlan } from "@/services/packages";
import { createPost } from "@/services/posts";

import { PostEditor } from "./PostEditor";

const fieldClass =
  "h-11 w-full rounded-xl border border-input bg-background/45 px-4 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

function AssignPlanForm({ clientId, hasPackage }: { clientId: string; hasPackage: boolean }) {
  const plansQuery = useQuery(adminPlansQuery());
  const plans = (plansQuery.data ?? []).filter((plan) => plan.active);
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const assign = useDeliveryMutation(
    clientId,
    assignPlan,
    "Pacote criado com os horários do plano.",
  );

  return (
    <form
      className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (planId) assign.mutate({ clientId, planId, startDate });
      }}
    >
      <label className="block">
        <span className="mb-2 block text-xs font-semibold text-muted-foreground">
          {hasPackage ? "Renovar com o plano" : "Plano"}
        </span>
        <select
          value={planId}
          onChange={(event) => setPlanId(event.target.value)}
          className={fieldClass}
          required
        >
          <option value="">Escolha um plano</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-semibold text-muted-foreground">Início</span>
        <input
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          className={fieldClass}
          required
        />
      </label>
      <Button type="submit" disabled={!planId || assign.isPending}>
        {assign.isPending ? <LoaderCircle className="animate-spin" /> : <PackagePlus />}
        {hasPackage ? "Renovar" : "Criar pacote"}
      </Button>
    </form>
  );
}

export function ClientDelivery({
  clientId,
  onBack,
  onPreview,
}: {
  clientId: string;
  onBack: () => void;
  onPreview: () => void;
}) {
  const today = todayISO();
  const parsedToday = parseISO(today);
  const [visibleMonth, setVisibleMonth] = useState({ y: parsedToday.y, m: parsedToday.m });
  const [selectedDate, setSelectedDate] = useState(today);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const clientQuery = useQuery(adminClientQuery(clientId));
  const packagesQuery = useQuery(adminPackagesQuery(clientId));
  const postsQuery = useQuery(adminPostsQuery(clientId));

  const activePackage = (packagesQuery.data ?? []).find((pkg) => pkg.status === "active") ?? null;
  const posts = useMemo(() => postsQuery.data ?? [], [postsQuery.data]);
  const entries = useMemo(
    () =>
      posts.map((post) => ({
        id: post.id,
        date: post.scheduled_date,
        status: getDisplayStatus(post, today),
      })),
    [posts, today],
  );
  const dayPosts = posts.filter((post) => post.scheduled_date === selectedDate);
  const editing = posts.find((post) => post.id === editingId) ?? null;

  const addPost = useDeliveryMutation(clientId, createPost, "Publicação adicionada como rascunho.");

  if (clientQuery.isLoading || packagesQuery.isLoading || postsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (clientQuery.isError || packagesQuery.isError || postsQuery.isError || !clientQuery.data) {
    return (
      <ErrorState
        onRetry={() => {
          void clientQuery.refetch();
          void packagesQuery.refetch();
          void postsQuery.refetch();
        }}
      />
    );
  }

  const client = clientQuery.data;
  const used = activePackage
    ? posts.filter((post) => post.client_package_id === activePackage.id).length
    : 0;

  return (
    <div className="page-enter">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Clientes
          </button>
          <p className="text-sm font-medium text-primary-glow">Entrega de materiais</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {client.business_name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {client.user_id ? client.email : `${client.email} · ainda sem acesso ao portal`}
          </p>
        </div>
        <Button variant="secondary" onClick={onPreview}>
          <Eye /> Ver como cliente
        </Button>
      </header>

      <section className="mb-6 rounded-3xl border border-border bg-surface p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Pacote atual</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {activePackage ? activePackage.plan_name_snapshot : "Sem pacote ativo"}
            </p>
            {activePackage && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatNumeric(activePackage.start_date)} a {formatNumeric(activePackage.end_date)}{" "}
                · {used} de {activePackage.posts_total} publicações
              </p>
            )}
          </div>
          <Button variant="soft" size="sm" onClick={() => setShowAssign((value) => !value)}>
            <PackagePlus /> {activePackage ? "Renovar pacote" : "Criar pacote"}
          </Button>
        </div>
        {(showAssign || !activePackage) && (
          <AssignPlanForm clientId={clientId} hasPackage={Boolean(activePackage)} />
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-3xl border border-border bg-surface p-4 shadow-soft sm:p-6">
          <MonthCalendar
            year={visibleMonth.y}
            month={visibleMonth.m}
            onMonthChange={(delta) =>
              setVisibleMonth(shiftMonth(visibleMonth.y, visibleMonth.m, delta))
            }
            selected={selectedDate}
            onSelect={setSelectedDate}
            entries={entries}
            today={today}
          />
          <CalendarLegend className="mt-5 border-t border-border pt-5" />
        </section>
        <section>
          <SectionTitle
            action={
              activePackage && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={addPost.isPending}
                  onClick={() =>
                    addPost.mutate(
                      {
                        clientId,
                        packageId: activePackage.id,
                        scheduledDate: selectedDate,
                        scheduledTime: "10:00",
                        title: "Nova publicação",
                      },
                      { onSuccess: (post) => setEditingId(post.id) },
                    )
                  }
                >
                  <Plus /> Adicionar
                </Button>
              )
            }
          >
            {formatLong(selectedDate)}
          </SectionTitle>
          <div className="space-y-3">
            {dayPosts.length ? (
              dayPosts.map((post) => (
                <PostListItem key={post.id} post={post} today={today} onOpen={setEditingId} />
              ))
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="Dia livre"
                description={
                  activePackage
                    ? "Nenhuma publicação nesta data. Use “Adicionar” para criar uma."
                    : "Crie um pacote para gerar as datas das publicações."
                }
                className="bg-surface"
              />
            )}
          </div>
        </section>
      </div>

      <PostEditor post={editing} clientId={clientId} onClose={() => setEditingId(null)} />
    </div>
  );
}
