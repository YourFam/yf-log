import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFixture, destroy, git, makeRepo, noGit, runCli } from "./helpers.js";
import { stripAnsi } from "../src/color.js";

let fixture;
/** @type {string} */
let dir;
/** @type {Record<string, string>} */
let shas;

before(() => {
  fixture = buildFixture();
  dir = fixture.dir;
  shas = fixture.shas;
});

after(() => {
  if (dir) destroy(dir);
});

test("help and --tz-list do not call git", () => {
  const help = runCli(["--help"], dir, { git: noGit() });
  assert.equal(help.code, 0);
  assert.match(help.out, /yf-log/);

  const list = runCli(["--tz-list"], dir, { git: noGit() });
  assert.equal(list.code, 0);
  assert.match(list.out, /Asia\/Kolkata/);
  assert.match(list.out, /America\/New_York/);
});

test("mutually exclusive views error with no git", () => {
  const r = runCli(["--tags", "--branches"], dir, { git: noGit() });
  assert.equal(r.code, 1);
  assert.match(r.err, /Choose one view/);
});

test("unknown --tz seattle / america error with no git", () => {
  const seattle = runCli(["--tz", "seattle"], dir, { git: noGit() });
  assert.equal(seattle.code, 1);
  assert.match(seattle.err, /Unknown timezone "seattle"/);
  assert.doesNotMatch(seattle.err, /did you mean/i);
  assert.doesNotMatch(seattle.out, /SHA/);

  const america = runCli(["--tz", "america"], dir, { git: noGit() });
  assert.equal(america.code, 1);
  assert.match(america.err, /Ambiguous timezone "america"/);
  assert.match(america.err, /America\//);
  assert.doesNotMatch(america.out, /\| SHA\s+\|/);
});

test("not a git repo is exit 1", () => {
  const empty = mkdtempSync(join(tmpdir(), "yf-log-nogit-"));
  const r = runCli([], empty);
  assert.equal(r.code, 1);
  assert.match(r.err, /Not a git work tree/);
  destroy(empty);
});

test("default today lists today's UTC commits including skip-ci", () => {
  const r = runCli([], dir);
  assert.equal(r.code, 0);
  assert.match(r.out, /TODAY'S COMMITS/);
  assert.match(r.out, /2026-09-10/);
  assert.match(r.out, /UTC/);
  assert.match(r.out, /feat: utc-morning/);
  assert.match(r.out, /feat: noon-utc/);
  assert.match(r.out, /\[skip ci\]/);
  assert.match(r.out, /feat: on-feature/);
  assert.doesNotMatch(r.out, /feat: yesterday/);
  assert.doesNotMatch(r.out, /feat: eight/);
  assert.doesNotMatch(r.out, /\bIST\b/);
  assert.doesNotMatch(r.out, /\bEDT\b/);
  assert.doesNotMatch(r.out, /\b(?:AM|PM)\b/);
  assert.match(r.out, /12:00/);
});

test("today omits the Date column; yday and --date include it", () => {
  const today = runCli([], dir);
  assert.match(today.out, /\| # \| SHA\s+\| Time\s+\|/);
  assert.doesNotMatch(today.out, /\| Date\s+\|/);

  const yday = runCli(["--yday"], dir);
  assert.equal(yday.code, 0);
  assert.match(yday.out, /YESTERDAY'S COMMITS/);
  assert.match(yday.out, /2026-09-09/);
  assert.match(yday.out, /feat: yesterday/);
  assert.match(yday.out, /\| Date\s+\|/);
  assert.doesNotMatch(yday.out, /feat: noon-utc/);

  const dated = runCli(["--date", "2026-09-08"], dir);
  assert.equal(dated.code, 0);
  assert.match(dated.out, /2026-09-08/);
  assert.match(dated.out, /feat: eight/);
});

test("--current vs --all", () => {
  const all = runCli([], dir);
  assert.match(all.out, /feat: on-feature/);

  const current = runCli(["--current"], dir);
  assert.equal(current.code, 0);
  assert.doesNotMatch(current.out, /feat: on-feature/);
  assert.match(current.out, /feat: noon-utc/);
});

test("--hide-skip-ci filters; default does not", () => {
  const def = runCli([], dir);
  assert.match(def.out, /\[skip ci\]/);
  const hidden = runCli(["--hide-skip-ci"], dir);
  assert.equal(hidden.code, 0);
  assert.doesNotMatch(hidden.out, /\[skip ci\]/);
  assert.match(hidden.out, /feat: noon-utc/);
});

test("--tz changes formatted times; hong-kong unique suffix", () => {
  const ny = runCli(["--tz", "America/New_York"], dir);
  assert.equal(ny.code, 0);
  assert.match(ny.out, /America\/New_York/);
  assert.match(ny.out, /08:00/);
  assert.doesNotMatch(ny.out, /feat: utc-morning/);
  assert.doesNotMatch(ny.out, /\bEDT\b/);
  assert.doesNotMatch(ny.out, /\bEST\b/);

  const kolkata = runCli(["--tz", "Asia/Kolkata"], dir);
  assert.match(kolkata.out, /Asia\/Kolkata/);
  assert.match(kolkata.out, /17:30/);
  assert.doesNotMatch(kolkata.out, /\bIST\b/);

  const hk = runCli(["--date", "2026-09-10", "--tz", "hong-kong"], dir);
  assert.equal(hk.code, 0);
  assert.match(hk.out, /Asia\/Hong_Kong/);
  assert.match(hk.out, /feat: noon-utc/);
});

test("two SHAs include both ends; A..B excludes A; A.. works; invalid and backwards fail", () => {
  const inc = runCli([shas.root, shas.noon], dir);
  assert.equal(inc.code, 0);
  assert.match(inc.out, /chore: initial/);
  assert.match(inc.out, /feat: noon-utc/);
  assert.match(inc.out, /→/);
  assert.doesNotMatch(inc.out, /feat: on-feature/);

  const gitRange = runCli([`${shas.root}..${shas.noon}`], dir);
  assert.equal(gitRange.code, 0);
  assert.doesNotMatch(gitRange.out, /chore: initial/);
  assert.match(gitRange.out, /feat: noon-utc/);

  const open = runCli([`${shas.noon}..`], dir);
  assert.equal(open.code, 0);
  assert.doesNotMatch(open.out, /feat: noon-utc/);
  assert.match(open.out, /chore: skip me/);

  const invalid = runCli(["deadbeefdeadbeef", "main"], dir);
  assert.equal(invalid.code, 1);
  assert.match(invalid.err, /not a valid commit/);

  const back = runCli([shas.noon, shas.root], dir);
  assert.equal(back.code, 1);
  assert.match(back.err, /Backwards ranges/);
});

test("--tags table has IANA heading and no Branch column", () => {
  const r = runCli(["--tags"], dir);
  assert.equal(r.code, 0);
  assert.match(r.out, /ALL TAGS/);
  assert.match(r.out, /UTC/);
  assert.match(r.out, /\| Tag\s+\| SHA\s+\| Date\s+\| Time\s+\| Commit\s+\|/);
  assert.match(r.out, /\| v1\.0\s+\| [0-9a-f]+\s+\| 2026-09-08 \| \d{2}:\d{2} \| feat: eight/);
  assert.doesNotMatch(r.out, /%x1f/);
  assert.doesNotMatch(r.out, /1970-01-01/);
  assert.doesNotMatch(r.out, /\| Branch \|/);
  assert.doesNotMatch(r.out, /\| Worktree \|/);
});

test("--branches groups local/remote, Idle or dir name, default first", () => {
  const r = runCli(["--branches"], dir);
  assert.equal(r.code, 0);
  assert.match(r.out, /BRANCH STATUS VS\s+main\s+UTC/);
  assert.match(r.out, /main/);
  assert.match(r.out, /feature/);
  assert.match(r.out, /No Remote/);
  assert.match(r.out, /Idle|yf-log-/);
  assert.match(r.out, /Local/);
  assert.match(r.out, /Remote/);
  const fetch = r.gitCalls.some((args) => args[0] === "fetch");
  assert.equal(fetch, false);
});

test("empty log is exit 0", () => {
  const r = runCli(["--date", "2026-01-01"], dir);
  assert.equal(r.code, 0);
  assert.match(r.out, /No commits found for 2026-01-01/);
});

test("empty tags is exit 0", () => {
  const empty = makeRepo();
  git(empty, ["commit", "--allow-empty", "-m", "empty"], {
    GIT_AUTHOR_DATE: "2026-09-01T12:00:00Z",
    GIT_COMMITTER_DATE: "2026-09-01T12:00:00Z",
  });
  const r = runCli(["--tags"], empty);
  assert.equal(r.code, 0);
  assert.match(r.out, /No tags found/);
  destroy(empty);
});

test("no ANSI when NO_COLOR=1", () => {
  const r = runCli([], dir, { isTTY: () => true, env: { TZ: "UTC", NO_COLOR: "1" } });
  assert.equal(r.code, 0);
  assert.equal(stripAnsi(r.out), r.out);
  assert.doesNotMatch(r.out, /\u001b\[/);
});

test("no ANSI when not a TTY even without NO_COLOR", () => {
  const env = { TZ: "UTC" };
  delete env.NO_COLOR;
  const r = runCli([], dir, { isTTY: () => false, env });
  assert.equal(stripAnsi(r.out), r.out);
});

test("--raw prints SHA time subject under IANA heading", () => {
  const r = runCli(["--raw"], dir);
  assert.equal(r.code, 0);
  assert.match(r.out, /TODAY'S COMMITS/);
  assert.match(r.out, /UTC/);
  assert.match(r.out, /feat: noon-utc/);
  assert.doesNotMatch(r.out, /^\+/m);
});

test("default zone is env TZ, not hardcoded Asia/Kolkata", () => {
  const r = runCli([], dir, { env: { TZ: "UTC", NO_COLOR: "1" } });
  assert.match(r.out, /UTC/);
  assert.doesNotMatch(r.out, /Asia\/Kolkata/);
});

test("version prints package version", () => {
  const r = runCli(["--version"], dir, { git: noGit() });
  assert.equal(r.code, 0);
  assert.match(r.out, /0\.1\.0/);
});
