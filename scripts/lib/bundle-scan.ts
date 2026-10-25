import { Buffer } from "node:buffer";

export interface BundleFile {
  path: string;
  content: string;
}

export type BundleFindingType =
  "supabase-secret-key" | "service-role-jwt" | "service-role-env" | "private-pem-key";

export interface BundleFinding {
  path: string;
  type: BundleFindingType;
}

const SECRET_KEY = /\bsb_secret_[A-Za-z0-9_-]+/;
const SERVICE_ROLE_ENV = /\bSUPABASE_SERVICE_ROLE_KEY\b/;
const PRIVATE_PEM_KEY = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;
const JWT =
  /(?:^|[^A-Za-z0-9_-])([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]*)(?=$|[^A-Za-z0-9_-])/g;

function containsServiceRoleJwt(content: string): boolean {
  for (const match of content.matchAll(JWT)) {
    const payload = match[2];
    if (!payload) continue;

    try {
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
      if (
        typeof decoded === "object" &&
        decoded !== null &&
        "role" in decoded &&
        decoded.role === "service_role"
      ) {
        return true;
      }
    } catch {
      // Bundle text contains many dot-separated strings which are not JWTs.
    }
  }
  return false;
}

/** Returns only the file and finding type, never the matched privileged value. */
export function scanBundleFiles(files: BundleFile[]): BundleFinding[] {
  const findings: BundleFinding[] = [];

  for (const file of files) {
    const types: BundleFindingType[] = [];
    if (SECRET_KEY.test(file.content)) types.push("supabase-secret-key");
    if (containsServiceRoleJwt(file.content)) types.push("service-role-jwt");
    if (SERVICE_ROLE_ENV.test(file.content)) types.push("service-role-env");
    if (PRIVATE_PEM_KEY.test(file.content)) types.push("private-pem-key");

    for (const type of types) findings.push({ path: file.path, type });
  }

  return findings;
}

export function formatBundleFindings(findings: BundleFinding[]): string {
  return findings.map(({ path, type }) => `- ${path}: ${type}`).join("\n");
}
