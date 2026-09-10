import { spawnSync } from "node:child_process";
import { CliError } from "./errors.js";

/**
 * @param {string} cwd
 * @param {string[]} args
 * @param {{ allowFail?: boolean }} [opts]
 * @returns {string | { status: number, stdout: string, stderr: string }}
 */
export function defaultGit(cwd, args, opts = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (opts.allowFail) {
    return {
      status: result.error ? 1 : (result.status ?? 1),
      stdout,
      stderr,
    };
  }
  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new CliError("git was not found on PATH.");
    }
    throw new CliError(result.error.message);
  }
  if (result.status !== 0) {
    const err = (stderr || stdout).trim();
    throw new CliError(err || `git ${args.join(" ")} failed`);
  }
  return stdout;
}

/**
 * @param {unknown} result
 */
export function failStatus(result) {
  if (result && typeof result === "object" && "status" in result) {
    return /** @type {{ status: number }} */ (result).status;
  }
  return 0;
}

/**
 * @param {string} cwd
 * @param {(cwd: string, args: string[], opts?: { allowFail?: boolean }) => unknown} git
 */
export function ensureGitRepo(cwd, git) {
  try {
    const result = git(cwd, ["rev-parse", "--is-inside-work-tree"], { allowFail: true });
    const status = failStatus(result);
    const stdout =
      typeof result === "string"
        ? result
        : result && typeof result === "object" && "stdout" in result
          ? String(/** @type {{ stdout: string }} */ (result).stdout)
          : "";
    const stderr =
      result && typeof result === "object" && "stderr" in result
        ? String(/** @type {{ stderr: string }} */ (result).stderr)
        : "";
    if (status !== 0 || stdout.trim() !== "true") {
      if (/not a git repository/i.test(stderr) || /not a git repository/i.test(stdout)) {
        throw new CliError("Not a git work tree. Run this from a git repository.");
      }
      throw new CliError("Not a git work tree. Run this from a git repository.");
    }
  } catch (err) {
    if (err instanceof CliError) throw err;
    throw new CliError("Not a git work tree. Run this from a git repository.");
  }
}

/**
 * @param {unknown} result
 */
export function gitStdout(result) {
  if (typeof result === "string") return result;
  if (result && typeof result === "object" && "stdout" in result) {
    return String(/** @type {{ stdout: string }} */ (result).stdout);
  }
  return "";
}

/**
 * @param {unknown} result
 */
export function gitStderr(result) {
  if (result && typeof result === "object" && "stderr" in result) {
    return String(/** @type {{ stderr: string }} */ (result).stderr);
  }
  return "";
}
