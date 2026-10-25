// Deno entry of the `admin-users` Edge Function. Wires handler.ts to a
// service-role client; SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected
// by Supabase at runtime and never leave the function. The gateway JWT check is
// off (config.toml): the handler validates the caller with Auth itself, which
// works with legacy or asymmetric JWT signing keys.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

import { type AdminUsersDeps, DepError, handleAdminUsers } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceKey) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.");

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Bearer tokens, no cookies: a wildcard origin does not widen access.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BAN_FOREVER = "876000h"; // ~100 years; "none" lifts it.

type Failure = { code?: string; status?: number; message?: string } | null;

/** Unique violations (Postgres 23505, Auth email_exists) become 409. */
function check(error: Failure): void {
  if (!error) return;
  const conflict = error.code === "23505" || error.code === "email_exists" || error.status === 422;
  throw new DepError(error.message ?? "dependency failed", conflict ? 409 : 500);
}

const CLIENT_COLUMNS = "id, display_name, email, user_id";

const deps: AdminUsersDeps = {
  async getCaller(jwt) {
    const { data, error } = await db.auth.getUser(jwt);
    return error || !data.user ? null : { id: data.user.id };
  },
  async isActiveAdmin(userId) {
    const { data, error } = await db
      .from("profiles")
      .select("role, blocked_at")
      .eq("id", userId)
      .maybeSingle();
    check(error);
    return data?.role === "admin" && data.blocked_at === null;
  },
  async insertClient(input) {
    const { data, error } = await db.from("clients").insert(input).select(CLIENT_COLUMNS).single();
    check(error);
    return data!;
  },
  async getClient(id) {
    const { data, error } = await db
      .from("clients")
      .select(CLIENT_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    check(error);
    return data;
  },
  async deleteClient(id) {
    const { error } = await db.from("clients").delete().eq("id", id);
    check(error);
  },
  async updateClientEmail(id, email) {
    const { error } = await db.from("clients").update({ email }).eq("id", id);
    check(error);
  },
  async getUser(id) {
    const { data, error } = await db.auth.admin.getUserById(id);
    if (error?.status === 404 || (!error && !data.user)) return null;
    check(error);
    const profile = await db.from("profiles").select("role, blocked_at").eq("id", id).maybeSingle();
    check(profile.error);
    if (!profile.data) return null;
    return {
      id,
      email: data.user!.email ?? "",
      role: profile.data.role,
      blocked: profile.data.blocked_at !== null,
    };
  },
  async createUser(email, fullName) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    check(error);
    return { id: data.user!.id };
  },
  async deleteUser(id) {
    const { error } = await db.auth.admin.deleteUser(id);
    check(error);
  },
  async updateUserEmail(id, email) {
    const { error } = await db.auth.admin.updateUserById(id, { email, email_confirm: true });
    check(error);
  },
  async setBlocked(userId, blocked) {
    const { error } = await db
      .from("profiles")
      .update({ blocked_at: blocked ? new Date().toISOString() : null })
      .eq("id", userId);
    check(error);
  },
  async setBanned(userId, banned) {
    const { error } = await db.auth.admin.updateUserById(userId, {
      ban_duration: banned ? BAN_FOREVER : "none",
    });
    check(error);
  },
  async recoveryLink(email, redirectTo) {
    const { data, error } = await db.auth.admin.generateLink({
      type: "recovery",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });
    check(error);
    return data.properties!.action_link;
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // Invalid or empty JSON: the handler answers 400.
  }
  try {
    const res = await handleAdminUsers(
      { method: req.method, authorization: req.headers.get("authorization"), body },
      deps,
    );
    return Response.json(res.body, { status: res.status, headers: CORS });
  } catch (err) {
    // Never echo dependency messages: they may carry internal details.
    console.error("admin-users:", err instanceof Error ? err.message : "unknown error");
    return Response.json(
      { error: "Não foi possível concluir a operação." },
      { status: 500, headers: CORS },
    );
  }
});
