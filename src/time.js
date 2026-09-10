/**
 * @param {Date} date
 * @param {string} timeZone
 */
export function getZoneParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  /** @type {Record<string, string>} */
  const map = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/**
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @param {number} hour
 * @param {number} minute
 * @param {number} second
 * @param {string} timeZone
 */
export function zonedToUtc(year, month, day, hour, minute, second, timeZone) {
  const want = Date.UTC(year, month - 1, day, hour, minute, second);
  let t = want;
  for (let i = 0; i < 8; i += 1) {
    const parts = getZoneParts(new Date(t), timeZone);
    const got = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const diff = want - got;
    if (diff === 0) return t;
    t += diff;
  }
  return t;
}

/**
 * @param {number} ms
 * @param {string} timeZone
 */
export function formatIsoDate(ms, timeZone) {
  const p = getZoneParts(new Date(ms), timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * @param {number} ms
 * @param {string} timeZone
 */
export function formatHHmm(ms, timeZone) {
  const p = getZoneParts(new Date(ms), timeZone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/**
 * @param {string} isoDate YYYY-MM-DD
 * @param {string} timeZone
 */
export function dayBounds(isoDate, timeZone) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const startMs = zonedToUtc(year, month, day, 0, 0, 0, timeZone);
  const endMs = zonedToUtc(year, month, day, 23, 59, 59, timeZone);
  return { startMs, endMs };
}

/**
 * @param {number} nowMs
 * @param {string} timeZone
 */
export function todayBounds(nowMs, timeZone) {
  const iso = formatIsoDate(nowMs, timeZone);
  return { startMs: dayBounds(iso, timeZone).startMs, endMs: nowMs, iso };
}

/**
 * @param {number} nowMs
 * @param {string} timeZone
 */
export function yesterdayIso(nowMs, timeZone) {
  const today = formatIsoDate(nowMs, timeZone);
  const startToday = dayBounds(today, timeZone).startMs;
  return formatIsoDate(startToday - 1, timeZone);
}
