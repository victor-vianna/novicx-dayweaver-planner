import { LoaderCircle, Users } from "lucide-react";

import { Wordmark } from "@/components/brand/Wordmark";
import { EmptyState, Skeleton } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";

export function LoadingScreen() {
  return (
    <main className="bg-auth grid min-h-screen place-items-center px-6">
      <div className="flex flex-col items-center gap-5">
        <Wordmark />
        <LoaderCircle className="h-5 w-5 animate-spin text-primary-glow" aria-label="Carregando" />
      </div>
    </main>
  );
}

export function WorkspaceSkeleton() {
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

export function MissingClient() {
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
