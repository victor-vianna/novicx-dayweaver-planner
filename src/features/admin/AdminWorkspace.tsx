import { useQuery } from "@tanstack/react-query";
import { Clock3, LayoutDashboard, PackageCheck, Send, Tags, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { AdminMetric } from "@/components/common/MetricCards";
import { DemoTag, ErrorState, SectionTitle } from "@/components/common/States";
import { WorkspaceSkeleton } from "@/components/common/WorkspaceStates";
import { AppFrame } from "@/components/layout/AppFrame";
import { PostListItem } from "@/components/post/PostListItem";
import { ClientCard } from "@/features/admin/ClientCard";
import { ClientsView } from "@/features/admin/clients/ClientsView";
import { ClientDelivery } from "@/features/admin/delivery/ClientDelivery";
import { activeClientIds } from "@/features/admin/metrics";
import { type AdminView, readAdminNav, writeAdminNav } from "@/features/admin/navigation";
import { PlansView } from "@/features/admin/plans/PlansView";
import {
  adminActivePackagesQuery,
  adminClientsQuery,
  adminEndingQuery,
  adminUpcomingQuery,
} from "@/features/admin/queries";
import { useAuth } from "@/features/auth/useAuth";
import { greeting, todayISO } from "@/lib/dates";

export function AdminWorkspace() {
  const { session, startPreview } = useAuth();
  const profileId = session?.profile.id;
  // Survives a reload in the same tab (sessionStorage, per profile).
  const [nav, setNav] = useState(() => readAdminNav(profileId));
  const [menuOpen, setMenuOpen] = useState(false);
  const { view, deliveryClientId } = nav;
  const setView = (next: AdminView) => setNav({ view: next, deliveryClientId: null });
  const setDeliveryClientId = (id: string | null) =>
    setNav((n) => ({ ...n, deliveryClientId: id }));
  useEffect(() => writeAdminNav(profileId, nav), [profileId, nav]);
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
  const activeIds = activeClientIds(clients, packages);

  return (
    <AppFrame
      name={session?.profile.full_name ?? "Equipe NOVICX"}
      role="Painel administrativo"
      menuOpen={menuOpen}
      onMenuOpen={setMenuOpen}
      nav={[
        { id: "overview", label: "Visão geral", icon: LayoutDashboard },
        { id: "clients", label: "Clientes", icon: Users },
        { id: "plans", label: "Planos", icon: Tags },
      ]}
      active={view}
      onNavigate={(id) => {
        setDeliveryClientId(null);
        setView(id as AdminView);
      }}
    >
      {deliveryClientId ? (
        <ClientDelivery
          clientId={deliveryClientId}
          onBack={() => {
            setDeliveryClientId(null);
            setView("clients");
          }}
          onPreview={() => startPreview(deliveryClientId)}
        />
      ) : view === "plans" ? (
        <PlansView />
      ) : view === "overview" ? (
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
            <AdminMetric icon={Users} value={activeIds.size} label="Clientes ativas" />
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
                    onOpen={() => setDeliveryClientId(post.client_id)}
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
                Clientes ativas
              </SectionTitle>
              <div className="space-y-3">
                {clients
                  .filter((client) => activeIds.has(client.id))
                  .map((client) => (
                    <ClientCard
                      key={client.id}
                      client={client}
                      pkg={packages.find((item) => item.client_id === client.id)}
                      onPreview={() => setDeliveryClientId(client.id)}
                    />
                  ))}
              </div>
            </section>
          </div>
        </div>
      ) : (
        <ClientsView
          onOpenDelivery={(id) => setDeliveryClientId(id)}
          onPreview={(id) => startPreview(id)}
        />
      )}
    </AppFrame>
  );
}
