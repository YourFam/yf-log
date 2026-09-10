import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { helpText, parseArgs } from "./args.js";
import { renderBranches } from "./branches.js";
import { createColor } from "./color.js";
import { renderCommits } from "./commits.js";
import { CliError } from "./errors.js";
import { defaultGit, ensureGitRepo } from "./git.js";
import { renderTags } from "./tags.js";
import { listTimeZones, resolveTimeZone } from "./tz.js";

const pkg = JSON.parse(
  readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"),
    "utf8",
  ),
);

export const WATCH_INTERVAL_MS = 60 * 1000;
export const FETCH_INTERVAL_MS = 60 * 60 * 1000;

function defaultDeps() {
  return {
    cwd: process.cwd(),
    env: process.env,
    version: pkg.version,
    git: defaultGit,
    log: (msg) => console.log(msg),
    err: (msg) => console.error(msg),
    isTTY: () => Boolean(process.stdout.isTTY),
    columns: () => process.stdout.columns || 0,
    now: () => Date.now(),
    write: (s) => process.stdout.write(s),
    setInterval: (fn, ms) => setInterval(fn, ms),
    watchIntervalMs: WATCH_INTERVAL_MS,
    fetchIntervalMs: FETCH_INTERVAL_MS,
    fetchState: { lastAt: 0 },
  };
}

/**
 * @param {ReturnType<typeof parseArgs>} args
 * @param {string} timeZone
 * @param {ReturnType<typeof defaultDeps>} deps
 */
function renderView(args, timeZone, deps) {
  const color = createColor({ isTTY: deps.isTTY(), env: deps.env });
  const ctx = {
    args,
    timeZone,
    color,
    terminalColumns: deps.columns(),
    cwd: deps.cwd,
    git: deps.git,
    nowMs: deps.now(),
    watch: args.watch,
    fetchState: deps.fetchState,
    fetchIntervalMs: deps.fetchIntervalMs,
  };

  if (args.view === "tags") return renderTags(ctx);
  if (args.view === "branches") return renderBranches(ctx);
  return renderCommits(ctx);
}

/**
 * @param {string[]} argv
 * @param {Partial<ReturnType<typeof defaultDeps>>} [overrides]
 * @returns {number | null} null means keep the process alive (--watch)
 */
export function main(argv, overrides = {}) {
  const deps = { ...defaultDeps(), ...overrides };
  const args = parseArgs(argv);

  if (args.help) {
    deps.log(helpText());
    return 0;
  }
  if (args.version) {
    deps.log(deps.version);
    return 0;
  }
  if (args.tzList) {
    deps.log(listTimeZones().join("\n"));
    return 0;
  }

  const timeZone = resolveTimeZone(args.tzProvided ? args.tz : null, deps.env);
  ensureGitRepo(deps.cwd, deps.git);

  const print = () => {
    if (args.watch && deps.isTTY()) {
      deps.write("\u001b[2J\u001b[3J\u001b[H");
    }
    const text = renderView(args, timeZone, deps);
    deps.log(text);
  };

  print();

  if (args.watch) {
    deps.setInterval(print, deps.watchIntervalMs);
    return null;
  }
  return 0;
}

/**
 * @param {string[]} argv
 */
export function run(argv) {
  try {
    const code = main(argv);
    if (code == null) return;
    process.exit(typeof code === "number" ? code : 0);
  } catch (err) {
    const message = err instanceof CliError ? err.message : err.message || String(err);
    console.error(message);
    process.exit(err instanceof CliError ? err.exitCode : 1);
  }
}
