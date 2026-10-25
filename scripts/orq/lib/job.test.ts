import { execFile } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  acquireLock,
  buildCodexArgs,
  checkLock,
  extractThreadId,
  isApproved,
  MAX_ATTEMPTS,
  parseArgs,
  releaseLock,
  runJob,
  TIMEOUT_MS,
  validateResult,
  type JobArgs,
  type JobDeps,
  type JobLayout,
} from "./job.ts";
import { nodeLockFs } from "./node-fs.ts";
import type { JsonSchema } from "./schema.ts";

const reviewSchema = JSON.parse(
  readFileSync("docs/orquestracao/review-schema.json", "utf8"),
) as JsonSchema;
const taskSchemaText = readFileSync("docs/orquestracao/task-schema.json", "utf8");
const SHA = "0123456789abcdef0123456789abcdef01234567";
const mod = pathToFileURL(path.resolve("scripts/orq/lib/job.ts")).href;
const fsMod = pathToFileURL(path.resolve("scripts/orq/lib/node-fs.ts")).href;
const BASE = "924c26e8b65d4500a1e26e47e824f1fa5b38660e";

const review = (over: Record<string, unknown> = {}) => ({
  task_id: "O0",
  round: 1,
  commit: SHA.slice(0, 12),
  verdict: "approved",
  acceptance: [{ criterion: "c1", status: "verified", evidence: "vitest 12/12" }],
  checks: [{ command: "npx tsc --noEmit", result: "pass", summary: "0 erros" }],
  findings: [],
  summary: "ok",
  ...over,
});

const args = (over: Partial<JobArgs> = {}): JobArgs => ({
  kind: "review",
  task: "O0",
  round: 1,
  sha: SHA.slice(0, 12),
  effort: "high",
  resume: false,
  multiAgent: false,
  base: "924c26e",
  paths: [],
  ...over,
});

describe("parseArgs", () => {
  it("parses a review", () => {
    expect(
      parseArgs([
        "--base",
        "924c26e",
        "--kind",
        "review",
        "--task",
        "T4b",
        "--round",
        "2",
        "--sha",
        "abc1234",
        "--resume",
      ]),
    ).toMatchObject({
      kind: "review",
      task: "T4b",
      round: 2,
      sha: "abc1234",
      resume: true,
      effort: "high",
    });
  });
  it("refuses round > 3, missing sha, bad kind and resume on round 1", () => {
    expect(() =>
      parseArgs(["--kind", "review", "--task", "T1", "--round", "4", "--sha", "abc1234"]),
    ).toThrow(/limit of 3/);
    expect(() => parseArgs(["--kind", "review", "--task", "T1", "--round", "1"])).toThrow(/sha/);
    expect(() => parseArgs(["--kind", "x", "--task", "T1", "--round", "1"])).toThrow(/kind/);
    expect(() => parseArgs(["--kind", "task", "--task", "X8", "--round", "1", "--resume"])).toThrow(
      /resume/,
    );
  });
  it("rejects task ids that could escape the runs folder", () => {
    expect(() => parseArgs(["--kind", "task", "--task", "../x", "--round", "1"])).toThrow(/task/);
  });
});

describe("parseArgs base", () => {
  it("requires an immutable --base SHA for reviews", () => {
    const review = ["--kind", "review", "--task", "T1", "--round", "1", "--sha", "abc1234"];
    expect(() => parseArgs(review)).toThrow(/--base/);
    expect(() => parseArgs([...review, "--base", "claude/ciclo-3"])).toThrow(/SHA/);
    expect(parseArgs([...review, "--base", "924c26e"]).base).toBe("924c26e");
  });
});

describe("parseArgs paths", () => {
  const review = [
    "--kind",
    "review",
    "--task",
    "T1",
    "--round",
    "1",
    "--sha",
    "abc1234",
    "--base",
    "924c26e",
  ];
  it("parses a comma list and puts it in the JOB", () => {
    expect(
      parseArgs([...review, "--paths", "supabase/migrations/x.sql, supabase/tests/y.sql"]).paths,
    ).toEqual(["supabase/migrations/x.sql", "supabase/tests/y.sql"]);
  });
  it("rejects option-like or escaping entries", () => {
    expect(() => parseArgs([...review, "--paths", "--output=x"])).toThrow(/paths/);
    expect(() => parseArgs([...review, "--paths", "../x"])).toThrow(/paths/);
  });
});

describe("checkLock", () => {
  it("free / busy / stale", () => {
    expect(checkLock(null, () => true)).toBe("free");
    expect(checkLock("123", () => true)).toBe("busy");
    expect(checkLock("123", () => false)).toBe("stale");
    expect(checkLock("garbage", () => true)).toBe("stale");
  });
});

describe("buildCodexArgs", () => {
  const paths = {
    root: "/r",
    worktree: "/wt",
    brief: "/b",
    evidence: "/e",
    previousReview: null,
    schema: "/s.json",
    output: "/o.json",
  };
  it("uses workspace-write, the worktree and stdin; no network by default", () => {
    const a = buildCodexArgs(args(), paths, null);
    expect(a.slice(0, 5)).toEqual(["exec", "-C", "/wt", "-s", "workspace-write"]);
    expect(a).toContain("model_reasoning_effort=high");
    expect(a.join(" ")).not.toContain("network_access");
    expect(a.at(-1)).toBe("-");
  });
  it("enables network only for H* tasks", () => {
    expect(buildCodexArgs(args({ kind: "task", task: "H0" }), paths, null)).toContain(
      "sandbox_workspace_write.network_access=true",
    );
  });
  it("resumes a thread", () => {
    expect(buildCodexArgs(args({ round: 2, resume: true }), paths, "th-1").slice(0, 3)).toEqual([
      "exec",
      "resume",
      "th-1",
    ]);
  });
});

describe("extractThreadId", () => {
  it("reads the first thread_id from JSONL events", () => {
    const jsonl = 'noise\n{"type":"thread.started","thread_id":"abc"}\n{"thread_id":"later"}\n';
    expect(extractThreadId(jsonl)).toBe("abc");
    expect(extractThreadId("{}\n")).toBeNull();
  });
});

describe("validateResult", () => {
  it("accepts a valid review for the sent commit", () => {
    expect(validateResult(JSON.stringify(review()), reviewSchema, args(), SHA).errors).toEqual([]);
  });
  it("rejects a commit other than the sent SHA", () => {
    const r = validateResult(
      JSON.stringify(review({ commit: "fffffff" })),
      reviewSchema,
      args(),
      SHA,
    );
    expect(r.errors.join()).toMatch(/commit/);
  });
  it("rejects schema violations and wrong task/round", () => {
    const bad = { ...review(), extra: 1, verdict: "maybe" };
    expect(
      validateResult(JSON.stringify(bad), reviewSchema, args(), SHA).errors.length,
    ).toBeGreaterThan(1);
    expect(
      validateResult(JSON.stringify(review({ round: 2 })), reviewSchema, args(), SHA).errors.join(),
    ).toMatch(/round/);
    expect(validateResult("not json", reviewSchema, args(), SHA).errors).toEqual([
      "output is not valid JSON",
    ]);
  });
});

describe("isApproved", () => {
  it("needs 0 bloqueante/importante, all criteria verified with evidence and the same commit", () => {
    expect(isApproved(review(), SHA)).toBe(true);
    expect(isApproved(review({ findings: [{ severity: "melhoria" }] }), SHA)).toBe(true);
    expect(isApproved(review({ findings: [{ severity: "importante" }] }), SHA)).toBe(false);
    expect(
      isApproved(
        review({ acceptance: [{ criterion: "c", status: "not_verifiable", evidence: "x" }] }),
        SHA,
      ),
    ).toBe(false);
    expect(
      isApproved(
        review({ acceptance: [{ criterion: "c", status: "verified", evidence: " " }] }),
        SHA,
      ),
    ).toBe(false);
    expect(isApproved(review({ acceptance: [] }), SHA)).toBe(false);
    expect(isApproved(review({ commit: "deadbee" }), SHA)).toBe(false);
    // a reported "approved" verdict alone does not approve
    expect(
      isApproved(review({ verdict: "approved", findings: [{ severity: "bloqueante" }] }), SHA),
    ).toBe(false);
  });
});

// --- runJob with fake side effects -----------------------------------------

function harness(opts: {
  files?: Record<string, string>;
  free?: number;
  alive?: boolean;
  dirty?: boolean;
  notAncestor?: boolean;
  codex?: (n: number) => { stdout: string; output?: string } | Error;
}) {
  const files: Record<string, string> = {
    "/brief.md": "brief",
    "/schema.json": JSON.stringify(reviewSchema),
    "/prompt.md": "PROMPT",
    ...opts.files,
  };
  const calls: { args: string[]; timeoutMs: number; input: string }[] = [];
  const logs: string[] = [];
  const gitCalls: string[][] = [];
  const deps: JobDeps = {
    freemem: () => opts.free ?? 4 * 1024 ** 3,
    isAlive: () => opts.alive ?? false,
    pid: 4242,
    read: (f) => (f in files ? files[f]! : null),
    write: (f, d) => {
      files[f] = d;
    },
    remove: (f) => {
      delete files[f];
    },
    createExclusive: (f, d) => {
      if (f in files) return false;
      files[f] = d;
      return true;
    },
    mkdirExclusive: (d) => {
      if (`dir:${d}` in files) return false;
      files[`dir:${d}`] = "";
      return true;
    },
    rmdir: (d) => {
      delete files[`dir:${d}`];
    },
    git: async (_cwd, a) => {
      gitCalls.push(a);
      if (a[0] === "status") return opts.dirty ? " M x" : "";
      if (a[0] === "rev-parse" && a[1] === "--verify") return `${BASE}\n`;
      if (a[0] === "merge-base" && opts.notAncestor) throw new Error("exit 1");
      if (a[0] === "rev-parse") return `${SHA}\n`;
      if (a[0] === "branch") return "codex/ciclo-3\n";
      return "";
    },
    codex: async (a, o) => {
      calls.push({ args: a, timeoutMs: o.timeoutMs, input: o.input });
      const r = opts.codex
        ? opts.codex(calls.length)
        : { stdout: "", output: JSON.stringify(review()) };
      if (r instanceof Error) throw r;
      if (r.output !== undefined) files["/out.json"] = r.output;
      return { stdout: r.stdout, stderr: "" };
    },
    log: (l) => logs.push(l),
  };
  const layout: JobLayout = {
    lock: "/lock",
    runs: "/runs",
    reviews: "/reviews",
    promptFile: "/prompt.md",
    paths: {
      root: "/root",
      worktree: "/wt",
      brief: "/brief.md",
      evidence: "/ev",
      previousReview: null,
      schema: "/schema.json",
      output: "/out.json",
    },
  };
  return { files, calls, logs, gitCalls, deps, layout };
}

const timeoutError = () =>
  Object.assign(new Error("killed"), { killed: true, stdout: "", stderr: "" });

describe("runJob", () => {
  it("runs, validates, copies the review and releases the lock", async () => {
    const h = harness({
      codex: () => ({ stdout: '{"thread_id":"t1"}', output: JSON.stringify(review()) }),
    });
    const out = await runJob(args(), h.layout, h.deps);
    expect(out.ok).toBe(true);
    expect(h.files["/reviews/O0-r1.json"]).toContain('"task_id": "O0"');
    expect(h.files["/runs/O0-r1.thread"]).toBe("t1");
    expect(h.files["/runs/O0-r1.prompt.md"]).toContain(`sha: ${SHA.slice(0, 12)}`);
    expect(h.calls[0]!.timeoutMs).toBe(TIMEOUT_MS);
    expect(h.calls[0]!.input).toContain("PROMPT");
    expect(h.files["/lock"]).toBeUndefined();
  });

  it("refuses while another live job holds the lock, and keeps that lock", async () => {
    const h = harness({ files: { "/lock": "999" }, alive: true });
    const out = await runJob(args(), h.layout, h.deps);
    expect(out).toEqual({ ok: false, reason: "another Codex job holds the lock" });
    expect(h.files["/lock"]).toBe("999");
    expect(h.calls).toHaveLength(0);
  });

  it("replaces a stale lock (dead PID)", async () => {
    const h = harness({ files: { "/lock": "999" }, alive: false });
    expect((await runJob(args(), h.layout, h.deps)).ok).toBe(true);
    expect(h.calls).toHaveLength(1);
  });

  it("refuses with less than 1.5 GB free", async () => {
    const h = harness({ free: 1 * 1024 ** 3 });
    const out = await runJob(args(), h.layout, h.deps);
    expect(out.ok).toBe(false);
    expect(h.calls).toHaveLength(0);
  });

  it("retries once after a timeout", async () => {
    const h = harness({
      codex: (n) => (n === 1 ? timeoutError() : { stdout: "", output: JSON.stringify(review()) }),
    });
    expect((await runJob(args(), h.layout, h.deps)).ok).toBe(true);
    expect(h.calls).toHaveLength(2);
    expect(h.logs).toContain("timeout (45 min)");
  });

  it("gives up after 2 failed attempts (invalid JSON, wrong commit) and records them", async () => {
    const h = harness({
      codex: (n) => ({
        stdout: "",
        output: n === 1 ? "{" : JSON.stringify(review({ commit: "fffffff" })),
      }),
    });
    const out = await runJob(args(), h.layout, h.deps);
    expect(out.ok).toBe(false);
    expect(h.calls).toHaveLength(MAX_ATTEMPTS);
    expect(h.files["/runs/O0-r1.attempts"]).toBe("2");
    expect(h.files["/reviews/O0-r1.json"]).toBeUndefined();
    expect(h.files["/lock"]).toBeUndefined();
  });

  it("counts attempts across runs (a job that died earlier)", async () => {
    const h = harness({ files: { "/runs/O0-r1.attempts": "2" } });
    const out = await runJob(args(), h.layout, h.deps);
    expect(out.ok).toBe(false);
    expect(h.calls).toHaveLength(0);
  });

  it("refuses a dirty worktree", async () => {
    const h = harness({ dirty: true });
    expect((await runJob(args(), h.layout, h.deps)).ok).toBe(false);
    expect(h.calls).toHaveLength(0);
  });

  it("resumes the previous round's thread on the first attempt", async () => {
    const h = harness({
      files: { "/runs/O0-r1.thread": "th-prev\n" },
      codex: () => ({ stdout: "", output: JSON.stringify(review({ round: 2 })) }),
    });
    expect((await runJob(args({ round: 2, resume: true }), h.layout, h.deps)).ok).toBe(true);
    expect(h.calls[0]!.args.slice(0, 3)).toEqual(["exec", "resume", "th-prev"]);
  });

  it("task jobs check the codex branch and save as .task.json", async () => {
    const task = {
      task_id: "X8",
      round: 1,
      status: "delivered",
      branch: "codex/ciclo-3",
      commits: ["abc"],
      files_changed: ["vercel.json"],
      checks: [],
      out_of_scope_requests: [],
      limitations: [],
      summary: "ok",
    };
    const h = harness({
      files: { "/schema.json": taskSchemaText },
      codex: () => ({ stdout: "", output: JSON.stringify(task) }),
    });
    const out = await runJob(args({ kind: "task", task: "X8", sha: "" }), h.layout, h.deps);
    expect(out.ok).toBe(true);
    expect(h.files["/reviews/X8-r1.task.json"]).toBeDefined();
  });
});

describe("runJob base and lock ownership", () => {
  it("sends the resolved immutable base SHA, never a branch name", async () => {
    const h = harness({});
    expect((await runJob(args(), h.layout, h.deps)).ok).toBe(true);
    expect(h.gitCalls).toContainEqual(["rev-parse", "--verify", "924c26e^{commit}"]);
    expect(h.files["/runs/O0-r1.prompt.md"]).toContain(`base: ${BASE}`);
  });

  it("refuses a base that is not an ancestor of the reviewed SHA", async () => {
    const h = harness({ notAncestor: true });
    const out = await runJob(args(), h.layout, h.deps);
    expect(out.ok).toBe(false);
    expect(h.calls).toHaveLength(0);
  });

  it("does not delete a lock that another process took over", async () => {
    const h = harness({
      codex: () => {
        h.files["/lock"] = "777"; // someone replaced the lock meanwhile
        return { stdout: "", output: JSON.stringify(review()) };
      },
    });
    await runJob(args(), h.layout, h.deps);
    expect(h.files["/lock"]).toBe("777");
  });
});

describe("acquireLock / releaseLock on the real filesystem", () => {
  const realFs = nodeLockFs; // the production adapter

  it("lets exactly one of several concurrent processes acquire the lock", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "orq-lock-"));
    const lock = path.join(dir, "codex.lock");
    const code = [
      `import { acquireLock } from ${JSON.stringify(mod)};`,
      `import { nodeLockFs } from ${JSON.stringify(fsMod)};`,
      `console.log(acquireLock(nodeLockFs, ${JSON.stringify(lock)}, process.pid, () => true));`,
    ].join("\n");
    const run = () =>
      new Promise<string>((resolve, reject) =>
        execFile(process.execPath, ["--input-type=module", "-e", code], (err, out) =>
          err ? reject(err) : resolve(out.trim()),
        ),
      );
    const results = await Promise.all([run(), run(), run(), run()]);
    expect(results.filter((r) => r === "acquired")).toHaveLength(1);
    expect(readFileSync(lock, "utf8")).toMatch(/^\d+$/);
    rmSync(dir, { recursive: true, force: true });
  }, 30_000);

  it("recovers a dead lock with the production adapter, leaving no takeover marker", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "orq-lock-"));
    const lock = path.join(dir, "codex.lock");
    writeFileSync(lock, "999999");
    expect(() => acquireLock(nodeLockFs, lock, 1001, () => false)).not.toThrow();
    expect(readFileSync(lock, "utf8")).toBe("1001");
    expect(readdirSync(dir)).toEqual(["codex.lock"]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("replaces a stale lock and releases only its own", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "orq-lock-"));
    const lock = path.join(dir, "codex.lock");
    writeFileSync(lock, "999");
    expect(acquireLock(realFs, lock, 1001, () => false)).toBe("acquired");
    expect(acquireLock(realFs, lock, 1002, () => true)).toBe("busy");
    releaseLock(realFs, lock, 1002);
    expect(readFileSync(lock, "utf8")).toBe("1001");
    releaseLock(realFs, lock, 1001);
    expect(realFs.read(lock)).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("stale lock takeover race (O0-B1-R2)", () => {
  // In-memory fs whose hooks let one acquirer run entirely in the middle of another.
  function memFs(hooks: { onRead?: () => void } = {}) {
    const files = new Map<string, string>();
    const dirs = new Set<string>();
    let reads = 0;
    const fs = {
      files,
      dirs,
      createExclusive: (f: string, d: string) => (files.has(f) ? false : (files.set(f, d), true)),
      read: (f: string) => {
        const v = files.get(f) ?? null; // value seen BEFORE the hook runs
        if (reads++ === 0) hooks.onRead?.();
        return v;
      },
      remove: (f: string) => void files.delete(f),
      mkdirExclusive: (d: string) => (dirs.has(d) ? false : (dirs.add(d), true)),
      rmdir: (d: string) => void dirs.delete(d),
    };
    return fs;
  }

  it("a slow second taker of the same dead lock never deletes the winner's lock", () => {
    let first: string | null = null;
    const fs = memFs({ onRead: () => (first = acquireLock(fs, "/l", 1001, () => false)) });
    fs.files.set("/l", "999");
    const second = acquireLock(fs, "/l", 1002, () => false);
    expect(first).toBe("acquired");
    expect(second).toBe("busy");
    expect(fs.files.get("/l")).toBe("1001");
  });

  it("only one of several processes recovers a dead lock", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "orq-lock-"));
    const lock = path.join(dir, "codex.lock");
    writeFileSync(lock, "999999");
    const code = [
      `import { acquireLock } from ${JSON.stringify(mod)};`,
      `import { nodeLockFs } from ${JSON.stringify(fsMod)};`,
      `console.log(acquireLock(nodeLockFs, ${JSON.stringify(lock)}, process.pid, (p) => p !== 999999));`,
    ].join("\n");
    const run = () =>
      new Promise<string>((resolve, reject) =>
        execFile(process.execPath, ["--input-type=module", "-e", code], (err, out) =>
          err ? reject(err) : resolve(out.trim()),
        ),
      );
    const results = await Promise.all([run(), run(), run(), run(), run(), run()]);
    expect(results.filter((r) => r === "acquired")).toHaveLength(1);
    rmSync(dir, { recursive: true, force: true });
  }, 30_000);
});
