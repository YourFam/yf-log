import { CliError } from "./errors.js";

/** @type {string[] | null} */
let cachedZones = null;

const EXTRA_ZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Calcutta",
  "Europe/Kyiv",
  "Europe/Kiev",
];

/**
 * @param {string} name
 */
function zoneIsUsable(name) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function listTimeZones() {
  if (cachedZones) return cachedZones;
  const values =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  const set = new Set(values);
  for (const extra of EXTRA_ZONES) {
    if (zoneIsUsable(extra)) set.add(extra);
  }
  cachedZones = Array.from(set).sort((a, b) => a.localeCompare(b));
  return cachedZones;
}

/**
 * @param {string} value
 */
export function normalizeZoneKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_");
}

/**
 * @param {string} a
 * @param {string} b
 */
export function levenshtein(a, b) {
  const s = String(a);
  const t = String(b);
  const n = s.length;
  const m = t.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const row = new Array(m + 1);
  for (let j = 0; j <= m; j += 1) row[j] = j;
  for (let i = 1; i <= n; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= m; j += 1) {
      const tmp = row[j];
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[m];
}

/**
 * @param {string} iana
 */
function lastComponent(iana) {
  const idx = iana.lastIndexOf("/");
  return idx >= 0 ? iana.slice(idx + 1) : iana;
}

/**
 * @param {string} iana
 */
function firstComponent(iana) {
  const idx = iana.indexOf("/");
  return idx >= 0 ? iana.slice(0, idx) : iana;
}

/**
 * @param {string} query
 */
function collectMatches(query) {
  const key = normalizeZoneKey(query);
  const zones = listTimeZones();
  /** @type {string[]} */
  const exact = [];
  /** @type {string[]} */
  const suffix = [];
  /** @type {string[]} */
  const region = [];

  for (const name of zones) {
    const full = normalizeZoneKey(name);
    if (full === key) {
      exact.push(name);
      continue;
    }
    if (normalizeZoneKey(lastComponent(name)) === key || full.endsWith(`/${key}`)) {
      suffix.push(name);
      continue;
    }
    if (normalizeZoneKey(firstComponent(name)) === key && name.includes("/")) {
      region.push(name);
    }
  }

  return { exact, suffix, region };
}

/**
 * @param {string} query
 * @param {number} [count]
 */
export function closestTimeZones(query, count = 3) {
  const key = normalizeZoneKey(query);
  const scored = listTimeZones().map((name) => {
    const full = normalizeZoneKey(name);
    const suffix = normalizeZoneKey(lastComponent(name));
    const dist = Math.min(levenshtein(key, full), levenshtein(key, suffix));
    return { name, dist };
  });
  scored.sort((a, b) => a.dist - b.dist || a.name.localeCompare(b.name));
  return scored.slice(0, count).map((item) => item.name);
}

/**
 * @param {string} query
 */
export function matchIana(query) {
  const trimmed = String(query || "").trim();
  if (!trimmed) {
    throw new CliError(
      "Flag --tz requires an IANA timezone name.\nExamples: Asia/Kolkata, America/New_York, Asia/Singapore, Europe/London\nSee yf-log --tz-list",
    );
  }

  const { exact, suffix, region } = collectMatches(trimmed);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    return formatAmbiguous(trimmed, exact);
  }

  const suffixOrRegion = [...new Set([...suffix, ...region])];
  if (suffix.length === 1 && region.length === 0) return suffix[0];
  if (suffixOrRegion.length === 1) return suffixOrRegion[0];
  if (suffixOrRegion.length > 1) {
    return formatAmbiguous(trimmed, suffixOrRegion);
  }

  const closest = closestTimeZones(trimmed, 3);
  throw new CliError(
    `Unknown timezone "${trimmed}". Closest IANA names:\n${closest.map((n) => `  ${n}`).join("\n")}\nSee yf-log --tz-list`,
  );
}

/**
 * @param {string} query
 * @param {string[]} matches
 * @returns {never}
 */
function formatAmbiguous(query, matches) {
  const sorted = [...matches].sort((a, b) => a.localeCompare(b));
  const cap = 15;
  const shown = sorted.slice(0, cap);
  const extra = sorted.length - shown.length;
  const extraLine = extra > 0 ? `\n... and ${extra} more` : "";
  throw new CliError(
    `Ambiguous timezone "${query}". Matches ${sorted.length} names:\n${shown.map((n) => `  ${n}`).join("\n")}${extraLine}\nSee yf-log --tz-list`,
  );
}

/**
 * @param {string} value
 * @returns {string | null}
 */
export function exactIana(value) {
  const key = normalizeZoneKey(value);
  if (!key) return null;
  return listTimeZones().find((name) => normalizeZoneKey(name) === key) || null;
}

/**
 * @param {string | null | undefined} flagValue
 * @param {NodeJS.ProcessEnv} env
 */
export function resolveTimeZone(flagValue, env) {
  if (flagValue != null && String(flagValue).length > 0) {
    return matchIana(flagValue);
  }
  if (env && env.TZ) {
    const fromEnv = exactIana(env.TZ);
    if (fromEnv) return fromEnv;
  }
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (resolved && exactIana(resolved)) return exactIana(resolved);
  return "UTC";
}
