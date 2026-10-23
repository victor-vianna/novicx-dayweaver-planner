import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Download,
  Eye,
  FileText,
  Home,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  PackageCheck,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { MonthCalendar, CalendarLegend } from "@/components/calendar/MonthCalendar";
import {
  DemoTag,
  EmptyState,
  ErrorState,
  SectionTitle,
  Skeleton,
} from "@/components/common/States";
import { Wordmark } from "@/components/brand/Wordmark";
import { CaptionBlock } from "@/components/post/CaptionBlock";
import { MediaCarousel } from "@/components/post/MediaCarousel";
import { PostListItem, formatLabel } from "@/components/post/PostListItem";
import { StatusBadge } from "@/components/post/StatusBadge";
import { useSaveArt } from "@/components/post/useSaveArt";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  adminActivePackagesQuery,
  adminClientsQuery,
  adminEndingQuery,
  adminUpcomingQuery,
} from "@/features/admin/queries";
import { useAuth } from "@/features/auth/useAuth";
import {
  portalClientQuery,
  portalPackagesQuery,
  portalPostsQuery,
  useTogglePublished,
} from "@/features/client/queries";
import {
  formatLong,
  formatNumeric,
  formatWeekdayLong,
  greeting,
  parseISO,
  shiftMonth,
  todayISO,
} from "@/lib/dates";
import { getDisplayStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import { DEMO_LOGIN_PREFILL } from "@/services/auth";
import type { Actor, Client, ClientPackage, PostWithMedia } from "@/types/domain";

type ClientView = "overview" | "calendar";
type AdminView = "overview" | "clients";

export function PlannerApp() {
  const auth = useAuth();

  if (auth.status === "loading") return <LoadingScreen />;
  if (auth.status === "signed_out" || !auth.session) return <LoginScreen />;

  if (auth.session.profile.role === "admin") {
    if (auth.previewClientId) {
      return <ClientWorkspace clientId={auth.previewClientId} preview />;
    }
    return <AdminWorkspace />;
  }

  if (!auth.session.client) return <MissingClient />;
  return <ClientWorkspace clientId={auth.session.client.id} />;
}

function LoadingScreen() {
  return (
    <main className="bg-auth grid min-h-screen place-items-center px-6">
      <div className="flex flex-col items-center gap-5">
        <Wordmark />
        <LoaderCircle className="h-5 w-5 animate-spin text-primary-glow" aria-label="Carregando" />
      </div>
    </main>
  );
}

function LoginScreen() {
  const { signIn, signInAsDemo } = useAuth();
  const [email, setEmail] = useState<string>(DEMO_LOGIN_PREFILL.email);
  const [password, setPassword] = useState<string>(DEMO_LOGIN_PREFILL.password);
  const [busy, setBusy] = useState<"form" | "client" | "admin" | null>(null);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("form");
    setError("");
    try {
      await signIn(email, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar.");
    } finally {
      setBusy(null);
    }
  };

  const enterDemo = async (role: "client" | "admin") => {
    setBusy(role);
    setError("");
    try {
      await signInAsDemo(role);
    } catch {
      setError("Não foi possível abrir a demonstração.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="bg-auth relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -left-36 top-20 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-12 px-5 py-10 lg:grid-cols-[1.05fr_.95fr] lg:px-10">
        <section className="hidden max-w-xl lg:block">
          <div className="mb-12 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
              <Sparkles className="h-5 w-5 text-white" />
            </span>
            <Wordmark variant="inline" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary-glow">
            Conteúdo em movimento
          </p>
          <h1 className="mt-5 font-display text-6xl font-semibold leading-[.96] tracking-tight text-foreground">
            Sua rotina de conteúdo, finalmente leve.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Acompanhe cada publicação, baixe suas artes e organize o mês inteiro sem planilhas ou
            mensagens perdidas.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              [CalendarDays, "Calendário visual"],
              [Download, "Artes prontas"],
              [CheckCircle2, "Status em tempo real"],
            ].map(([Icon, label]) => {
              const ItemIcon = Icon as typeof CalendarDays;
              return (
                <div
                  key={label as string}
                  className="rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur-sm"
                >
                  <ItemIcon className="h-5 w-5 text-primary-glow" />
                  <p className="mt-3 text-sm font-semibold text-foreground">{label as string}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-3xl border border-border-strong bg-surface/90 p-6 shadow-lift backdrop-blur-xl sm:p-8">
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <Wordmark />
          </div>
          <div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary-glow">
              <CircleUserRound className="h-5 w-5" />
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
              Bem-vindo de volta
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Entre para acessar seu planejamento de conteúdo.
            </p>
          </div>

          <form className="mt-7 space-y-4" onSubmit={submit}>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-muted-foreground">E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 w-full rounded-xl border border-input bg-background/45 px-4 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                autoComplete="email"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-muted-foreground">Senha</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-xl border border-input bg-background/45 px-4 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                autoComplete="current-password"
              />
            </label>
            {error && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button className="w-full" size="lg" disabled={busy !== null}>
              {busy === "form" ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
              Entrar no Planner
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-widest text-subtle-foreground">
            <span className="h-px flex-1 bg-border" /> ou acesse a demo{" "}
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => enterDemo("client")}
            >
              {busy === "client" ? <LoaderCircle className="animate-spin" /> : <Eye />}
              Área cliente
            </Button>
            <Button variant="outline" disabled={busy !== null} onClick={() => enterDemo("admin")}>
              {busy === "admin" ? <LoaderCircle className="animate-spin" /> : <LayoutDashboard />}
              Área equipe
            </Button>
          </div>
          <DemoTag className="mt-6 w-full justify-center" />
        </section>
      </div>
    </main>
  );
}

function ClientWorkspace({ clientId, preview = false }: { clientId: string; preview?: boolean }) {
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

  const posts = postsQuery.data ?? [];
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;
  const entries = posts.map((post) => ({
    id: post.id,
    date: post.scheduled_date,
    status: getDisplayStatus(post, today),
  }));
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
  const currentPackage = packagesQuery.data?.find((item) => item.status === "active") ?? null;
  const published = posts.filter((post) => post.status === "published").length;
  const pending = posts.filter((post) => getDisplayStatus(post, today) === "pending").length;
  const ready = posts.filter((post) => getDisplayStatus(post, today) === "ready").length;
  const upcoming = posts.filter((post) => post.status !== "published").slice(0, 4);
  const usedInPackage = currentPackage
    ? posts.filter(
        (post) => post.client_package_id === currentPackage.id && post.status === "published",
      ).length
    : published;
  const packageProgress = currentPackage
    ? Math.round((usedInPackage / currentPackage.posts_total) * 100)
    : 0;

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
      />
    </AppFrame>
  );
}

function AdminWorkspace() {
  const [view, setView] = useState<AdminView>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const { session, startPreview } = useAuth();
  const clientsQuery = useQuery(adminClientsQuery(false));
  const packagesQuery = useQuery(adminActivePackagesQuery());
  const upcomingQuery = useQuery(adminUpcomingQuery());
  const endingQuery = useQuery(adminEndingQuery());
  const today = todayISO();

  if (
    clientsQuery.isLoading ||
    packagesQuery.isLoading ||
    upcomingQuery.isLoading ||
    endingQuery.isLoading
  ) {
    return <WorkspaceSkeleton />;
  }
  if (
    clientsQuery.isError ||
    packagesQuery.isError ||
    upcomingQuery.isError ||
    endingQuery.isError
  ) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <ErrorState onRetry={() => window.location.reload()} />
      </main>
    );
  }

  const clients = clientsQuery.data ?? [];
  const packages = packagesQuery.data ?? [];
  const upcoming = upcomingQuery.data ?? [];
  const ending = endingQuery.data ?? [];
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const activeClientIds = new Set(packages.map((item) => item.client_id));

  return (
    <AppFrame
      name={session?.profile.full_name ?? "Equipe NOVICX"}
      role="Painel administrativo"
      menuOpen={menuOpen}
      onMenuOpen={setMenuOpen}
      nav={[
        { id: "overview", label: "Visão geral", icon: LayoutDashboard },
        { id: "clients", label: "Clientes", icon: Users },
      ]}
      active={view}
      onNavigate={(id) => setView(id as AdminView)}
    >
      {view === "overview" ? (
        <div className="page-enter">
          <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary-glow">{greeting()}, equipe</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Tudo sob controle.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Uma visão rápida das entregas e dos pacotes ativos.
              </p>
            </div>
            <DemoTag />
          </header>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AdminMetric icon={Users} value={clients.length} label="Clientes" />
            <AdminMetric icon={PackageCheck} value={packages.length} label="Pacotes ativos" />
            <AdminMetric icon={Send} value={upcoming.length} label="Próximas entregas" />
            <AdminMetric icon={Clock3} value={ending.length} label="Encerrando em breve" />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
            <section>
              <SectionTitle>Próximas entregas</SectionTitle>
              <div className="space-y-3">
                {upcoming.map((post) => (
                  <PostListItem
                    key={post.id}
                    post={post}
                    today={today}
                    subtitle={clientsById.get(post.client_id)?.business_name ?? "Cliente"}
                    onOpen={() => startPreview(post.client_id)}
                  />
                ))}
              </div>
            </section>
            <section>
              <SectionTitle
                action={
                  <button
                    className="text-xs font-semibold text-primary-glow"
                    onClick={() => setView("clients")}
                  >
                    Ver todos
                  </button>
                }
              >
                Clientes ativos
              </SectionTitle>
              <div className="space-y-3">
                {clients
                  .filter((client) => activeClientIds.has(client.id))
                  .map((client) => (
                    <ClientCard
                      key={client.id}
                      client={client}
                      pkg={packages.find((item) => item.client_id === client.id)}
                      onPreview={() => startPreview(client.id)}
                    />
                  ))}
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="page-enter">
          <header className="mb-7">
            <p className="text-sm font-medium text-primary-glow">Relacionamento</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Clientes
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Acesse o portal de cada cliente e acompanhe o pacote atual.
            </p>
          </header>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                pkg={packages.find((item) => item.client_id === client.id)}
                expanded
                onPreview={() => startPreview(client.id)}
              />
            ))}
          </div>
        </div>
      )}
    </AppFrame>
  );
}

function AppFrame({
  name,
  role,
  nav,
  active,
  onNavigate,
  menuOpen,
  onMenuOpen,
  preview,
  children,
}: {
  name: string;
  role: string;
  nav: { id: string; label: string; icon: typeof Home }[];
  active: string;
  onNavigate: (id: string) => void;
  menuOpen: boolean;
  onMenuOpen: (open: boolean) => void;
  preview?: boolean;
  children: ReactNode;
}) {
  const { signOut, stopPreview } = useAuth();
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {preview && (
        <div className="sticky top-0 z-40 flex h-11 items-center justify-center gap-3 bg-primary px-4 text-xs font-semibold text-primary-foreground">
          <Eye className="h-4 w-4" /> Você está visualizando o portal do cliente
          <button
            type="button"
            onClick={stopPreview}
            className="rounded-lg bg-white/15 px-2.5 py-1 hover:bg-white/25"
          >
            Voltar ao painel
          </button>
        </div>
      )}

      <header
        className={cn(
          "sticky z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl lg:hidden",
          preview ? "top-11" : "top-0",
        )}
      >
        <Wordmark variant="inline" />
        <button
          type="button"
          className="pressable grid h-10 w-10 place-items-center rounded-xl bg-surface"
          onClick={() => onMenuOpen(!menuOpen)}
          aria-label="Abrir menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/55 lg:hidden"
          onClick={() => onMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar p-5 transition-transform duration-200 lg:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between px-2">
          <Wordmark variant="inline" />
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-sidebar-accent lg:hidden"
            onClick={() => onMenuOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="mt-8 space-y-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  onMenuOpen(false);
                }}
                className={cn(
                  "pressable flex h-12 w-full items-center gap-3 rounded-xl px-3.5 text-left text-sm font-semibold",
                  selected
                    ? "bg-primary-soft text-primary-glow"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <Icon className="h-[18px] w-[18px]" /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto">
          <div className="mb-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/45 p-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-primary text-xs font-bold text-white">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{role}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="pressable flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut className="h-[18px] w-[18px]" /> Sair
          </button>
        </div>
      </aside>

      <main className="pb-24 lg:ml-72 lg:pb-10">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-9 lg:px-9">{children}</div>
      </main>

      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-background/95 px-3 pb-2 pt-2 backdrop-blur-xl lg:hidden"
        style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
      >
        {nav.map((item) => {
          const Icon = item.icon;
          const selected = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={cn(
                "pressable flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold",
                selected ? "text-primary-glow" : "text-subtle-foreground",
              )}
            >
              <Icon className="h-5 w-5" /> {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Home;
  value: number;
  label: string;
  tone: "success" | "primary" | "warning";
}) {
  const tones = {
    success: "bg-success-soft text-success",
    primary: "bg-primary-soft text-primary-glow",
    warning: "bg-warning-soft text-warning",
  };
  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5 shadow-soft sm:p-5">
      <span className={cn("grid h-9 w-9 place-items-center rounded-xl", tones[tone])}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-4 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground sm:text-xs">
        {label}
      </p>
    </div>
  );
}

function AdminMetric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Home;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary-glow">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <BarChart3 className="h-4 w-4 text-subtle-foreground" />
      </div>
      <p className="mt-5 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ClientCard({
  client,
  pkg,
  onPreview,
  expanded,
}: {
  client: Client;
  pkg?: ClientPackage | undefined;
  onPreview: () => void;
  expanded?: boolean;
}) {
  const initials = client.business_name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <button
      type="button"
      onClick={onPreview}
      className={cn(
        "pressable group w-full rounded-2xl border border-border bg-surface p-4 text-left shadow-soft hover:border-primary/35 hover:bg-surface-2",
        expanded && "p-5",
      )}
    >
      <div className="flex items-center gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-xs font-bold text-primary-glow">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{client.business_name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{client.profession}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-subtle-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary-glow" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px]">
        <span className="truncate text-muted-foreground">
          {pkg?.plan_name_snapshot ?? "Sem pacote ativo"}
        </span>
        <span
          className={cn(
            "ml-3 shrink-0 rounded-full px-2 py-1 font-semibold",
            pkg ? "bg-success-soft text-success" : "bg-surface-3 text-muted-foreground",
          )}
        >
          {pkg ? "Ativo" : "Inativo"}
        </span>
      </div>
    </button>
  );
}

function PostDetail({
  post,
  today,
  open,
  onOpenChange,
}: {
  post: PostWithMedia | null;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session } = useAuth();
  const save = useSaveArt(post);
  const actor: Actor =
    session?.profile.role === "admin"
      ? { role: "admin" }
      : { role: "client", clientId: session?.client?.id ?? "__missing_client__" };
  const togglePublished = useTogglePublished(actor);
  const [artIndex, setArtIndex] = useState(0);
  if (!post) return null;
  const status = getDisplayStatus(post, today);
  const published = post.status === "published";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-3xl border-border-strong bg-background p-0 sm:rounded-3xl">
        <DialogTitle className="sr-only">{post.title}</DialogTitle>
        <DialogDescription className="sr-only">Detalhes da publicação</DialogDescription>
        <div className="grid md:grid-cols-[minmax(280px,.85fr)_minmax(330px,1.15fr)]">
          <div className="bg-surface p-4 sm:p-6">
            <MediaCarousel
              media={post.media}
              title={post.title}
              onIndexChange={setArtIndex}
              showThumbs
            />
            {post.media.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => save.saveOne(artIndex)}
                  disabled={save.busy !== null}
                >
                  {save.busy === "one" ? <LoaderCircle className="animate-spin" /> : <Download />}{" "}
                  Salvar arte
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={save.saveAll}
                  disabled={save.busy !== null || post.media.length < 2}
                >
                  {save.busy === "all" ? <LoaderCircle className="animate-spin" /> : <Download />}{" "}
                  Salvar todas
                </Button>
              </div>
            )}
          </div>
          <div className="p-5 sm:p-7">
            <StatusBadge status={status} />
            <h2 className="mt-4 pr-7 text-2xl font-semibold tracking-tight text-foreground">
              {post.title}
            </h2>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatWeekdayLong(post.scheduled_date)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                {post.scheduled_time}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {formatLabel(post)}
              </span>
            </div>
            <CaptionBlock caption={post.caption} className="mt-6" />
            {post.status !== "draft" && (
              <div className="mt-5 rounded-2xl border border-border bg-surface p-4">
                <p className="text-sm font-semibold text-foreground">
                  {published ? "Já publicou?" : "Quando publicar"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {published
                    ? "Você pode desfazer a confirmação se marcou por engano."
                    : "Confirme aqui para manter seu calendário sempre atualizado."}
                </p>
                <Button
                  className="mt-4 w-full"
                  variant={published ? "outline" : "default"}
                  onClick={() => togglePublished.mutate({ postId: post.id, published: !published })}
                  disabled={togglePublished.isPending}
                >
                  {togglePublished.isPending ? (
                    <LoaderCircle className="animate-spin" />
                  ) : published ? (
                    <ArrowLeft />
                  ) : (
                    <Check />
                  )}
                  {published ? "Marcar como não publicado" : "Marcar como publicado"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="min-h-screen bg-background lg:pl-72">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-border bg-sidebar p-6 lg:block">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="mt-12 h-12 w-full" />
        <Skeleton className="mt-3 h-12 w-full" />
      </aside>
      <main className="mx-auto max-w-6xl p-6 sm:p-10">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-10 w-96 max-w-full" />
        <Skeleton className="mt-8 h-48 w-full rounded-3xl" />
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </main>
    </div>
  );
}

function MissingClient() {
  const { signOut } = useAuth();
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <EmptyState
        icon={Users}
        title="Perfil sem cliente"
        description="Este acesso ainda não está vinculado a um cadastro de cliente."
        action={<Button onClick={signOut}>Voltar ao login</Button>}
      />
    </main>
  );
}
