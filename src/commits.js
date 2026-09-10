import { CliError } from "./errors.js";
import { extractBranch, extractTag, isSkipCi } from "./decorations.js";
import { failStatus, gitStderr, gitStdout } from "./git.js";
import { formatBoxTable, formatHeading } from "./table.js";
import { dayBounds, formatHHmm, formatIsoDate, todayBounds, yesterdayIso } from "./time.js";

const PRETTY = "--pretty=format:%h%x1f%ct%x1f%D%x1f%s%x1e";

/**
 * @param {string} output
 */
export function parseLogOutput(output) {
  return String(output || "")
    .split("\u001e")
    .map((record) => record.trim())
    .filter((record) => record.length > 0)
    .map((record) => {
      const [sha = "", ts = "", refs = "", subject = ""] = record.split("\u001f");
      return {
        sha: sha.trim(),
        ts: Number(ts.trim()) || 0,
        refs: refs.trim(),
        subject: subject.trim(),
      };
    });
}

/**
 * @param {string} cwd
 * @param {(cwd: string, args: string[], opts?: { allowFail?: boolean }) => unknown} git
 */
function listRemotes(cwd, git) {
  const result = git(cwd, ["remote"], { allowFail: true });
  if (failStatus(result) !== 0) return ["origin"];
  const names = gitStdout(result)
    .split(/\r?\n/)
    .map((n) => n.trim())
    .filter(Boolean);
  return names.length ? names : ["origin"];
}

/**
 * @param {string} cwd
 * @param {(cwd: string, args: string[], opts?: { allowFail?: boolean }) => unknown} git
 * @param {string[]} args
 */
function gitLog(cwd, git, args) {
  const result = git(cwd, ["log", ...args], { allowFail: true });
  const stderr = gitStderr(result).trim();
  const stdout = gitStdout(result);
  if (failStatus(result) !== 0) {
    if (/does not have any commits yet/i.test(stderr) || /does not have any commits yet/i.test(stdout)) {
      return "";
    }
    throw new CliError(stderr || "Failed to read git log.");
  }
  return stdout;
}

/**
 * @param {string} cwd
 * @param {(cwd: string, args: string[], opts?: { allowFail?: boolean }) => unknown} git
 * @param {string} rev
 */
export function resolveCommit(cwd, git, rev) {
  const result = git(cwd, ["rev-parse", "--verify", `${rev}^{commit}`], { allowFail: true });
  if (failStatus(result) !== 0) {
    throw new CliError(`"${rev}" is not a valid commit.`);
  }
  return gitStdout(result).trim();
}

/**
 * @param {string} cwd
 * @param {(cwd: string, args: string[], opts?: { allowFail?: boolean }) => unknown} git
 * @param {string} sha
 */
function commitUnix(cwd, git, sha) {
  const out = git(cwd, ["log", "-1", "--format=%ct", sha]);
  return Number(String(out).trim());
}

/**
 * @param {import("./args.js").ParsedArgs} args
 * @param {string} timeZone
 * @param {number} nowMs
 */
export function resolveCommitWindow(args, timeZone, nowMs) {
  if (args.view === "today") {
    const bounds = todayBounds(nowMs, timeZone);
    return { ...bounds, label: "TODAY'S COMMITS", dateLabel: bounds.iso, showDate: false };
  }
  if (args.view === "yday") {
    const iso = yesterdayIso(nowMs, timeZone);
    const bounds = dayBounds(iso, timeZone);
    return { startMs: bounds.startMs, endMs: bounds.endMs, label: "YESTERDAY'S COMMITS", dateLabel: iso, showDate: true };
  }
  if (args.view === "date") {
    const iso = args.date;
    const bounds = dayBounds(iso, timeZone);
    return { startMs: bounds.startMs, endMs: bounds.endMs, label: "COMMITS", dateLabel: iso, showDate: true };
  }
  return null;
}

/**
 * @param {object} ctx
 * @param {import("./args.js").ParsedArgs} ctx.args
 * @param {string} ctx.timeZone
 * @param {ReturnType<import("./color.js").createColor>} ctx.color
 * @param {number} ctx.terminalColumns
 * @param {string} ctx.cwd
 * @param {(cwd: string, args: string[], opts?: { allowFail?: boolean }) => unknown} ctx.git
 * @param {number} ctx.nowMs
 * @param {boolean} ctx.watch
 */
export function renderCommits(ctx) {
  const { args, timeZone, color, terminalColumns, cwd, git, nowMs, watch } = ctx;
  const remotes = listRemotes(cwd, git);
  const window = resolveCommitWindow(args, timeZone, nowMs);

  /** @type {string[]} */
  const logArgs = ["--reverse", PRETTY];
  /** @type {string} */
  let headingMid = "";
  let showDate = true;
  /** @type {string} */
  let emptyMessage = "No commits found.";
  /** @type {string} */
  let headingLabel = "COMMITS";

  if (window) {
    showDate = window.showDate;
    headingLabel = window.label;
    headingMid = window.dateLabel;
    emptyMessage =
      args.view === "today"
        ? "No commits found."
        : `No commits found for ${window.dateLabel}.`;
    logArgs.unshift(`--until=${Math.floor(window.endMs / 1000)}`);
    logArgs.unshift(`--since=${Math.floor(window.startMs / 1000)}`);
    if (args.all) logArgs.unshift("--all");
  } else if (args.view === "range-inclusive") {
    const startFull = resolveCommit(cwd, git, args.rangeStart);
    const endFull = resolveCommit(cwd, git, args.rangeEnd);
    const startTs = commitUnix(cwd, git, startFull);
    const endTs = commitUnix(cwd, git, endFull);
    if (startTs > endTs) {
      throw new CliError(
        `Start commit (${args.rangeStart}) is later than end commit (${args.rangeEnd}). Backwards ranges are not allowed.`,
      );
    }
    headingMid = `${args.rangeStart} → ${args.rangeEnd}`;
    emptyMessage = `No commits found between ${args.rangeStart} and ${args.rangeEnd}.`;
    const caret = git(cwd, ["log", `${startFull}^..${endFull}`, "--reverse", PRETTY], {
      allowFail: true,
    });
    if (failStatus(caret) !== 0) {
      const err = gitStderr(caret);
      if (/unknown revision|bad revision/i.test(err)) {
        const fallback = gitLog(cwd, git, [endFull, "--reverse", PRETTY]);
        return formatCommitResult({
          rawOutput: fallback,
          args,
          timeZone,
          color,
          terminalColumns,
          remotes,
          showDate: true,
          headingLabel,
          headingMid,
          emptyMessage,
          watch,
        });
      }
      throw new CliError(err.trim() || "Failed to read git log.");
    }
    return formatCommitResult({
      rawOutput: gitStdout(caret),
      args,
      timeZone,
      color,
      terminalColumns,
      remotes,
      showDate: true,
      headingLabel,
      headingMid,
      emptyMessage,
      watch,
    });
  } else if (args.view === "range-git") {
    resolveCommit(cwd, git, args.rangeStart);
    resolveCommit(cwd, git, args.rangeEnd);
    headingMid = args.rangeToken || `${args.rangeStart}..${args.rangeEnd}`;
    emptyMessage = `No commits found for ${headingMid}.`;
    logArgs.unshift(`${args.rangeStart}..${args.rangeEnd}`);
  }

  const rawOutput = gitLog(cwd, git, logArgs);
  return formatCommitResult({
    rawOutput,
    args,
    timeZone,
    color,
    terminalColumns,
    remotes,
    showDate,
    headingLabel,
    headingMid,
    emptyMessage,
    watch,
  });
}

/**
 * @param {object} opts
 */
function formatCommitResult(opts) {
  const {
    rawOutput,
    args,
    timeZone,
    color,
    terminalColumns,
    remotes,
    showDate,
    headingLabel,
    headingMid,
    emptyMessage,
    watch,
  } = opts;

  let records = parseLogOutput(rawOutput);
  if (args.hideSkipCi) {
    records = records.filter((row) => !isSkipCi(row.subject));
  }

  if (!records.length) {
    return emptyMessage;
  }

  const mid =
    headingLabel === "COMMITS" && headingMid.includes("→")
      ? `${headingMid} (${records.length})`
      : headingLabel === "COMMITS" && headingMid.includes("..")
        ? `${headingMid} (${records.length})`
        : headingMid;

  const heading = formatHeading([headingLabel, mid, timeZone], color, terminalColumns);

  if (args.raw) {
    const lines = records.map((row) => {
      const time = formatHHmm(row.ts * 1000, timeZone);
      return `${row.sha}  ${time}  ${row.subject}`;
    });
    const footer = watch ? `\n${color.gray("Last updated — refreshing every 60s")}` : "";
    return `${heading}\n${lines.join("\n")}${footer}`;
  }

  const rows = records.map((row, index) => {
    const ms = row.ts * 1000;
    /** @type {Record<string, string>} */
    const rec = {
      sno: String(index + 1),
      sha: row.sha,
      time: formatHHmm(ms, timeZone),
      tag: extractTag(row.refs),
      branch: extractBranch(row.refs, remotes),
      commit: row.subject,
    };
    if (showDate) rec.date = formatIsoDate(ms, timeZone);
    return rec;
  });

  /** @type {import("./table.js").TableColumn[]} */
  const columns = [
    { key: "sno", header: "#" },
    { key: "sha", header: "SHA", paint: (t, c) => c.yellow(t) },
  ];
  if (showDate) {
    columns.push({ key: "date", header: "Date", paint: (t, c) => c.cyan(t) });
  }
  columns.push(
    { key: "time", header: "Time", paint: (t, c) => c.cyan(t) },
    { key: "tag", header: "Tag" },
    { key: "branch", header: "Branch" },
    { key: "commit", header: "Commit" },
  );

  const table = formatBoxTable(columns, rows, {
    terminalColumns,
    color,
    fitKey: "commit",
  });
  const footer = watch ? `\n${color.gray("Last updated — refreshing every 60s")}` : "";
  return `${heading}\n${table.join("\n")}${footer}`;
}
