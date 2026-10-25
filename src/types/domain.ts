// Domain types. Shapes mirror the future database tables so services can be
// swapped from mocks to a real backend without touching the UI.

export type Role = "admin" | "client";

export type Actor = { role: "client"; clientId: string } | { role: "admin" };

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  /** Set when the team suspends the account (T1); null or absent = active. */
  blocked_at?: string | null;
}

export interface Client {
  id: string;
  user_id: string;
  display_name: string;
  business_name: string;
  profession: string;
  email: string;
  phone: string;
  archived_at: string | null;
}

/** 0 = domingo … 6 = sábado */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Plan {
  id: string;
  name: string;
  posts_per_period: number;
  period_days: number;
  default_weekdays: Weekday[];
  /** HH:mm */
  default_times: string[];
  active: boolean;
}

export type PackageStatus = "active" | "ended" | "cancelled";

export interface ClientPackage {
  id: string;
  client_id: string;
  plan_id: string;
  /** Copied at contract time so history survives catalog changes. */
  plan_name_snapshot: string;
  posts_total: number;
  /** YYYY-MM-DD (America/Sao_Paulo) */
  start_date: string;
  end_date: string;
  status: PackageStatus;
}

export type PostFormat = "single" | "carousel";
export type PostStatus = "draft" | "ready" | "published";

export interface Post {
  id: string;
  client_id: string;
  client_package_id: string;
  format: PostFormat;
  title: string;
  caption: string | null;
  /** YYYY-MM-DD (America/Sao_Paulo) */
  scheduled_date: string;
  /** HH:mm (America/Sao_Paulo) */
  scheduled_time: string;
  status: PostStatus;
  published_at: string | null;
  published_by: "client" | "admin" | null;
}

export type PostEventKind =
  "created" | "status" | "schedule" | "media_added" | "media_replaced" | "media_removed";

/** Append-only change history of a post (admin only). */
export interface PostEvent {
  id: string;
  post_id: string;
  kind: PostEventKind;
  /** status: from/to/published_by · schedule: from_date/from_time/to_date/to_time · media: position */
  detail: Record<string, string | number | null>;
  actor_id: string | null;
  actor_role: Role | null;
  created_at: string;
}

export interface PostMedia {
  id: string;
  post_id: string;
  storage_path: string;
  url: string;
  position: number;
  width: number;
  height: number;
}

export interface InternalNote {
  id: string;
  client_id: string;
  post_id: string | null;
  body: string;
  created_at: string;
}

export interface PostWithMedia extends Post {
  media: PostMedia[];
}
