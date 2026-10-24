// Admin editor for one publication: arts, title, optional caption, date/time
// and status (draft → ready → published). Drafts stay hidden from the client.
import { LoaderCircle, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useDeliveryMutation } from "@/features/admin/queries";
import { isValidISO, isValidTime } from "@/lib/dates";
import { STATUS_LABEL } from "@/lib/status";
import {
  removePostMedia,
  reorderPostMedia,
  replacePostMedia,
  uploadPostMedia,
} from "@/services/media";
import { updatePost, type PostPatch } from "@/services/posts";
import type { PostStatus, PostWithMedia } from "@/types/domain";

import { MediaManager } from "./MediaManager";

const STATUS_OPTIONS: { value: PostStatus; label: string; hint: string }[] = [
  { value: "draft", label: STATUS_LABEL.draft, hint: "Só a equipe vê." },
  { value: "ready", label: "Pronto", hint: "Aparece para a cliente." },
  { value: "published", label: STATUS_LABEL.published, hint: "Já foi publicado." },
];

const fieldClass =
  "w-full rounded-xl border border-input bg-background/45 px-4 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

interface Form {
  title: string;
  caption: string;
  scheduled_date: string;
  scheduled_time: string;
  status: PostStatus;
}

const toForm = (post: PostWithMedia): Form => ({
  title: post.title,
  caption: post.caption ?? "",
  scheduled_date: post.scheduled_date,
  scheduled_time: post.scheduled_time,
  status: post.status,
});

export function PostEditor({
  post,
  clientId,
  onClose,
}: {
  post: PostWithMedia | null;
  clientId: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Form | null>(post ? toForm(post) : null);
  const [error, setError] = useState("");
  const postId = post?.id;

  // Reset the form only when another post is opened, not on every refetch.
  useEffect(() => {
    setForm(post ? toForm(post) : null);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const save = useDeliveryMutation(
    clientId,
    (patch: PostPatch) => updatePost(postId!, patch),
    "Publicação salva.",
  );
  const add = useDeliveryMutation(clientId, (files: File[]) => uploadPostMedia(postId!, files));
  const replace = useDeliveryMutation(clientId, (v: { id: string; file: File }) =>
    replacePostMedia(v.id, v.file),
  );
  const remove = useDeliveryMutation(clientId, (id: string) => removePostMedia(id));
  const reorder = useDeliveryMutation(clientId, (ids: string[]) => reorderPostMedia(postId!, ids));
  const mediaBusy = add.isPending || replace.isPending || remove.isPending || reorder.isPending;

  if (!post || !form) return null;

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!form.title.trim()) return setError("Informe um título.");
    if (!isValidISO(form.scheduled_date)) return setError("Data inválida.");
    if (!isValidTime(form.scheduled_time)) return setError("Horário inválido.");
    if (form.status !== "draft" && post.media.length === 0) {
      return setError("Envie ao menos uma arte antes de liberar para a cliente.");
    }
    save.mutate({
      title: form.title.trim(),
      caption: form.caption.trim() ? form.caption.trim() : null,
      scheduled_date: form.scheduled_date,
      scheduled_time: form.scheduled_time,
      status: form.status,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-3xl border-border-strong bg-background p-5 sm:rounded-3xl sm:p-7">
        <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
          Editar publicação
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Envie as artes prontas, ajuste data e horário e libere para a cliente.
        </DialogDescription>

        <div className="mt-2">
          <MediaManager
            media={post.media}
            busy={mediaBusy}
            onAdd={(files) => add.mutate(files)}
            onReplace={(id, file) => replace.mutate({ id, file })}
            onRemove={(id) => remove.mutate(id)}
            onReorder={(ids) => reorder.mutate(ids)}
          />
        </div>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-muted-foreground">Título</span>
            <input
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
              className={`${fieldClass} h-11`}
              maxLength={160}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-muted-foreground">
              Legenda (opcional)
            </span>
            <textarea
              value={form.caption}
              onChange={(event) => set("caption", event.target.value)}
              className={`${fieldClass} min-h-32 py-3`}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-muted-foreground">Data</span>
              <input
                type="date"
                value={form.scheduled_date}
                onChange={(event) => set("scheduled_date", event.target.value)}
                className={`${fieldClass} h-11`}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-muted-foreground">
                Horário
              </span>
              <input
                type="time"
                value={form.scheduled_time}
                onChange={(event) => set("scheduled_time", event.target.value)}
                className={`${fieldClass} h-11`}
              />
            </label>
          </div>
          <fieldset>
            <legend className="mb-2 block text-xs font-semibold text-muted-foreground">
              Status
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {STATUS_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-surface p-3 has-[:checked]:border-primary/60 has-[:checked]:bg-primary-soft"
                >
                  <input
                    type="radio"
                    name="status"
                    value={option.value}
                    checked={form.status === option.value}
                    onChange={() => set("status", option.value)}
                    className="mt-0.5 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">
                      {option.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Fechar
            </Button>
            <Button type="submit" disabled={save.isPending || mediaBusy}>
              {save.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
