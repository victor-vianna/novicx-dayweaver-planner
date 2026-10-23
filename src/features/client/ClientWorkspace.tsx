import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock3, Home, PackageCheck, Send } from "lucide-react";
import { useMemo, useState } from "react";

import { MonthCalendar, CalendarLegend } from "@/components/calendar/MonthCalendar";
import { MetricCard } from "@/components/common/MetricCards";
import { DemoTag, EmptyState, ErrorState, SectionTitle } from "@/components/common/States";
import { WorkspaceSkeleton } from "@/components/common/WorkspaceStates";
import { AppFrame } from "@/components/layout/AppFrame";
import { PostDetail } from "@/components/post/PostDetail";
import { PostListItem } from "@/components/post/PostListItem";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/features/auth/useAuth";
import {
  portalClientQuery,
  portalPackagesQuery,
  portalPostsQuery,
  useTogglePublished,
} from "@/features/client/queries";
import { summarizeClientPosts } from "@/features/client/summary";
import { formatLong, formatNumeric, greeting, parseISO, shiftMonth, todayISO } from "@/lib/dates";
import { getDisplayStatus } from "@/lib/status";
import type { Actor } from "@/types/domain";

type ClientView = "overview" | "calendar";

export function ClientWorkspace({
  clientId,
  preview = false,
}: {
  clientId: string;
  preview?: boolean;
}) {
  const [view, setView] = useState<ClientView>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const today = todayISO();
  const parsedToday = parseISO(today);
  const [visibleMonth, setVisibleMonth] = useState({ y: parsedToday.y, m: parsedToday.m });
  const [selectedDate, setSelectedDate] = useState(today);
  const clientQuery = useQuery(portalClientQuery(clientId));
  const postsQuery = useQuery(portalPostsQuery(clientId));
  const packagesQuery = useQuery(portalPackagesQuery(clientId));
  const { session } = useAuth();
  const actor: Actor =
    session?.profile.role === "admin"
      ? { role: "admin" }
      : { role: "client", clientId: session?.client?.id ?? "__missing_client__" };
  const togglePublished = useTogglePublished(actor);

  const posts = useMemo(() => postsQuery.data ?? [], [postsQuery.data]);
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;
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

  if (clientQuery.isLoading || postsQuery.isLoading || packagesQuery.isLoading) {
    return <WorkspaceSkeleton />;
  }
  if (clientQuery.isError || postsQuery.isError || packagesQuery.isError || !clientQuery.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <ErrorState onRetry={() => window.location.reload()} />
      </main>
    );
  }

  const client = clientQuery.data;
  const { currentPackage, published, pending, ready, upcoming, usedInPackage, packageProgress } =
    summarizeClientPosts(posts, packagesQuery.data ?? [], today);

  return (
    <AppFrame
      name={client.display_name}
      role={client.profession}
      menuOpen={menuOpen}
      onMenuOpen={setMenuOpen}
      nav={[
        { id: "overview", label: "Visão geral", icon: Home },
        { id: "calendar", label: "Calendário", icon: CalendarDays },
      ]}
      active={view}
      onNavigate={(id) => setView(id as ClientView)}
      preview={preview}
    >
      {view === "overview" ? (
        <div className="page-enter">
          <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary-glow">
                {greeting()}, {client.display_name}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Seu conteúdo está em dia.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Aqui está o ritmo do seu planejamento neste mês.
              </p>
            </div>
            <DemoTag />
          </header>

          <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/18 via-surface to-surface p-5 shadow-soft sm:p-7">
            <div className="pointer-events-none absolute -right-12 -top-14 h-52 w-52 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-background/40 px-3 py-1.5 text-xs font-semibold text-primary-glow">
                  <PackageCheck className="h-3.5 w-3.5" /> Pacote ativo
                </span>
                <h2 className="mt-4 text-xl font-semibold text-foreground">
                  {currentPackage?.plan_name_snapshot ?? "Nenhum pacote ativo"}
                </h2>
                {currentPackage && (
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {formatNumeric(currentPackage.start_date)} —{" "}
                    {formatNumeric(currentPackage.end_date)}
                  </p>
                )}
              </div>
              {currentPackage && (
                <div className="w-full sm:max-w-xs">
                  <div className="mb-2 flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">
                      {usedInPackage} de {currentPackage.posts_total} publicados
                    </span>
                    <span className="text-primary-glow">{packageProgress}%</span>
                  </div>
                  <Progress value={packageProgress} className="h-2.5 bg-background/45" />
                </div>
              )}
            </div>
          </section>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <MetricCard icon={CheckCircle2} value={published} label="Publicados" tone="success" />
            <MetricCard icon={Send} value={ready} label="Prontos" tone="primary" />
            <MetricCard icon={Clock3} value={pending} label="Pendentes" tone="warning" />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
            <section>
              <SectionTitle
                action={
                  <button
                    className="text-xs font-semibold text-primary-glow hover:text-foreground"
                    onClick={() => setView("calendar")}
                  >
                    Ver calendário
                  </button>
                }
              >
                Próximas publicações
              </SectionTitle>
              <div className="space-y-3">
                {upcoming.length ? (
                  upcoming.map((post) => (
                    <PostListItem
                      key={post.id}
                      post={post}
                      today={today}
                      onOpen={setSelectedPostId}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={CheckCircle2}
                    title="Tudo publicado"
                    description="Você não tem publicações pendentes agora."
                  />
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-surface p-4 shadow-soft sm:p-5">
              <MonthCalendar
                compact
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
              <CalendarLegend className="mt-4 border-t border-border pt-4" />
            </section>
          </div>
        </div>
      ) : (
        <div className="page-enter">
          <header className="mb-7">
            <p className="text-sm font-medium text-primary-glow">Planejamento</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Calendário de conteúdo
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Selecione um dia para ver as publicações programadas.
            </p>
          </header>
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
              <SectionTitle>{formatLong(selectedDate)}</SectionTitle>
              <div className="space-y-3">
                {dayPosts.length ? (
                  dayPosts.map((post) => (
                    <PostListItem
                      key={post.id}
                      post={post}
                      today={today}
                      onOpen={setSelectedPostId}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={CalendarDays}
                    title="Dia livre"
                    description="Não há publicações planejadas para esta data."
                    className="bg-surface"
                  />
                )}
              </div>
            </section>
          </div>
        </div>
      )}
      <PostDetail
        post={selectedPost}
        today={today}
        open={Boolean(selectedPost)}
        onOpenChange={(open) => !open && setSelectedPostId(null)}
        onTogglePublished={(postId, published) => togglePublished.mutate({ postId, published })}
        togglePending={togglePublished.isPending}
      />
    </AppFrame>
  );
}
