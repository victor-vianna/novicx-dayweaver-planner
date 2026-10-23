import { getDisplayStatus } from "@/lib/status";
import type { ClientPackage, PostWithMedia } from "@/types/domain";

export function summarizeClientPosts(
  posts: PostWithMedia[],
  packages: ClientPackage[],
  today: string,
) {
  const currentPackage = packages.find((item) => item.status === "active") ?? null;
  const published = posts.filter((post) => post.status === "published").length;
  const pending = posts.filter((post) => getDisplayStatus(post, today) === "pending").length;
  const ready = posts.filter((post) => getDisplayStatus(post, today) === "ready").length;
  const upcoming = posts.filter((post) => post.status !== "published").slice(0, 4);
  const usedInPackage = currentPackage
    ? posts.filter(
        (post) => post.client_package_id === currentPackage.id && post.status === "published",
      ).length
    : published;
  const packageProgress =
    currentPackage && currentPackage.posts_total > 0
      ? Math.round((usedInPackage / currentPackage.posts_total) * 100)
      : 0;

  return {
    currentPackage,
    published,
    ready,
    pending,
    upcoming,
    usedInPackage,
    packageProgress,
  };
}
