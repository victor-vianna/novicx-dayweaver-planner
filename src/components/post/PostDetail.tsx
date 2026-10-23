import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Download,
  FileText,
  LoaderCircle,
} from "lucide-react";
import { useState } from "react";

import { CaptionBlock } from "@/components/post/CaptionBlock";
import { MediaCarousel } from "@/components/post/MediaCarousel";
import { formatLabel } from "@/components/post/PostListItem";
import { StatusBadge } from "@/components/post/StatusBadge";
import { useSaveArt } from "@/components/post/useSaveArt";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatWeekdayLong } from "@/lib/dates";
import { getDisplayStatus } from "@/lib/status";
import type { PostWithMedia } from "@/types/domain";

export function PostDetail({
  post,
  today,
  open,
  onOpenChange,
  onTogglePublished,
  togglePending,
}: {
  post: PostWithMedia | null;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTogglePublished: (postId: string, published: boolean) => void;
  togglePending: boolean;
}) {
  const save = useSaveArt(post);
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
                  onClick={() => onTogglePublished(post.id, !published)}
                  disabled={togglePending}
                >
                  {togglePending ? (
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
