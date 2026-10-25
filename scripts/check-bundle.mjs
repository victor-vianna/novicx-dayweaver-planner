// Scans deployable build output without ever logging the privileged value.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { formatBundleFindings, scanBundleFiles } from "./lib/bundle-scan.ts";

const root = process.cwd();
const outputRoots = [".vercel/output/static", ".vercel/output/functions", ".output"].map(
  (relativePath) => ({ relativePath, absolutePath: path.resolve(root, relativePath) }),
);

function collectFiles(directory, relativeDirectory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(absolutePath, relativePath));
    else if (entry.isFile())
      files.push({ path: relativePath, content: readFileSync(absolutePath, "utf8") });
  }
  return files;
}

const buildRoots = outputRoots.filter(({ absolutePath }) => existsSync(absolutePath));
if (buildRoots.length === 0) {
  console.error("Build output not found. Run npm run build before scanning the bundle.");
  process.exit(2);
}

try {
  const files = buildRoots.flatMap(({ relativePath, absolutePath }) =>
    collectFiles(absolutePath, relativePath),
  );
  const findings = scanBundleFiles(files);

  if (findings.length > 0) {
    console.error("Privileged material found in the bundle:");
    console.error(formatBundleFindings(findings));
    process.exit(1);
  }

  console.log(`Bundle scan passed: ${files.length} files checked, zero findings.`);
} catch (error) {
  console.error(
    `Bundle scan could not be completed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exit(2);
}
