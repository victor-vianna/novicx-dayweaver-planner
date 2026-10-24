// Shown after opening the password-recovery link sent by e-mail.
import { KeyRound, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";

const inputClass =
  "h-12 w-full rounded-xl border border-input bg-background/45 px-4 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

export function NewPasswordScreen() {
  const { completePasswordReset } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirm) return setError("As senhas não conferem.");
    setBusy(true);
    try {
      await completePasswordReset(password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível alterar a senha.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="bg-auth flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border-strong bg-surface/90 p-6 shadow-lift backdrop-blur-xl sm:p-8">
        <div className="mb-8 flex flex-col items-center">
          <Wordmark />
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary-glow">
          <KeyRound className="h-5 w-5" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">Nova senha</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Escolha uma senha com pelo menos 8 caracteres.
        </p>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-muted-foreground">
              Nova senha
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-muted-foreground">
              Confirme a senha
            </span>
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className={inputClass}
              autoComplete="new-password"
              minLength={8}
              required
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
          <Button className="w-full" size="lg" disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
            Salvar nova senha
          </Button>
        </form>
      </section>
    </main>
  );
}
