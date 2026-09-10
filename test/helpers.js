import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { main } from "../src/index.js";
import { defaultGit } from "../src/git.js";
import { CliError } from "../src/errors.js";

export const NOW_UTC = Date.parse("2026-09-10T18:00:00Z");

/**
 * @param {string} cwd
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} [extraEnv]
 */
export function git(cwd, args, extraEnv = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "commit.gpgsign",
      GIT_CONFIG_VALUE_0: "false",
      ...extraEnv,
    },
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim());
  }
  return result.stdout;
}

export function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "yf-log-"));
  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "user.name", "Test"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  return dir;
}

/**
 * @param {string} dir
 * @param {{ message: string, date: string, file?: string, content?: string }} spec
 */
export function commit(dir, spec) {
  const file = spec.file || "file.txt";
  writeFileSync(join(dir, file), spec.content ?? `${spec.message}\n${spec.date}\n`);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-m", spec.message], {
    GIT_AUTHOR_DATE: spec.date,
    GIT_COMMITTER_DATE: spec.date,
  });
  return git(dir, ["rev-parse", "--short", "HEAD"]).trim();
}

/**
 * @param {string} dir
 */
export function destroy(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows can briefly lock .git
  }
}

/**
 * @param {string[]} argv
 * @param {string} cwd
 * @param {object} [extra]
 */
export function runCli(argv, cwd, extra = {}) {
  const out = [];
  const err = [];
  /** @type {unknown[]} */
  const gitCalls = [];
  const env = { TZ: "UTC", NO_COLOR: "1", ...(extra.env || {}) };
  const gitFn =
    extra.git ||
    ((c, args, opts) => {
      gitCalls.push(args);
      return defaultGit(c, args, opts);
    });

  try {
    const code = main(["node", "yf-log", ...argv], {
      cwd,
      env,
      version: "0.1.0",
      git: gitFn,
      log: (m) => out.push(String(m)),
      err: (m) => err.push(String(m)),
      isTTY: extra.isTTY || (() => false),
      columns: extra.columns || (() => 120),
      now: extra.now || (() => NOW_UTC),
      setInterval: extra.setInterval || (() => 0),
      write: extra.write || (() => {}),
      fetchState: extra.fetchState || { lastAt: 0 },
      fetchIntervalMs: extra.fetchIntervalMs,
    });
    return {
      code: code ?? 0,
      out: out.join("\n"),
      err: err.join("\n"),
      gitCalls,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      code: e instanceof CliError ? e.exitCode : 1,
      out: out.join("\n"),
      err: message,
      error: e,
      gitCalls,
    };
  }
}

export function noGit() {
  return () => {
    throw new Error("git should not be called");
  };
}

/**
 * Build a fixture with a known timeline.
 * @returns {{ dir: string, shas: Record<string, string> }}
 */
export function buildFixture() {
  const dir = makeRepo();
  const shas = {
    root: commit(dir, { message: "chore: initial", date: "2026-09-01T12:00:00Z", file: "a.txt" }),
    eight: commit(dir, { message: "feat: eight", date: "2026-09-08T15:00:00Z", file: "b.txt" }),
    yday: commit(dir, { message: "feat: yesterday", date: "2026-09-09T12:00:00Z", file: "c.txt" }),
    utcMorning: commit(dir, {
      message: "feat: utc-morning",
      date: "2026-09-10T02:00:00Z",
      file: "d.txt",
    }),
    noon: commit(dir, { message: "feat: noon-utc", date: "2026-09-10T12:00:00Z", file: "e.txt" }),
    skip: commit(dir, {
      message: "chore: skip me [skip ci]",
      date: "2026-09-10T12:30:00Z",
      file: "f.txt",
    }),
  };

  git(dir, ["tag", "-a", "v1.0", shas.eight, "-m", "v1.0"], {
    GIT_COMMITTER_DATE: "2026-09-08T16:00:00Z",
  });

  git(dir, ["checkout", "-b", "feature"]);
  shas.feature = commit(dir, {
    message: "feat: on-feature",
    date: "2026-09-10T13:00:00Z",
    file: "g.txt",
  });
  git(dir, ["checkout", "main"]);

  git(dir, ["remote", "add", "origin", "https://example.com/repo.git"]);
  git(dir, ["update-ref", "refs/remotes/origin/main", "refs/heads/main"]);
  git(dir, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);

  return { dir, shas };
}
