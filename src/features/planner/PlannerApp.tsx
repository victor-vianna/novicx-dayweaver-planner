import { AdminWorkspace } from "@/features/admin/AdminWorkspace";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { useAuth } from "@/features/auth/useAuth";
import { ClientWorkspace } from "@/features/client/ClientWorkspace";
import { LoadingScreen, MissingClient } from "@/components/common/WorkspaceStates";

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
