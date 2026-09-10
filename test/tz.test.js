import assert from "node:assert/strict";
import { test } from "node:test";
import { closestTimeZones, listTimeZones, matchIana, resolveTimeZone } from "../src/tz.js";
import { CliError } from "../src/errors.js";
import { formatHHmm, formatIsoDate, todayBounds, yesterdayIso } from "../src/time.js";

test("listTimeZones includes common IANA names", () => {
  const names = listTimeZones();
  assert.ok(names.includes("Asia/Kolkata"));
  assert.ok(names.includes("America/New_York"));
  assert.ok(names.includes("Asia/Hong_Kong"));
  assert.ok(names.includes("UTC"));
});

test("exact IANA and hyphen/underscore suffix", () => {
  assert.equal(matchIana("Asia/Hong_Kong"), "Asia/Hong_Kong");
  assert.equal(matchIana("hong-kong"), "Asia/Hong_Kong");
  assert.equal(matchIana("Kolkata"), "Asia/Kolkata");
  assert.equal(matchIana("Singapore"), "Asia/Singapore");
});

test("ambiguous america lists candidates", () => {
  assert.throws(
    () => matchIana("america"),
    (err) => {
      assert.ok(err instanceof CliError);
      assert.match(err.message, /Ambiguous timezone "america"/);
      assert.match(err.message, /America\//);
      assert.match(err.message, /yf-log --tz-list/);
      const lines = err.message.split("\n").filter((l) => l.startsWith("  "));
      assert.ok(lines.length <= 15);
      return true;
    },
  );
});

test("unknown seattle prints 3 closest, no prompt", () => {
  assert.throws(
    () => matchIana("seattle"),
    (err) => {
      assert.ok(err instanceof CliError);
      assert.match(err.message, /Unknown timezone "seattle"/);
      assert.match(err.message, /yf-log --tz-list/);
      assert.doesNotMatch(err.message, /did you mean/i);
      const names = err.message
        .split("\n")
        .filter((l) => l.startsWith("  "))
        .map((l) => l.trim());
      assert.equal(names.length, 3);
      return true;
    },
  );
  assert.equal(closestTimeZones("seattle", 3).length, 3);
});

test("resolveTimeZone order: flag, env TZ, not hardcoded Kolkata", () => {
  assert.equal(resolveTimeZone("America/New_York", { TZ: "UTC" }), "America/New_York");
  assert.equal(resolveTimeZone(null, { TZ: "UTC" }), "UTC");
  assert.equal(resolveTimeZone(null, { TZ: "Asia/Singapore" }), "Asia/Singapore");
  assert.notEqual(resolveTimeZone(null, { TZ: "UTC" }), "Asia/Kolkata");
  const fallback = resolveTimeZone(null, { TZ: "not-a-zone" });
  assert.ok(fallback === "UTC" || listTimeZones().includes(fallback));
});

test("ISO date and 24-hour clock in a zone", () => {
  const noonUtc = Date.parse("2026-09-10T12:00:00Z");
  assert.equal(formatIsoDate(noonUtc, "UTC"), "2026-09-10");
  assert.equal(formatHHmm(noonUtc, "UTC"), "12:00");
  assert.equal(formatHHmm(noonUtc, "America/New_York"), "08:00");
  assert.equal(formatHHmm(noonUtc, "Asia/Kolkata"), "17:30");
});

test("today/yesterday bounds stay in the resolved zone", () => {
  const now = Date.parse("2026-09-10T18:00:00Z");
  const nyToday = todayBounds(now, "America/New_York");
  assert.equal(nyToday.iso, "2026-09-10");
  assert.equal(formatIsoDate(nyToday.startMs, "America/New_York"), "2026-09-10");
  assert.equal(yesterdayIso(now, "America/New_York"), "2026-09-09");
});
