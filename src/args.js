import { CliError } from "./errors.js";

/**
 * @typedef {object} ParsedArgs
 * @property {boolean} help
 * @property {boolean} version
 * @property {boolean} tzList
 * @property {"today" | "yday" | "date" | "range-inclusive" | "range-git" | "tags" | "branches"} view
 * @property {string | null} date
 * @property {string | null} rangeStart
 * @property {string | null} rangeEnd
 * @property {string | null} rangeToken
 * @property {boolean} watch
 * @property {boolean} raw
 * @property {boolean} all
 * @property {boolean} current
 * @property {boolean} hideSkipCi
 * @property {string | null} tz
 * @property {boolean} tzProvided
 * @property {string | null} base
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const VIEW_ERROR =
  "Choose one view: default today, --yday, --date, two SHAs, A..B, --tags, or --branches.\nSee yf-log --help";

/**
 * @param {string} value
 */
export function parseIsoDate(value) {
  const match = DATE_RE.exec(String(value || "").trim());
  if (!match) {
    throw new CliError("Invalid --date. Use YYYY-MM-DD.\nSee yf-log --help");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() + 1 !== month ||
    utc.getUTCDate() !== day
  ) {
    throw new CliError("Invalid --date. Use YYYY-MM-DD.\nSee yf-log --help");
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * @param {string} flag
 * @param {string | undefined} value
 */
function requireValue(flag, value) {
  if (value == null || value === "" || value.startsWith("-")) {
    if (flag === "--tz") {
      throw new CliError(
        "Flag --tz requires an IANA timezone name.\nExamples: Asia/Kolkata, America/New_York, Asia/Singapore, Europe/London\nSee yf-log --tz-list",
      );
    }
    if (flag === "--date") {
      throw new CliError("Flag --date requires a value: YYYY-MM-DD.\nSee yf-log --help");
    }
    if (flag === "--base") {
      throw new CliError("Flag --base requires a branch name.\nSee yf-log --help");
    }
    throw new CliError(`Flag ${flag} requires a value.\nSee yf-log --help`);
  }
  return value;
}

/**
 * @param {string} token
 */
export function parseGitRangeToken(token) {
  const text = String(token);
  if (text.includes("...")) {
    throw new CliError(
      "Three-dot ranges are not supported. Use two SHAs (inclusive) or A..B (git).\nSee yf-log --help",
    );
  }
  const idx = text.indexOf("..");
  if (idx < 0) {
    throw new CliError(`Unknown argument: ${token}\nSee yf-log --help`);
  }
  const start = text.slice(0, idx);
  const end = text.slice(idx + 2);
  return {
    start: start || "HEAD",
    end: end || "HEAD",
    token: text,
  };
}

/**
 * @param {string[]} argv process.argv
 * @returns {ParsedArgs}
 */
export function parseArgs(argv) {
  const args = argv.slice(2);
  let help = false;
  let version = false;
  let tzList = false;
  let yday = false;
  let date = /** @type {string | null} */ (null);
  let tags = false;
  let branches = false;
  let watch = false;
  let raw = false;
  let allExplicit = false;
  let current = false;
  let hideSkipCi = false;
  let tz = /** @type {string | null} */ (null);
  let tzProvided = false;
  let base = /** @type {string | null} */ (null);
  /** @type {string[]} */
  const positionals = [];

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--help" || a === "-h") {
      help = true;
    } else if (a === "--version" || a === "-V") {
      version = true;
    } else if (a === "--tz-list") {
      tzList = true;
    } else if (a === "--yday") {
      yday = true;
    } else if (a === "--tags") {
      tags = true;
    } else if (a === "--branches") {
      branches = true;
    } else if (a === "--watch") {
      watch = true;
    } else if (a === "--raw") {
      raw = true;
    } else if (a === "--all") {
      allExplicit = true;
    } else if (a === "--current") {
      current = true;
    } else if (a === "--hide-skip-ci") {
      hideSkipCi = true;
    } else if (a === "--date") {
      date = parseIsoDate(requireValue("--date", args[i + 1]));
      i += 1;
    } else if (a.startsWith("--date=")) {
      date = parseIsoDate(requireValue("--date", a.slice("--date=".length)));
    } else if (a === "--tz") {
      tzProvided = true;
      tz = requireValue("--tz", args[i + 1]);
      i += 1;
    } else if (a.startsWith("--tz=")) {
      tzProvided = true;
      tz = requireValue("--tz", a.slice("--tz=".length));
    } else if (a === "--base") {
      base = requireValue("--base", args[i + 1]);
      i += 1;
    } else if (a.startsWith("--base=")) {
      base = requireValue("--base", a.slice("--base=".length));
    } else if (a.startsWith("-")) {
      throw new CliError(`Unknown flag: ${a}\nSee yf-log --help`);
    } else {
      positionals.push(a);
    }
  }

  if (help || version) {
    return {
      help,
      version,
      tzList,
      view: "today",
      date: null,
      rangeStart: null,
      rangeEnd: null,
      rangeToken: null,
      watch: false,
      raw: false,
      all: true,
      current: false,
      hideSkipCi: false,
      tz,
      tzProvided,
      base: null,
    };
  }

  if (tzList) {
    const extras =
      yday ||
      date ||
      tags ||
      branches ||
      watch ||
      raw ||
      allExplicit ||
      current ||
      hideSkipCi ||
      tzProvided ||
      base ||
      positionals.length > 0;
    if (extras) {
      throw new CliError("--tz-list cannot be combined with other flags.\nSee yf-log --help");
    }
    return {
      help: false,
      version: false,
      tzList: true,
      view: "today",
      date: null,
      rangeStart: null,
      rangeEnd: null,
      rangeToken: null,
      watch: false,
      raw: false,
      all: true,
      current: false,
      hideSkipCi: false,
      tz: null,
      tzProvided: false,
      base: null,
    };
  }

  /** @type {string[]} */
  const views = [];
  if (yday) views.push("--yday");
  if (date) views.push("--date");
  if (tags) views.push("--tags");
  if (branches) views.push("--branches");

  const gitRangePos = positionals.filter((p) => p.includes(".."));
  const shaPos = positionals.filter((p) => !p.includes(".."));

  if (gitRangePos.length && shaPos.length) {
    throw new CliError(VIEW_ERROR);
  }
  if (gitRangePos.length > 1) {
    throw new CliError(VIEW_ERROR);
  }
  if (shaPos.length === 1) {
    throw new CliError(
      `A single SHA is not a view. Use two SHAs (inclusive) or A..B (git).\nSee yf-log --help`,
    );
  }
  if (shaPos.length > 2) {
    throw new CliError(VIEW_ERROR);
  }
  if (shaPos.length === 2) views.push("two SHAs");
  if (gitRangePos.length === 1) views.push("A..B");

  if (views.length > 1) {
    throw new CliError(VIEW_ERROR);
  }

  /** @type {ParsedArgs["view"]} */
  let view = "today";
  /** @type {string | null} */
  let rangeStart = null;
  /** @type {string | null} */
  let rangeEnd = null;
  /** @type {string | null} */
  let rangeToken = null;

  if (yday) view = "yday";
  else if (date) view = "date";
  else if (tags) view = "tags";
  else if (branches) view = "branches";
  else if (shaPos.length === 2) {
    view = "range-inclusive";
    rangeStart = shaPos[0];
    rangeEnd = shaPos[1];
  } else if (gitRangePos.length === 1) {
    view = "range-git";
    const parsed = parseGitRangeToken(gitRangePos[0]);
    rangeStart = parsed.start;
    rangeEnd = parsed.end;
    rangeToken = gitRangePos[0];
  }

  const dayView = view === "today" || view === "yday" || view === "date";
  const commitView = dayView || view === "range-inclusive" || view === "range-git";

  if (watch && (view === "range-inclusive" || view === "range-git")) {
    throw new CliError("--watch is not supported for SHA range views.\nSee yf-log --help");
  }
  if (raw && !commitView) {
    throw new CliError("--raw is only valid on commit views (today, --yday, --date, range).\nSee yf-log --help");
  }
  if (base && view !== "branches") {
    throw new CliError("--base is only valid with --branches.\nSee yf-log --help");
  }
  if (hideSkipCi && !dayView) {
    throw new CliError("--hide-skip-ci is only valid on today / --yday / --date.\nSee yf-log --help");
  }
  if ((allExplicit || current) && !dayView) {
    throw new CliError("--all / --current are only valid on today / --yday / --date.\nSee yf-log --help");
  }

  return {
    help: false,
    version: false,
    tzList: false,
    view,
    date,
    rangeStart,
    rangeEnd,
    rangeToken,
    watch,
    raw,
    all: dayView ? !current : false,
    current,
    hideSkipCi,
    tz,
    tzProvided,
    base,
  };
}

export function helpText() {
  return `yf-log — pretty git log tables (today, a day, SHA range, tags, branches)

Usage:
  yf-log                      Today's commits (midnight → now)
  yf-log --watch              Same, redraw every 60s
  yf-log --yday               Yesterday
  yf-log --date 2026-09-09    That calendar day
  yf-log --current            HEAD only (default is --all)
  yf-log --hide-skip-ci       Hide [skip ci] subjects
  yf-log --tz America/New_York
  yf-log --tz Kolkata         Unique IANA suffix
  yf-log --tz-list            All IANA names (no git)

  yf-log abc1234 def5678      Inclusive range (both ends)
  yf-log abc1234..HEAD        Git range (excludes start)
  yf-log abc1234..            Same as abc1234..HEAD

  yf-log --tags
  yf-log --tags --watch
  yf-log --branches
  yf-log --branches --base main
  yf-log --branches --watch

Views are mutually exclusive. Two SHAs = both ends; A..B = git.

Timezone is machine local or --tz (IANA). Headings print the IANA name,
never IST/EDT. Times are 24-hour; dates are YYYY-MM-DD.

--raw prints SHA, time, subject (no table) on commit views.

Does not run your test suite. No GitHub token. Node 20+.`;
}
