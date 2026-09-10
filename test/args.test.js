import assert from "node:assert/strict";
import { test } from "node:test";
import { helpText, parseArgs } from "../src/args.js";
import { CliError } from "../src/errors.js";

const sh = (...rest) => ["node", "yf-log", ...rest];

function throwsMessage(fn, re) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof CliError);
    assert.equal(err.exitCode, 1);
    assert.match(err.message, re);
    return true;
  });
}

test("bare argv is today", () => {
  const a = parseArgs(sh());
  assert.equal(a.view, "today");
  assert.equal(a.all, true);
  assert.equal(a.current, false);
  assert.equal(a.watch, false);
  assert.equal(a.hideSkipCi, false);
});

test("--yday / --date / --tags / --branches select views", () => {
  assert.equal(parseArgs(sh("--yday")).view, "yday");
  assert.equal(parseArgs(sh("--date", "2026-09-09")).view, "date");
  assert.equal(parseArgs(sh("--date=2026-09-09")).date, "2026-09-09");
  assert.equal(parseArgs(sh("--tags")).view, "tags");
  assert.equal(parseArgs(sh("--branches")).view, "branches");
});

test("two SHAs are inclusive; A..B is git; A.. is A..HEAD", () => {
  const inc = parseArgs(sh("abc", "def"));
  assert.equal(inc.view, "range-inclusive");
  assert.equal(inc.rangeStart, "abc");
  assert.equal(inc.rangeEnd, "def");

  const gitRange = parseArgs(sh("abc..HEAD"));
  assert.equal(gitRange.view, "range-git");
  assert.equal(gitRange.rangeStart, "abc");
  assert.equal(gitRange.rangeEnd, "HEAD");

  const open = parseArgs(sh("abc.."));
  assert.equal(open.view, "range-git");
  assert.equal(open.rangeStart, "abc");
  assert.equal(open.rangeEnd, "HEAD");
});

test("mutually exclusive views error", () => {
  throwsMessage(() => parseArgs(sh("--tags", "--branches")), /Choose one view/);
  throwsMessage(() => parseArgs(sh("--yday", "abc", "def")), /Choose one view/);
  throwsMessage(() => parseArgs(sh("--tags", "abc..def")), /Choose one view/);
  throwsMessage(() => parseArgs(sh("--yday", "--date", "2026-09-09")), /Choose one view/);
});

test("unknown flags error", () => {
  throwsMessage(() => parseArgs(sh("--today")), /Unknown flag: --today/);
  throwsMessage(() => parseArgs(sh("--interval")), /Unknown flag: --interval/);
  throwsMessage(() => parseArgs(sh("--force")), /Unknown flag: --force/);
});

test("single SHA is not a view", () => {
  throwsMessage(() => parseArgs(sh("abc1234")), /single SHA/);
});

test("--watch is rejected on range", () => {
  throwsMessage(() => parseArgs(sh("abc", "def", "--watch")), /not supported for SHA range/);
  throwsMessage(() => parseArgs(sh("abc..def", "--watch")), /not supported for SHA range/);
});

test("--watch is accepted on today / yday / date / tags / branches", () => {
  assert.equal(parseArgs(sh("--watch")).watch, true);
  assert.equal(parseArgs(sh("--yday", "--watch")).watch, true);
  assert.equal(parseArgs(sh("--date", "2026-09-09", "--watch")).watch, true);
  assert.equal(parseArgs(sh("--tags", "--watch")).watch, true);
  assert.equal(parseArgs(sh("--branches", "--watch")).watch, true);
});

test("--current turns --all off", () => {
  const a = parseArgs(sh("--current"));
  assert.equal(a.current, true);
  assert.equal(a.all, false);
  const both = parseArgs(sh("--all", "--current"));
  assert.equal(both.all, false);
});

test("--date missing or invalid", () => {
  throwsMessage(() => parseArgs(sh("--date")), /requires a value/);
  throwsMessage(() => parseArgs(sh("--date", "09/10/2026")), /Invalid --date/);
  throwsMessage(() => parseArgs(sh("--date", "2026-13-40")), /Invalid --date/);
  throwsMessage(() => parseArgs(sh("--date=2026-02-29")), /Invalid --date/);
});

test("--tz missing value", () => {
  throwsMessage(() => parseArgs(sh("--tz")), /IANA timezone/);
  throwsMessage(() => parseArgs(sh("--tz=")), /IANA timezone/);
});

test("--raw only on commit views; --base only on branches", () => {
  throwsMessage(() => parseArgs(sh("--tags", "--raw")), /--raw is only valid/);
  throwsMessage(() => parseArgs(sh("--base", "main")), /only valid with --branches/);
  assert.equal(parseArgs(sh("--branches", "--base", "main")).base, "main");
  assert.equal(parseArgs(sh("--raw")).raw, true);
});

test("help and version skip view validation", () => {
  assert.equal(parseArgs(sh("--help")).help, true);
  assert.equal(parseArgs(sh("-h")).help, true);
  assert.equal(parseArgs(sh("--version")).version, true);
});

test("--tz-list cannot combine", () => {
  throwsMessage(() => parseArgs(sh("--tz-list", "--tags")), /cannot be combined/);
});

test("three-dot range is rejected", () => {
  throwsMessage(() => parseArgs(sh("abc...def")), /Three-dot/);
});

test("help text names the command, Node 20+, and range spellings", () => {
  const h = helpText();
  assert.match(h, /yf-log/);
  assert.match(h, /Node 20\+/);
  assert.match(h, /both ends/);
  assert.match(h, /A\.\.B/);
});
