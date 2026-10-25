// Plan catalog (admin): create, edit and pause plans. Editing a plan never
// changes packages already contracted — they keep name, quantity and slots.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Plus, Tags } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, Skeleton } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { adminPlansQuery } from "@/features/admin/queries";
import { WEEKDAYS_SHORT } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { createPlan, updatePlan } from "@/services/plans";
import type { Plan, Weekday } from "@/types/domain";

import { emptyDraft, parseDraft, type PlanDraft, toDraft } from "./plan-form";

const fieldClass =
  "h-11 w-full rounded-xl border border-input bg-background/45 px-4 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20";
const labelClass = "mb-2 block text-xs font-semibold text-muted-foreground";

function usePlanSave(onDone: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, draft }: { id: string | null; draft: PlanDraft }) => {
      const parsed = parseDraft(draft);
      if ("error" in parsed) throw new Error(parsed.error);
      return id ? updatePlan(id, parsed.input) : createPlan(parsed.input);
    },
    onSuccess: async (_plan, { id }) => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success(id ? "Plano atualizado." : "Plano criado.");
      onDone();
    },
    onError: (error) => toast.error(error.message || "Não foi possível salvar o plano."),
  });
}

function PlanForm({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const [draft, setDraft] = useState<PlanDraft>(() => (plan ? toDraft(plan) : emptyDraft()));
  const [error, setError] = useState("");
  const save = usePlanSave(onClose);
  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const toggleDay = (day: Weekday) =>
    set(
      "default_weekdays",
      draft.default_weekdays.includes(day)
        ? draft.default_weekdays.filter((d) => d !== day)
        : [...draft.default_weekdays, day],
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseDraft(draft);
    if ("error" in parsed) return setError(parsed.error);
    setError("");
    save.mutate({ id: plan?.id ?? null, draft });
  };

  const title = plan ? `Editar ${plan.name}` : "Novo plano";
  return (
    <form
      onSubmit={submit}
      aria-label={title}
      className="rounded-2xl border border-primary/30 bg-surface p-5 shadow-soft"
    >
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
      {plan && (
        <p className="mt-1 text-xs text-muted-foreground">
          Pacotes já contratados mantêm o nome, a quantidade e os horários de quando foram criados.
        </p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelClass}>Nome</span>
          <input
            className={fieldClass}
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className={labelClass}>Publicações por período</span>
          <input
            className={fieldClass}
            type="number"
            min={1}
            max={60}
            inputMode="numeric"
            value={draft.posts_per_period}
            onChange={(e) => set("posts_per_period", e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className={labelClass}>Duração do período (dias)</span>
          <input
            className={fieldClass}
            type="number"
            min={1}
            max={365}
            inputMode="numeric"
            value={draft.period_days}
            onChange={(e) => set("period_days", e.target.value)}
            required
          />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className={labelClass}>Dias da semana</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS_SHORT.map((label, i) => {
              const day = i as Weekday;
              const on = draft.default_weekdays.includes(day);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "pressable h-10 min-w-12 rounded-xl border px-3 text-xs font-semibold",
                    on
                      ? "border-primary/50 bg-primary-soft text-primary-glow"
                      : "border-border bg-background/45 text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="block sm:col-span-2">
          <span className={labelClass}>Horários (HH:mm, separados por vírgula)</span>
          <input
            className={fieldClass}
            value={draft.default_times}
            onChange={(e) => set("default_times", e.target.value)}
            placeholder="10:00, 18:30"
            required
          />
        </label>
        <label className="flex items-center gap-3 text-sm text-foreground sm:col-span-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={draft.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          Disponível para novas contratações
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <LoaderCircle className="animate-spin" />}
          {plan ? "Salvar" : "Criar plano"}
        </Button>
      </div>
    </form>
  );
}

function PlanCard({ plan, onEdit }: { plan: Plan; onEdit: () => void }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{plan.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {plan.posts_per_period} publicações a cada {plan.period_days} dias
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold",
            plan.active ? "bg-success-soft text-success" : "bg-surface-3 text-muted-foreground",
          )}
        >
          {plan.active ? "Ativo" : "Pausado"}
        </span>
      </div>
      <dl className="mt-4 grid gap-2 border-t border-border pt-3 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Dias</dt>
          <dd className="text-right text-foreground">
            {plan.default_weekdays.map((d) => WEEKDAYS_SHORT[d]).join(", ") || "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Horários</dt>
          <dd className="text-right text-foreground">{plan.default_times.join(", ") || "—"}</dd>
        </div>
      </dl>
      <Button
        variant="secondary"
        className="mt-4 w-full"
        onClick={onEdit}
        aria-label={`Editar ${plan.name}`}
      >
        <Pencil />
        Editar
      </Button>
    </article>
  );
}

export function PlansView() {
  const plansQuery = useQuery(adminPlansQuery());
  // null = closed, "new" = creating, otherwise the plan being edited.
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const plans = [...(plansQuery.data ?? [])].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt-BR"),
  );

  return (
    <div className="page-enter">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary-glow">Catálogo</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Planos
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Defina quantidade, período e horários padrão. Planos pausados não aparecem para novas
            contratações.
          </p>
        </div>
        {editing === null && (
          <Button onClick={() => setEditing("new")}>
            <Plus />
            Novo plano
          </Button>
        )}
      </header>

      {editing !== null && (
        <div className="mb-6">
          <PlanForm
            key={editing === "new" ? "new" : editing.id}
            plan={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
          />
        </div>
      )}

      {plansQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : plansQuery.isError ? (
        <ErrorState onRetry={() => void plansQuery.refetch()} />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nenhum plano ainda"
          description="Crie o primeiro plano para contratar pacotes para as clientes."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onEdit={() => setEditing(plan)} />
          ))}
        </div>
      )}
    </div>
  );
}
