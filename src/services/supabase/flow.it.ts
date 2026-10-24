// MVP flow against the LOCAL Supabase stack, through the real services:
// admin creates a post and uploads art → draft stays invisible to the client →
// admin releases it → the client sees art + caption via signed URL and marks it
// published → another client and anon see nothing. Refuses non-local URLs.
// Run: npm run db:reset && npm run test:supabase
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const env = Object.fromEntries(
  execSync("npx supabase status -o env", { encoding: "utf8" })
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => [m[1], m[2]]),
);
const url = env["API_URL"];
if (!url || !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  throw new Error(`Refusing to run: ${url ?? "no API_URL"} is not the local stack.`);
}

vi.stubEnv("VITE_DATA_SOURCE", "supabase");
vi.stubEnv("VITE_SUPABASE_URL", url);
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", env["PUBLISHABLE_KEY"] ?? env["ANON_KEY"] ?? "");

const auth = await import("./auth");
const clients = await import("./clients");
const packages = await import("./packages");
const posts = await import("./posts");
const media = await import("./media");
const { db, MEDIA_BUCKET } = await import("./shared");

const PASSWORD = "demo1234";
const ADMIN = "equipe@novicx.com.br";
const MARINA = "marina@exemplo.com.br";
const RAFAEL = "rafael@rmtreinamento.com.br";

const jpeg = (name: string) =>
  new File([readFileSync(`src/assets/posts/${name}`)], name, { type: "image/jpeg" });

async function as(email: string) {
  await auth.signOut();
  return auth.signInWithPassword(email, PASSWORD);
}

let postId = "";
let marinaId = "";
let mediaPath = "";

describe("Supabase MVP flow (local stack)", () => {
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
    if (post?.media.length)
      await db()
        .storage.from(MEDIA_BUCKET)
        .remove(post.media.map((m) => m.storage_path));
    await db().from("posts").delete().eq("id", postId);
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
    const res = await fetch(signed);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/jpeg");

    const published = await posts.markPostPublished(postId, { role: "client", clientId: marinaId });
    expect(published.status).toBe("published");
    expect(published.published_by).toBe("client");
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
