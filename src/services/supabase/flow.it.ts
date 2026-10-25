// MVP flow through the real services: admin creates a post and uploads art →
// draft stays invisible to the client → admin releases it → the client sees
// art + caption via signed URL and marks it published → another client and
// anon see nothing. Cleans up only the post and files it created; a failed
// cleanup fails the suite.
// Local stack: npm run db:reset && npm run test:supabase
// Remote dev project: npm run e2e:setup:remote && npm run test:supabase:remote
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  assertDevTarget,
  assertSafePassword,
  E2E_ENV_FILE,
  parseEnv,
} from "../../../scripts/lib/e2e-env.ts";

const REMOTE = process.env["E2E_TARGET"] === "remote";

let url: string | undefined;
let key: string;
let PASSWORD: string;
let ADMIN: string;
let MARINA: string;
let RAFAEL: string;
if (REMOTE) {
  const env = parseEnv(readFileSync(E2E_ENV_FILE, "utf8"));
  assertDevTarget(env);
  assertSafePassword(env["E2E_PASSWORD"]);
  url = env["E2E_SUPABASE_URL"];
  key = env["E2E_SUPABASE_PUBLISHABLE_KEY"] ?? "";
  PASSWORD = env["E2E_PASSWORD"];
  [ADMIN, MARINA, RAFAEL] = ["e2e-admin@example.com", "e2e-a@example.com", "e2e-b@example.com"];
} else {
  const env = parseEnv(execSync("npx supabase status -o env", { encoding: "utf8" }));
  url = env["API_URL"];
  if (!url || !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error(`Refusing to run: ${url ?? "no API_URL"} is not the local stack.`);
  }
  key = env["PUBLISHABLE_KEY"] ?? env["ANON_KEY"] ?? "";
  PASSWORD = "demo1234";
  [ADMIN, MARINA, RAFAEL] = [
    "equipe@novicx.com.br",
    "marina@exemplo.com.br",
    "rafael@rmtreinamento.com.br",
  ];
}

vi.stubEnv("VITE_DATA_SOURCE", "supabase");
vi.stubEnv("VITE_SUPABASE_URL", url);
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", key);

const auth = await import("./auth");
const clients = await import("./clients");
const packages = await import("./packages");
const posts = await import("./posts");
const media = await import("./media");
const events = await import("./events");
const { db, MEDIA_BUCKET } = await import("./shared");

const jpeg = (name: string) =>
  new File([readFileSync(`src/assets/posts/${name}`)], name, { type: "image/jpeg" });

async function as(email: string) {
  await auth.signOut();
  return auth.signInWithPassword(email, PASSWORD);
}

let postId = "";
let marinaId = "";
let mediaPath = "";
/** Every object this run uploaded, kept apart from the database rows. */
const uploaded = new Set<string>();

describe(`Supabase MVP flow (${REMOTE ? "remote dev" : "local stack"})`, () => {
  beforeAll(async () => {
    const session = await as(ADMIN);
    expect(session.profile.role).toBe("admin");
    const all = await clients.listClients();
    marinaId = all.find((c) => c.email === MARINA)!.id;
  });

  afterAll(async () => {
    if (!postId) return;
    await as(ADMIN);
    const post = await posts.getPost(postId, { includeDrafts: true });
    for (const m of post?.media ?? []) uploaded.add(m.storage_path);
    // Only drafts can be deleted (T6): move it back through the RPC first.
    if (post && post.status !== "draft") await posts.updatePost(postId, { status: "draft" });

    // Files first: deleting the post cascades post_media, the only other record
    // of these paths. Storage reports a denied remove as an empty result, so the
    // folder is listed afterwards to prove it is empty.
    if (uploaded.size) {
      const removed = await db()
        .storage.from(MEDIA_BUCKET)
        .remove([...uploaded]);
      if (removed.error)
        throw new Error(`Cleanup: storage remove failed: ${removed.error.message}`);
    }
    const folder = `clients/${marinaId}/posts/${postId}`;
    const left = await db().storage.from(MEDIA_BUCKET).list(folder);
    if (left.error) throw new Error(`Cleanup: cannot list ${folder}: ${left.error.message}`);
    if (left.data.length) {
      throw new Error(`Cleanup: files left in ${folder}: ${left.data.map((o) => o.name).join()}`);
    }

    const deleted = await db().from("posts").delete().eq("id", postId).select("id");
    if (deleted.error) throw new Error(`Cleanup: post delete failed: ${deleted.error.message}`);
    if (deleted.data.length !== 1) throw new Error(`Cleanup: post ${postId} was not deleted.`);
    await auth.signOut();
  });

  it("rejects wrong credentials", async () => {
    await auth.signOut();
    await expect(auth.signInWithPassword(MARINA, "errada")).rejects.toThrow(
      "E-mail ou senha incorretos.",
    );
  });

  it("admin creates a draft and uploads a carousel", async () => {
    await as(ADMIN);
    const pkg = await packages.getActivePackage(marinaId);
    expect(pkg).not.toBeNull();
    const draft = await posts.createPost({
      clientId: marinaId,
      packageId: pkg!.id,
      scheduledDate: pkg!.start_date,
      scheduledTime: "09:30",
      title: "Teste de integração",
    });
    postId = draft.id;
    const withMedia = await media.uploadPostMedia(postId, [
      jpeg("m-autocuidado.jpg"),
      jpeg("h-contrato.jpg"),
    ]);
    for (const m of withMedia.media) uploaded.add(m.storage_path);
    expect(withMedia.format).toBe("carousel");
    expect(withMedia.media.map((m) => m.position)).toEqual([0, 1]);
    expect(withMedia.media[0]!.storage_path).toMatch(
      new RegExp(`^clients/${marinaId}/posts/${postId}/[0-9a-f-]{36}\\.jpg$`),
    );
    mediaPath = withMedia.media[0]!.storage_path;
  });

  it("the client cannot see the draft, its row or its file", async () => {
    await as(MARINA);
    expect(await posts.getPost(postId, { includeDrafts: true })).toBeNull();
    expect((await posts.listPosts({ includeDrafts: true })).some((p) => p.id === postId)).toBe(
      false,
    );
    const { data } = await db().storage.from(MEDIA_BUCKET).createSignedUrl(mediaPath, 60);
    expect(data).toBeNull();
    await expect(
      posts.markPostPublished(postId, { role: "client", clientId: marinaId }),
    ).rejects.toThrow();
  });

  it("admin replaces an art, adds a caption and releases the post", async () => {
    await as(ADMIN);
    const before = await posts.getPost(postId, { includeDrafts: true });
    const replaced = await media.replacePostMedia(before!.media[0]!.id, jpeg("h-escritorio.jpg"));
    for (const m of replaced.media) uploaded.add(m.storage_path);
    expect(replaced.media[0]!.storage_path).not.toBe(mediaPath);
    const { data: old } = await db()
      .storage.from(MEDIA_BUCKET)
      .list(`clients/${marinaId}/posts/${postId}`);
    expect(old?.map((o) => o.name)).not.toContain(mediaPath.split("/").pop());
    mediaPath = replaced.media[0]!.storage_path;

    const ready = await posts.updatePost(postId, { caption: "Legenda pronta ✨", status: "ready" });
    expect(ready.status).toBe("ready");
  });

  it("the client sees art and caption through a working signed URL, and marks it published", async () => {
    const session = await as(MARINA);
    expect(session.client?.id).toBe(marinaId);
    const post = await posts.getPost(postId);
    expect(post?.caption).toBe("Legenda pronta ✨");
    expect(post?.media).toHaveLength(2);
    const signed = post!.media[0]!.url;
    expect(signed).toContain("token=");
    // The portal downloads the art with fetch() from the app origin (share.ts).
    const res = await fetch(signed, { headers: { Origin: "https://novicx-planner.vercel.app" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/jpeg");
    expect(["*", "https://novicx-planner.vercel.app"]).toContain(
      res.headers.get("access-control-allow-origin"),
    );

    const published = await posts.markPostPublished(postId, { role: "client", clientId: marinaId });
    expect(published.status).toBe("published");
    expect(published.published_by).toBe("client");
    const { data: who } = await db()
      .from("posts")
      .select("published_by_user")
      .eq("id", postId)
      .single();
    expect(who?.published_by_user).toBe(session.profile.id);
  });

  it("admin cannot delete a published post or write its status directly", async () => {
    await as(ADMIN);
    await expect(posts.deletePost(postId)).rejects.toThrow("Só rascunhos podem ser excluídos.");
    const deleted = await db().from("posts").delete().eq("id", postId).select("id");
    expect(deleted.data).toEqual([]);
    const direct = await db().from("posts").update({ status: "ready" }).eq("id", postId);
    expect(direct.error?.code).toBe("42501");
    expect((await posts.getPost(postId, { includeDrafts: true }))?.status).toBe("published");
  });

  it("the history records every change with its actor, readable only by the team", async () => {
    await as(ADMIN);
    const history = await events.listPostEvents(postId);
    expect(history.map((e) => e.kind)).toEqual([
      "created",
      "media_added",
      "media_added",
      "media_replaced",
      "status",
      "status",
    ]);
    expect(history.at(-1)).toMatchObject({
      actor_role: "client",
      detail: { from: "ready", to: "published", published_by: "client" },
    });
    expect(history.slice(0, -1).every((e) => e.actor_role === "admin")).toBe(true);
    const tamper = await db().from("post_events").delete().eq("post_id", postId);
    expect(tamper.error?.code).toBe("42501");

    await as(MARINA);
    expect(await events.listPostEvents(postId)).toEqual([]);
  });

  it("another client sees nothing of it", async () => {
    await as(RAFAEL);
    expect(await posts.getPost(postId)).toBeNull();
    expect((await posts.listPosts()).every((p) => p.client_id !== marinaId)).toBe(true);
    const { data } = await db().storage.from(MEDIA_BUCKET).createSignedUrl(mediaPath, 60);
    expect(data).toBeNull();
    await expect(
      posts.unmarkPostPublished(postId, { role: "client", clientId: marinaId }),
    ).rejects.toThrow();
  });

  it("anon sees nothing", async () => {
    await auth.signOut();
    await expect(posts.listPosts()).rejects.toThrow();
    const { data } = await db().storage.from(MEDIA_BUCKET).createSignedUrl(mediaPath, 60);
    expect(data).toBeNull();
  });
});
