import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  Download,
  Eye,
  LayoutDashboard,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { Wordmark } from "@/components/brand/Wordmark";
import { DemoTag } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { isMockMode } from "@/lib/data-source";
import { DEMO_LOGIN_PREFILL } from "@/services/auth";

export function LoginScreen() {
  const { signIn, signInAsDemo, requestPasswordReset } = useAuth();
  // Demo shortcuts and prefilled credentials exist only in mock mode.
  const demo = isMockMode();
  const [email, setEmail] = useState<string>(demo ? DEMO_LOGIN_PREFILL.email : "");
  const [password, setPassword] = useState<string>(demo ? DEMO_LOGIN_PREFILL.password : "");
  const [busy, setBusy] = useState<"form" | "client" | "admin" | "reset" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const forgotPassword = async () => {
    setBusy("reset");
    setError("");
    setNotice("");
    try {
      await requestPasswordReset(email);
      setNotice("Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar o e-mail.");
    } finally {
      setBusy(null);
    }
  };

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
              <p
                role="alert"
                className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="rounded-xl bg-primary-soft px-3 py-2 text-sm text-foreground"
              >
                {notice}
              </p>
            )}
            <Button className="w-full" size="lg" disabled={busy !== null}>
              {busy === "form" ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
              Entrar no Planner
            </Button>
            {!demo && (
              <button
                type="button"
                onClick={forgotPassword}
                disabled={busy !== null}
                className="w-full text-center text-sm font-medium text-primary-glow hover:underline disabled:opacity-60"
              >
                {busy === "reset" ? "Enviando…" : "Esqueci minha senha"}
              </button>
            )}
          </form>

          {demo && (
            <>
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
                <Button
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => enterDemo("admin")}
                >
                  {busy === "admin" ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <LayoutDashboard />
                  )}
                  Área equipe
                </Button>
              </div>
              <DemoTag className="mt-6 w-full justify-center" />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
