// Uploads the fictional demo arts (src/assets/posts) to the LOCAL Supabase
// Storage, at the paths listed in supabase/seed-media.json (same paths as
// supabase/seed.sql). Local stack only: refuses any non-localhost URL.
// Usage: npm run db:seed-media   (after npm run db:reset)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  execSync("npx supabase status -o env", { encoding: "utf8" })
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const url = env.API_URL;
const key = env.SECRET_KEY || env.SERVICE_ROLE_KEY;
if (!url || !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  throw new Error(`Refusing to seed media: ${url ?? "no API_URL"} is not the local stack.`);
}
if (!key) throw new Error("Local service key not found in `supabase status`.");

const supabase = createClient(url, key, { auth: { persistSession: false } });
const manifest = JSON.parse(readFileSync("supabase/seed-media.json", "utf8"));

let uploaded = 0;
for (const { path, file } of manifest) {
  const body = readFileSync(`src/assets/posts/${file}`);
  const { error } = await supabase.storage
    .from("post-media")
    .upload(path, body, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`${path}: ${error.message}`);
  uploaded++;
}
console.log(`Uploaded ${uploaded} demo arts to the local post-media bucket.`);
