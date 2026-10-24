// Pure logic of scripts/orq/codex-job.mjs (ORQUESTRACAO §4). Side effects come
// in through `JobDeps`, so lock, memory, timeout, retries and round limits are
// testable without spawning Codex.
import { validateSchema, type JsonSchema } from "./schema.ts";

export const MAX_ROUND = 3;
export const MAX_ATTEMPTS = 2;
export const TIMEOUT_MS = 45 * 60 * 1000;
export const MIN_FREE_BYTES = 1.5 * 1024 ** 3;
export const CODEX_BRANCH = "codex/ciclo-3";

export type Kind = "review" | "task";
export type Effort = "low" | "medium" | "high" | "xhigh";

export interface JobArgs {
  kind: Kind;
  task: string;
  round: number;
  sha: string;
  effort: Effort;
  resume: boolean;
  multiAgent: boolean;
  /** Immutable base commit for the diff (required for reviews). */
  base: string;
}

export function parseArgs(argv: string[]): JobArgs {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const kind = get("kind");
  if (kind !== "review" && kind !== "task") throw new Error("--kind must be review or task.");
  const task = get("task") ?? "";
  if (!/^[A-Z]{1,3}\d{0,2}[a-z]?$/.test(task)) throw new Error(`Invalid --task: "${task}".`);
  const round = Number(get("round"));
  if (!Number.isInteger(round) || round < 1) throw new Error("--round must be an integer ≥ 1.");
  if (round > MAX_ROUND) throw new Error(`Round ${round} exceeds the limit of ${MAX_ROUND}.`);
  const sha = get("sha") ?? "";
  if (kind === "review" && !/^[0-9a-f]{7,40}$/.test(sha)) {
    throw new Error("--sha (hex commit) is required for reviews.");
  }
  const effort = (get("effort") ?? "high") as Effort;
  if (!["low", "medium", "high", "xhigh"].includes(effort)) throw new Error("Invalid --effort.");
  const resume = argv.includes("--resume");
  if (resume && round < 2) throw new Error("--resume needs round ≥ 2.");
  const base = get("base") ?? "";
  if (base && !/^[0-9a-f]{7,40}$/.test(base)) throw new Error("--base must be a commit SHA.");
  if (kind === "review" && !base) throw new Error("--base <sha> is required for reviews.");
  return {
    kind,
    task,
    round,
    sha,
    effort,
    resume,
    multiAgent: argv.includes("--multi-agent"),
    base,
  };
}

/** Lock file holds the owner PID. Alive → refuse; dead or unreadable → stale. */
export function checkLock(
  content: string | null,
  isAlive: (pid: number) => boolean,
): "free" | "stale" | "busy" {
  if (content === null) return "free";
  const pid = Number(content.trim());
  if (!Number.isInteger(pid) || pid <= 0) return "stale";
  return isAlive(pid) ? "busy" : "stale";
}

export interface LockFs {
  /** Creates the file only if it does not exist (open flag "wx"); false if it exists. */
  createExclusive(file: string, data: string): boolean;
  read(file: string): string | null;
  remove(file: string): void;
  /** mkdir that fails if the directory exists (atomic); false if it exists. */
  mkdirExclusive(dir: string): boolean;
  rmdir(dir: string): void;
}

/**
 * Atomic acquisition: the exclusive create is the only step that grants the
 * lock, so two processes can never both win. A stale lock (dead PID) is removed
 * and the create retried once; losing that retry means another process won.
 */
export function acquireLock(
  fs: LockFs,
  file: string,
  pid: number,
  isAlive: (pid: number) => boolean,
): "acquired" | "busy" {
  if (fs.createExclusive(file, String(pid))) return "acquired";
  const seen = fs.read(file);
  if (seen === null) return fs.createExclusive(file, String(pid)) ? "acquired" : "busy";
  if (checkLock(seen, isAlive) === "busy") return "busy";

  // Taking over a dead lock is itself exclusive, per dead content: only the
  // process that creates `<lock>.takeover-<content>` may remove the lock, and
  // only while it still holds that same content. The marker is removed after
  // the lock no longer holds that content, so a late taker that recreates it
  // finds other content and backs off without deleting anything.
  const marker = `${file}.takeover-${seen.trim().replace(/[^0-9A-Za-z]/g, "_") || "empty"}`;
  if (!fs.mkdirExclusive(marker)) return "busy";
  try {
    if (fs.read(file) !== seen) return fs.createExclusive(file, String(pid)) ? "acquired" : "busy";
    fs.remove(file);
    return fs.createExclusive(file, String(pid)) ? "acquired" : "busy";
  } finally {
    fs.rmdir(marker);
  }
}

/** Removes the lock only while it still holds our PID. */
export function releaseLock(fs: LockFs, file: string, pid: number): void {
  if (fs.read(file)?.trim() === String(pid)) fs.remove(file);
}

export function runName(args: Pick<JobArgs, "task" | "round">): string {
  return `${args.task}-r${args.round}`;
}

export interface JobPaths {
  root: string; // main worktree
  worktree: string; // where Codex runs
  brief: string;
  evidence: string;
  previousReview: string | null;
  schema: string;
  output: string;
}

export function buildPrompt(promptMd: string, args: JobArgs, paths: JobPaths, base: string) {
  const lines = [
    "JOB",
    `kind: ${args.kind}`,
    `task_id: ${args.task}`,
    `round: ${args.round}`,
    args.kind === "review" ? `sha: ${args.sha}` : `branch: ${CODEX_BRANCH}`,
    `base: ${base} (immutable; review the diff base..sha)`,
    `brief: ${paths.brief}`,
    `evidence: ${paths.evidence}`,
    `previous_review: ${paths.previousReview ?? "none"}`,
    `multi_agent: ${args.multiAgent ? "yes (max 2 subagents)" : "no"}`,
    `main_worktree: ${paths.root}`,
    "Answer with the JSON for the schema only.",
  ];
  return `${promptMd.trim()}\n\n---\n\n${lines.join("\n")}\n`;
}

/** Arguments after `codex` (the caller prepends node + codex.js). */
export function buildCodexArgs(
  args: JobArgs,
  paths: JobPaths,
  resumeThread: string | null,
): string[] {
  const config = ["-c", `model_reasoning_effort=${args.effort}`];
  if (args.task.startsWith("H")) config.push("-c", "sandbox_workspace_write.network_access=true");
  const out = ["--output-schema", paths.schema, "-o", paths.output, "--json"];
  if (resumeThread) return ["exec", "resume", resumeThread, ...config, ...out, "-"];
  return ["exec", "-C", paths.worktree, "-s", "workspace-write", ...config, ...out, "-"];
}

/** thread_id from `codex exec --json` events (first one wins). */
export function extractThreadId(jsonl: string): string | null {
  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const ev = JSON.parse(line) as Record<string, unknown>;
      const id = ev["thread_id"] ?? ev["session_id"];
      if (typeof id === "string" && id) return id;
    } catch {
      // not an event line
    }
  }
  return null;
}

export function validateResult(
  raw: string,
  schema: JsonSchema,
  args: JobArgs,
  fullSha: string,
): { value: Record<string, unknown> | null; errors: string[] } {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { value: null, errors: ["output is not valid JSON"] };
  }
  const errors = validateSchema(value, schema);
  if (errors.length) return { value: null, errors };
  const obj = value as Record<string, unknown>;
  if (obj["task_id"] !== args.task) errors.push(`task_id ${String(obj["task_id"])} ≠ ${args.task}`);
  if (obj["round"] !== args.round) errors.push(`round ${String(obj["round"])} ≠ ${args.round}`);
  if (args.kind === "review") {
    const commit = String(obj["commit"]);
    if (commit.length < 7 || !fullSha.startsWith(commit)) {
      errors.push(`commit ${commit} ≠ ${fullSha}`);
    }
  }
  return { value: errors.length ? null : obj, errors };
}

export function summarize(kind: Kind, obj: Record<string, unknown>): string {
  if (kind === "task") {
    const commits = (obj["commits"] as string[]).length;
    const oos = (obj["out_of_scope_requests"] as string[]).length;
    return [
      `status: ${String(obj["status"])}`,
      `branch: ${String(obj["branch"])} · commits: ${commits}`,
      `files: ${(obj["files_changed"] as string[]).length} · out of scope: ${oos}`,
      `failed checks: ${countChecks(obj, "fail")}`,
      String(obj["summary"]).slice(0, 200),
    ].join("\n");
  }
  const findings = obj["findings"] as { severity: string }[];
  const sev = (s: string) => findings.filter((f) => f.severity === s).length;
  const acc = obj["acceptance"] as { status: string }[];
  const verified = acc.filter((a) => a.status === "verified").length;
  return [
    `verdict (reported): ${String(obj["verdict"])} · commit ${String(obj["commit"])}`,
    `findings: ${sev("bloqueante")} bloqueante · ${sev("importante")} importante · ${sev("melhoria")} melhoria`,
    `acceptance: ${verified}/${acc.length} verified`,
    `failed checks: ${countChecks(obj, "fail")}`,
    String(obj["summary"]).slice(0, 200),
  ].join("\n");
}

function countChecks(obj: Record<string, unknown>, result: string) {
  return (obj["checks"] as { result: string }[]).filter((c) => c.result === result).length;
}

/** Coordinator's approval rule (ORQUESTRACAO §2): never trusts `verdict`. */
export function isApproved(review: Record<string, unknown>, sentSha: string): boolean {
  const findings = review["findings"] as { severity: string }[];
  const acc = review["acceptance"] as { status: string; evidence: string }[];
  const commit = String(review["commit"]);
  return (
    findings.every((f) => f.severity === "melhoria") &&
    acc.length > 0 &&
    acc.every((a) => a.status === "verified" && a.evidence.trim().length > 0) &&
    commit.length >= 7 &&
    sentSha.startsWith(commit)
  );
}

// ---------------------------------------------------------------------------

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export interface JobDeps extends LockFs {
  freemem(): number;
  isAlive(pid: number): boolean;
  pid: number;
  read(file: string): string | null; // null when missing
  write(file: string, data: string): void;
  remove(file: string): void;
  /** git in a worktree; rejects on non-zero exit. */
  git(cwd: string, args: string[]): Promise<string>;
  /** Runs codex with stdin; rejects on non-zero exit or timeout. */
  codex(
    args: string[],
    opts: { cwd: string; input: string; timeoutMs: number },
  ): Promise<ExecResult>;
  log(line: string): void;
}

export interface JobLayout {
  lock: string;
  runs: string; // .orq/runs
  reviews: string; // docs/orquestracao/revisoes
  paths: JobPaths;
  promptFile: string;
}

export type JobOutcome =
  | { ok: true; result: Record<string, unknown>; copiedTo: string; summary: string }
  | { ok: false; reason: string };

export async function runJob(args: JobArgs, layout: JobLayout, deps: JobDeps): Promise<JobOutcome> {
  const free = deps.freemem();
  if (free < MIN_FREE_BYTES) {
    return { ok: false, reason: `free memory ${(free / 1024 ** 3).toFixed(2)} GB < 1.5 GB` };
  }

  if (acquireLock(deps, layout.lock, deps.pid, deps.isAlive) === "busy") {
    return { ok: false, reason: "another Codex job holds the lock" };
  }

  try {
    const name = runName(args);
    const attemptsFile = `${layout.runs}/${name}.attempts`;
    let attempts = Number(deps.read(attemptsFile) ?? "0");
    if (attempts >= MAX_ATTEMPTS) {
      return {
        ok: false,
        reason: `${name} already used ${attempts} attempts (limit ${MAX_ATTEMPTS})`,
      };
    }
    if (deps.read(layout.paths.brief) === null) {
      return { ok: false, reason: `brief not found: ${layout.paths.brief}` };
    }

    const wt = layout.paths.worktree;
    if ((await deps.git(wt, ["status", "--porcelain"])).trim()) {
      return { ok: false, reason: `worktree ${wt} is dirty` };
    }
    // The base is always an immutable SHA: a branch name would move while the
    // job runs and turn the diff into something other than the delivery.
    const baseRef = args.base || (await deps.git(wt, ["rev-parse", "HEAD"])).trim();
    const base = (await deps.git(wt, ["rev-parse", "--verify", `${baseRef}^{commit}`])).trim();
    let fullSha = "";
    if (args.kind === "review") {
      await deps.git(wt, ["checkout", "--quiet", "--detach", args.sha]);
      fullSha = (await deps.git(wt, ["rev-parse", "HEAD"])).trim();
      if (!fullSha.startsWith(args.sha)) {
        return { ok: false, reason: `HEAD ${fullSha} ≠ ${args.sha}` };
      }
      if (base === fullSha)
        return { ok: false, reason: "base equals the reviewed SHA (empty diff)" };
      try {
        await deps.git(wt, ["merge-base", "--is-ancestor", base, fullSha]);
      } catch {
        return { ok: false, reason: `base ${base} is not an ancestor of ${fullSha}` };
      }
    } else {
      const branch = (await deps.git(wt, ["branch", "--show-current"])).trim();
      if (branch !== CODEX_BRANCH)
        return { ok: false, reason: `${wt} is on ${branch}, not ${CODEX_BRANCH}` };
    }

    const schemaText = deps.read(layout.paths.schema);
    const promptMd = deps.read(layout.promptFile);
    if (schemaText === null || promptMd === null)
      return { ok: false, reason: "schema or prompt missing" };
    const schema = JSON.parse(schemaText) as JsonSchema;
    const prompt = buildPrompt(promptMd, args, layout.paths, base);
    deps.write(`${layout.runs}/${name}.prompt.md`, prompt);

    const prevThread = args.resume
      ? deps.read(`${layout.runs}/${args.task}-r${args.round - 1}.thread`)?.trim() || null
      : null;
    if (args.resume && !prevThread) deps.log("no thread to resume; starting a new job");

    let lastError = "";
    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      deps.write(attemptsFile, String(attempts));
      deps.remove(layout.paths.output);
      const codexArgs = buildCodexArgs(args, layout.paths, attempts === 1 ? prevThread : null);
      deps.log(`attempt ${attempts}/${MAX_ATTEMPTS}: codex ${codexArgs.slice(0, 3).join(" ")} …`);
      let res: ExecResult;
      try {
        res = await deps.codex(codexArgs, { cwd: wt, input: prompt, timeoutMs: TIMEOUT_MS });
      } catch (err) {
        const e = err as Partial<ExecResult> & { message?: string; killed?: boolean };
        deps.write(`${layout.runs}/${name}.events.jsonl`, e.stdout ?? "");
        deps.write(`${layout.runs}/${name}.stderr.log`, e.stderr ?? "");
        lastError = e.killed
          ? "timeout (45 min)"
          : `codex failed: ${(e.message ?? "").slice(0, 300)}`;
        deps.log(lastError);
        continue;
      }
      deps.write(`${layout.runs}/${name}.events.jsonl`, res.stdout);
      deps.write(`${layout.runs}/${name}.stderr.log`, res.stderr);
      const thread = extractThreadId(res.stdout);
      if (thread) deps.write(`${layout.runs}/${name}.thread`, thread);

      const raw = deps.read(layout.paths.output);
      if (raw === null) {
        lastError = "codex produced no output file";
        deps.log(lastError);
        continue;
      }
      const { value, errors } = validateResult(raw, schema, args, fullSha);
      if (!value) {
        lastError = `invalid result: ${errors.slice(0, 5).join("; ")}`;
        deps.log(lastError);
        continue;
      }
      if (args.kind === "review" && (await deps.git(wt, ["status", "--porcelain"])).trim()) {
        deps.log("warning: reviewer left the worktree dirty");
      }
      const copiedTo = `${layout.reviews}/${name}${args.kind === "task" ? ".task" : ""}.json`;
      deps.write(copiedTo, `${JSON.stringify(value, null, 2)}\n`);
      return { ok: true, result: value, copiedTo, summary: summarize(args.kind, value) };
    }
    return { ok: false, reason: `${name} failed after ${attempts} attempts: ${lastError}` };
  } finally {
    releaseLock(deps, layout.lock, deps.pid);
  }
}
