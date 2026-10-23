import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { formatShort, formatWeekdayShort, relativeDayLabel } from "@/lib/dates";
import { getDisplayStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { PostWithMedia } from "@/types/domain";
import { PostArt } from "./PostArt";
import { StatusBadge } from "./StatusBadge";

interface Props {
  post: PostWithMedia;
  today: string;
  audience?: "client" | "admin";
  subtitle?: string;
  className?: string;
}

export function formatLabel(post: Pick<PostWithMedia, "format" | "media">) {
  if (post.format === "carousel") return `Carrossel · ${post.media.length || "—"} artes`;
  return "Post único";
}

export function PostListItem({ post, today, audience = "client", subtitle, className }: Props) {
  const status = getDisplayStatus(post, today);
  const rel = relativeDayLabel(post.scheduled_date, today);
  const dateText = `${rel ?? `${formatWeekdayShort(post.scheduled_date)}, ${formatShort(post.scheduled_date)}`} · ${post.scheduled_time}`;
  const content = (
    <>
      <PostArt post={post} className="w-14 shrink-0" rounded="rounded-lg" showCount={false} />
      <div className="min-w-0 flex-1">
        {subtitle && <p className="truncate text-[11.5px] font-medium text-subtle-foreground">{subtitle}</p>}
        <p className="truncate text-[14.5px] font-semibold text-foreground">{post.title}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
          {dateText} · {formatLabel(post)}
        </p>
        <StatusBadge status={status} short className="mt-2" />
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-subtle-foreground" aria-hidden />
    </>
  );
  const cls = cn(
    "pressable flex items-center gap-3.5 rounded-2xl border border-border bg-surface p-2.5 pr-3.5 hover:border-border-strong hover:bg-surface-2",
    className,
  );
  return audience === "admin" ? (
    <Link to="/admin/posts/$id" params={{ id: post.id }} className={cls}>
      {content}
    </Link>
  ) : (
    <Link to="/app/post/$id" params={{ id: post.id }} className={cls}>
      {content}
    </Link>
  );
}
