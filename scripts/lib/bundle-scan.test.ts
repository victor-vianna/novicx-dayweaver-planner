import { Buffer } from "node:buffer";

import { formatBundleFindings, scanBundleFiles } from "./bundle-scan.ts";

function jwt(role: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role })}.signature`;
}

describe("scanBundleFiles", () => {
  it.each([
    ["Supabase secret key", "const key = 'sb_secret_privileged123'", "supabase-secret-key"],
    ["service-role JWT", jwt("service_role"), "service-role-jwt"],
    ["service-role environment variable", "SUPABASE_SERVICE_ROLE_KEY", "service-role-env"],
    [
      "PKCS#8 private key",
      "-----BEGIN PRIVATE KEY-----\nprivileged\n-----END PRIVATE KEY-----",
      "private-pem-key",
    ],
    [
      "RSA private key",
      "-----BEGIN RSA PRIVATE KEY-----\nprivileged\n-----END RSA PRIVATE KEY-----",
      "private-pem-key",
    ],
  ])("detects a %s", (_name, content, type) => {
    expect(scanBundleFiles([{ path: "asset.js", content }])).toEqual([{ path: "asset.js", type }]);
  });

  it("allows publishable keys and project URLs", () => {
    const content = "https://sample-project.supabase.co sb_publishable_public123 VITE_SUPABASE_URL";
    expect(scanBundleFiles([{ path: "asset.js", content }])).toEqual([]);
  });

  it.each(["anon", "authenticated"])("allows a JWT with the %s role", (role) => {
    expect(scanBundleFiles([{ path: "asset.js", content: jwt(role) }])).toEqual([]);
  });

  it("does not include the matched value in findings or their formatted message", () => {
    const privilegedValue = "sb_" + "secret_value_that_must_never_be_logged";
    const findings = scanBundleFiles([{ path: "server.js", content: privilegedValue }]);
    const message = formatBundleFindings(findings);

    expect(findings).toEqual([{ path: "server.js", type: "supabase-secret-key" }]);
    expect(JSON.stringify(findings)).not.toContain(privilegedValue);
    expect(message).toBe("- server.js: supabase-secret-key");
    expect(message).not.toContain(privilegedValue);
  });
});
