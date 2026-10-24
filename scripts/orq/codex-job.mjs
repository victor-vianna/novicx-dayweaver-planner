// Runs one Codex job (review or task) for the orchestration queue
// (docs/orquestracao/ORQUESTRACAO.md §4). Run from the main worktree:
//   node scripts/orq/codex-job.mjs --kind review --task T1 --round 1 --sha <sha> --base <sha> [--effort xhigh] [--resume] [--multi-agent]
//   node scripts/orq/codex-job.mjs --kind task   --task X8 --round 1 [--base <sha>] [--effort high]
// Logic lives in lib/job.ts; this file only wires real processes and files.
// Codex is spawned as `node <codex.js>` with execFile (no shell: the path has
// spaces and accents). Override the entry point with CODEX_JS if needed.
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseArgs, runJob } from "./lib/job.ts";

const root = process.cwd();
if (!existsSync(path.join(root, "docs/orquestracao/ORQUESTRACAO.md"))) {
  console.error("Run from the main worktree (docs/orquestracao/ORQUESTRACAO.md not found).");
  process.exit(2);
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (err) {
  console.error(err.message);
  process.exit(2);
}

const codexJs =
  process.env.CODEX_JS ??
  path.join(process.env.APPDATA ?? "", "npm/node_modules/@openai/codex/bin/codex.js");
if (!existsSync(codexJs)) {
  console.error(`Codex entry point not found: ${codexJs} (set CODEX_JS).`);
  process.exit(2);
}

const abs = (...p) => path.resolve(root, ...p);
const parent = path.dirname(root);
const name = `${args.task}-r${args.round}`;
const runs = abs(".orq/runs");
const layout = {
  lock: abs(".orq/locks/codex.lock"),
  runs,
  reviews: abs("docs/orquestracao/revisoes"),
  promptFile: abs("docs/orquestracao/PROMPT-CODEX.md"),
  paths: {
    root,
    worktree: path.join(parent, args.kind === "review" ? "novicx-review" : "novicx-codex"),
    brief: abs(`docs/orquestracao/tarefas/${args.task}.md`),
    evidence: abs(`.orq/evidence/${args.task}`),
    previousReview:
      args.round > 1
        ? abs(
            `docs/orquestracao/revisoes/${args.task}-r${args.round - 1}${args.kind === "task" ? ".task" : ""}.json`,
          )
        : null,
    schema: abs(`docs/orquestracao/${args.kind}-schema.json`),
    output: path.join(runs, `${name}.json`),
  },
};

// On timeout the whole process tree is killed: codex.js spawns a native binary
// that would survive a kill of the node parent on Windows.
const killTree = (pid) => {
  if (process.platform === "win32")
    execFile("taskkill", ["/PID", String(pid), "/T", "/F"], () => {});
  else process.kill(pid, "SIGKILL");
};

const run = (file, argv, opts = {}) =>
  new Promise((resolve, reject) => {
    let timedOut = false;
    const child = execFile(
      file,
      argv,
      { cwd: opts.cwd, maxBuffer: 256 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        clearTimeout(timer);
        if (err || timedOut) {
          reject(Object.assign(err ?? new Error("timeout"), { stdout, stderr, killed: timedOut }));
        } else resolve({ stdout, stderr });
      },
    );
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          killTree(child.pid);
        }, opts.timeoutMs)
      : undefined;
    if (opts.input !== undefined) child.stdin.end(opts.input);
  });

const deps = {
  freemem: () => os.freemem(),
  isAlive: (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return err.code === "EPERM";
    }
  },
  pid: process.pid,
  read: (file) => (existsSync(file) ? readFileSync(file, "utf8") : null),
  write: (file, data) => {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, data);
  },
  remove: (file) => rmSync(file, { force: true }),
  createExclusive: (file, data) => {
    mkdirSync(path.dirname(file), { recursive: true });
    try {
      writeFileSync(file, data, { flag: "wx" });
      return true;
    } catch (err) {
      if (err.code === "EEXIST") return false;
      throw err;
    }
  },
  git: async (cwd, argv) => (await run("git", ["-C", cwd, ...argv])).stdout,
  codex: (argv, opts) => run(process.execPath, [codexJs, ...argv], opts),
  log: (line) => console.error(`[codex-job ${name}] ${line}`),
};

const outcome = await runJob(args, layout, deps);
if (!outcome.ok) {
  console.error(`[codex-job ${name}] FAILED: ${outcome.reason}`);
  process.exit(1);
}
console.log(outcome.summary);
console.log(`saved: ${path.relative(root, outcome.copiedTo)}`);
