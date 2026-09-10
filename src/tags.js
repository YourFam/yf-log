import { CliError } from "./errors.js";
import { failStatus, gitStderr, gitStdout } from "./git.js";
import { formatBoxTable, formatHeading } from "./table.js";
import { formatHHmm, formatIsoDate } from "./time.js";

/**
 * @param {object} ctx
 * @param {string} ctx.timeZone
 * @param {ReturnType<import("./color.js").createColor>} ctx.color
 * @param {number} ctx.terminalColumns
 * @param {string} ctx.cwd
 * @param {(cwd: string, args: string[], opts?: { allowFail?: boolean }) => unknown} ctx.git
 * @param {boolean} ctx.watch
 */
export function renderTags(ctx) {
  const { timeZone, color, terminalColumns, cwd, git, watch } = ctx;
  const result = git(
    cwd,
    [
      "for-each-ref",
      "refs/tags",
      "--sort=-creatordate",
      "--format=%(refname:short)%x1f%(objectname:short)%x1f%(creatordate:unix)%x1f%(contents:subject)%x1f%(*objectname:short)%x1f%(*creatordate:unix)%x1f%(*contents:subject)",
    ],
    { allowFail: true },
  );
  if (failStatus(result) !== 0) {
    throw new CliError(gitStderr(result).trim() || "Failed to read git tags.");
  }
  const output = gitStdout(result).trim();
  if (!output) {
    return "No tags found.";
  }

  const rows = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [tag, sha, ts, subject, peeledSha, peeledTs, peeledSubject] = line.split("\u001f");
      const useSha = peeledSha || sha;
      const useTs = Number(peeledTs || ts) || 0;
      const useSubject = (peeledSubject || subject || "").trim();
      const ms = useTs * 1000;
      return {
        tag: tag || "",
        sha: useSha || "",
        date: formatIsoDate(ms, timeZone),
        time: formatHHmm(ms, timeZone),
        commit: useSubject,
      };
    });

  if (!rows.length) {
    return "No tags found.";
  }

  const heading = formatHeading(["ALL TAGS", timeZone], color, terminalColumns);
  const columns = [
    { key: "tag", header: "Tag", paint: (t, c) => c.magenta(t) },
    { key: "sha", header: "SHA", paint: (t, c) => c.yellow(t) },
    { key: "date", header: "Date", paint: (t, c) => c.cyan(t) },
    { key: "time", header: "Time", paint: (t, c) => c.cyan(t) },
    { key: "commit", header: "Commit" },
  ];
  const table = formatBoxTable(columns, rows, {
    terminalColumns,
    color,
    fitKey: "commit",
  });
  const footer = watch ? `\n${color.gray("Last updated — refreshing every 60s")}` : "";
  return `${heading}\n${table.join("\n")}${footer}`;
}
