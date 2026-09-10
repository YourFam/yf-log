import path from "node:path";
import { CliError } from "./errors.js";
import { failStatus, gitStderr, gitStdout } from "./git.js";
import { formatHeading } from "./table.js";
import { padLeft, padRight, stringDisplayWidth } from "./width.js";

/**
 * @param {string} cwd
 * @param {(cwd: string, args: string[], opts?: { allowFail?: boolean }) => unknown} git
 * @param {string[]} args
 */
function gitOk(cwd, git, args) {
  const result = git(cwd, args, { allowFail: true });
  return failStatus(result) === 0;
}

/**
 * @param {string} cwd
 * @param {(cwd: string, args: string[], opts?: { allowFail?: boolean }) => unknown} git
 * @param {string} ref
 */
function refExists(cwd, git, ref) {
  return gitOk(cwd, git, ["rev-parse", "--verify", "--quiet", ref]);
}

/**
 * @param {string} cwd
 * @param {(cwd: string, args: string[], opts?: { allowFail?: boolean }) => unknown} git
 * @param {string | null} requested
 */
export function resolveBaseRef(cwd, git, requested) {
  const tryNames = [];
  if (requested) {
    tryNames.push(requested);
  } else {
    const originHead = git(cwd, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"], {
      allowFail: true,
    });
    if (failStatus(originHead) === 0) {
      const ref = gitStdout(originHead).trim();
      const name = ref.replace(/^refs\/remotes\/[^/]+\//, "").replace(/^refs\/heads\//, "");
      if (name) tryNames.push(name);
    }
    tryNames.push("main", "master");
  }

  const seen = new Set();
  for (const name of tryNames) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const candidates = [
      `refs/heads/${name}`,
      `refs/remotes/origin/${name}`,
    ];
    for (const ref of candidates) {
      if (refExists(cwd, git, ref)) {
        return { ref, name };
      }
    }
  }

  throw new CliError(
    requested
      ? `Base branch '${requested}' was not found.`
      : "Could not resolve a base branch (origin/HEAD, main, or master).",
  );
}

/**
 * @param {string} cwd
 * @param {(cwd: string, args: string[], opts?: { allowFail?: boolean }) => unknown} git
 */
function getBranchRefs(cwd, git) {
  const output = String(git(cwd, ["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"]));
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((ref) => !/refs\/remotes\/[^/]+\/HEAD$/.test(ref));
}

/**
 * @param {string} ref
 */
function getRefParts(ref) {
  if (ref.startsWith("refs/heads/")) {
    return { kind: "Local", branch: ref.slice("refs/heads/".length), ref };
  }
  const remotePrefix = "refs/remotes/";
  if (!ref.startsWith(remotePrefix)) {
    throw new CliError(`Unsupported ref: ${ref}`);
  }
  const rest = ref.slice(remotePrefix.length);
  const slash = rest.indexOf("/");
  return {
    kind: "Remote",
    branch: slash >= 0 ? rest.slice(slash + 1) : rest,
    ref,
  };
}

/**
 * @param {string} cwd
 * @param {(cwd: string, args: string[], opts?: { allowFail?: boolean }) => unknown} git
 * @param {string} ref
 * @param {string} baseRef
 */
function getAheadBehind(cwd, git, ref, baseRef) {
  const output = String(git(cwd, ["rev-list", "--left-right", "--count", `${baseRef}...${ref}`]));
  const [behindText = "0", aheadText = "0"] = output.trim().split(/\s+/);
  return {
    behind: Number.parseInt(behindText, 10) || 0,
    ahead: Number.parseInt(aheadText, 10) || 0,
  };
}

/**
 * @param {string} cwd
 * @param {(cwd: string, args: string[], opts?: { allowFail?: boolean }) => unknown} git
 * @param {string} ref
 */
function getShortHash(cwd, git, ref) {
  return String(git(cwd, ["rev-parse", "--short", ref])).trim();
}

/**
 * @param {string} cwd
 * @param {(cwd: string, args: string[], opts?: { allowFail?: boolean }) => unknown} git
 */
function getWorktreeMap(cwd, git) {
  const output = String(git(cwd, ["worktree", "list", "--porcelain"]));
  const map = new Map();
  let currentPath = "";
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      currentPath = line.slice("worktree ".length).trim();
      continue;
    }
    if (line.startsWith("branch refs/heads/")) {
      const branch = line.slice("branch refs/heads/".length).trim();
      map.set(branch, currentPath);
    }
  }
  return map;
}

/**
 * @param {string} worktreePath
 */
export function worktreeDirName(worktreePath) {
  if (!worktreePath) return "Idle";
  const base = path.basename(worktreePath.replaceAll("\\", "/"));
  return base || "Idle";
}

/**
 * @param {object} ctx
 */
export function renderBranches(ctx) {
  const { args, timeZone, color, terminalColumns, cwd, git, watch, nowMs } = ctx;

  let fetchWarning = "";
  if (watch) {
    if (!ctx.fetchState) ctx.fetchState = { lastAt: 0 };
    const interval = ctx.fetchIntervalMs ?? 60 * 60 * 1000;
    if (nowMs - ctx.fetchState.lastAt >= interval) {
      const fetched = git(cwd, ["fetch", "--all", "--prune"], { allowFail: true });
      ctx.fetchState.lastAt = nowMs;
      if (failStatus(fetched) !== 0) {
        fetchWarning = `git fetch failed: ${gitStderr(fetched).trim() || "unknown error"}`;
      }
    }
  }

  const { ref: baseRef, name: baseName } = resolveBaseRef(cwd, git, args.base);
  const worktreeMap = getWorktreeMap(cwd, git);
  const groups = new Map();

  for (const ref of getBranchRefs(cwd, git)) {
    const info = getRefParts(ref);
    const { ahead, behind } = getAheadBehind(cwd, git, ref, baseRef);
    const row = {
      kind: info.kind,
      branch: info.branch,
      ahead,
      behind,
      hash: getShortHash(cwd, git, ref),
      worktree:
        info.kind === "Local" ? worktreeDirName(worktreeMap.get(info.branch) || "") : "",
      score: ahead - behind,
      isBase: ref === baseRef,
    };

    const existing = groups.get(info.branch) || {
      branch: info.branch,
      isDefault: info.branch === baseName,
      localSortScore: Number.NEGATIVE_INFINITY,
      rows: [],
    };
    existing.rows.push(row);
    if (row.kind === "Local") {
      existing.localSortScore = row.score;
    }
    groups.set(info.branch, existing);
  }

  for (const group of groups.values()) {
    group.rows.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "Local" ? -1 : 1;
      return 0;
    });
    if (group.localSortScore === Number.NEGATIVE_INFINITY) {
      group.localSortScore = group.rows[0]?.score ?? 0;
    }
    const hasLocal = group.rows.some((r) => r.kind === "Local");
    const hasRemote = group.rows.some((r) => r.kind === "Remote");
    if (hasLocal && !hasRemote) {
      group.rows.push({
        kind: "Remote",
        branch: "No Remote",
        ahead: 0,
        behind: 0,
        hash: "-",
        worktree: "",
        score: 0,
        isSynthetic: true,
        isBase: false,
      });
    }
  }

  const sorted = Array.from(groups.values()).sort((left, right) => {
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
    if (right.localSortScore !== left.localSortScore) {
      return right.localSortScore - left.localSortScore;
    }
    return left.branch.localeCompare(right.branch);
  });

  const rows = sorted.flatMap((group, i) => [
    ...group.rows,
    ...(i < sorted.length - 1 ? [{ isSpacer: true }] : []),
  ]);

  if (!rows.length) {
    return "No branches found.";
  }

  /**
   * @param {number} n
   * @param {number} width
   * @param {"ahead" | "behind"} kind
   */
  const padDelta = (n, width, kind) => {
    const plain = n === 0 ? "-" : kind === "ahead" ? `+${n}` : `-${n}`;
    const padded = padLeft(plain, width);
    if (n === 0) return color.green(padded);
    return kind === "ahead" ? color.blue(padded) : color.red(padded);
  };

  const dataRows = rows.filter((r) => !r.isSpacer);
  const widths = {
    worktree: Math.max("Worktree".length, ...dataRows.map((r) => stringDisplayWidth(r.worktree))),
    branch: Math.max("Branch".length, ...dataRows.map((r) => stringDisplayWidth(r.branch))),
    type: Math.max("Type".length, ...dataRows.map((r) => stringDisplayWidth(r.kind))),
    ahead: Math.max("Ahead".length, ...dataRows.map((r) => (r.ahead === 0 ? 1 : String(`+${r.ahead}`).length))),
    behind: Math.max(
      "Behind".length,
      ...dataRows.map((r) => (r.behind === 0 ? 1 : String(`-${r.behind}`).length)),
    ),
    hash: Math.max("Hash".length, ...dataRows.map((r) => stringDisplayWidth(r.hash))),
  };

  const border = `+-${"-".repeat(widths.worktree)}-+-${"-".repeat(widths.branch)}-+-${"-".repeat(widths.type)}-+-${"-".repeat(widths.ahead)}-+-${"-".repeat(widths.behind)}-+-${"-".repeat(widths.hash)}-+`;
  const header = `| ${padRight("Worktree", widths.worktree)} | ${padRight("Branch", widths.branch)} | ${padRight("Type", widths.type)} | ${padLeft("Ahead", widths.ahead)} | ${padLeft("Behind", widths.behind)} | ${padRight("Hash", widths.hash)} |`;

  const lines = [formatHeading(["BRANCH STATUS", baseName, timeZone], color, terminalColumns), border, header, border];

  for (const row of rows) {
    if (row.isSpacer) {
      lines.push(border);
      continue;
    }
    const kindColor = row.kind === "Local" ? color.cyan.bind(color) : color.gray.bind(color);
    const branchCell = kindColor(padRight(row.branch, widths.branch));
    const worktreeCell = row.worktree
      ? kindColor(padRight(row.worktree, widths.worktree))
      : padRight("", widths.worktree);
    const typeCell = kindColor(padRight(row.kind, widths.type));
    const aheadCell = row.isSynthetic ? padLeft("-", widths.ahead) : padDelta(row.ahead, widths.ahead, "ahead");
    const behindCell = row.isSynthetic
      ? padLeft("-", widths.behind)
      : padDelta(row.behind, widths.behind, "behind");
    const hashCell = padRight(row.hash, widths.hash);
    lines.push(
      `| ${worktreeCell} | ${branchCell} | ${typeCell} | ${aheadCell} | ${behindCell} | ${hashCell} |`,
    );
  }
  lines.push(border);

  if (watch) {
    lines.push(color.gray("Last updated — refreshing every 60s"));
  }
  if (fetchWarning) {
    lines.push(color.yellow(fetchWarning));
  }

  return lines.join("\n");
}
