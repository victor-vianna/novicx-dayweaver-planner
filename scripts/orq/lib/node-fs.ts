// The real filesystem adapter for the lock (LockFs). Shared by codex-job.mjs
// and the tests, so the tests exercise exactly what production runs.
import { mkdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { LockFs } from "./job.ts";

const code = (err: unknown) => (err as { code?: string }).code;
// On Windows a file or directory that another process is deleting answers
// EPERM/EACCES ("delete pending"). For the lock that means "taken": fail safe.
const taken = (err: unknown) => ["EEXIST", "EPERM", "EACCES"].includes(code(err) ?? "");

export const nodeLockFs: LockFs = {
  createExclusive(file, data) {
    mkdirSync(path.dirname(file), { recursive: true });
    try {
      writeFileSync(file, data, { flag: "wx" });
      return true;
    } catch (err) {
      if (taken(err)) return false;
      throw err;
    }
  },
  read(file) {
    try {
      return readFileSync(file, "utf8");
    } catch (err) {
      if (code(err) === "ENOENT" || taken(err)) return null;
      throw err;
    }
  },
  remove(file) {
    rmSync(file, { force: true });
  },
  mkdirExclusive(dir) {
    try {
      mkdirSync(dir);
      return true;
    } catch (err) {
      if (taken(err)) return false;
      throw err;
    }
  },
  rmdir(dir) {
    // rmSync(dir, { recursive: false }) throws ERR_FS_EISDIR on Node 24/Windows.
    try {
      rmdirSync(dir);
    } catch (err) {
      if (code(err) !== "ENOENT") throw err;
    }
  },
};
