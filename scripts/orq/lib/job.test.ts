import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildCodexArgs,
  checkLock,
  extractThreadId,
  isApproved,
  MAX_ATTEMPTS,
  parseArgs,
  runJob,
  TIMEOUT_MS,
  validateResult,
  type JobArgs,
  type JobDeps,
  type JobLayout,
} from "./job.ts";
import type { JsonSchema } from "./schema.ts";

const reviewSchema = JSON.parse(
  readFileSync("docs/orquestracao/review-schema.json", "utf8"),
) as JsonSchema;
const taskSchemaText = readFileSync("docs/orquestracao/task-schema.json", "utf8");
const SHA = "0123456789abcdef0123456789abcdef01234567";

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
  ...over,
});

describe("parseArgs", () => {
  it("parses a review", () => {
    expect(
      parseArgs([
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
    git: async (_cwd, a) => {
      if (a[0] === "status") return opts.dirty ? " M x" : "";
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
    base: "claude/ciclo-3",
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
  return { files, calls, logs, deps, layout };
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
    expect(h.logs).toContain("removing stale lock");
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
