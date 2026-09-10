/**
 * @param {string} refs
 */
function splitRefs(refs) {
  return String(refs || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * @param {string} refs
 */
export function extractTag(refs) {
  /** @type {string[]} */
  const tags = [];
  for (const part of splitRefs(refs)) {
    const match = part.match(/^tag:\s*(.+)$/);
    if (match?.[1]) {
      tags.push(match[1].replace(/^refs\/tags\//, "").trim());
    }
  }
  const unique = [...new Set(tags.filter(Boolean))];
  return unique.length ? unique.join(", ") : "-";
}

/**
 * @param {string} name
 * @param {string[]} remotes
 */
function isRemoteTracking(name, remotes) {
  for (const remote of remotes) {
    if (name === remote) return false;
    if (name.startsWith(`${remote}/`)) return true;
  }
  return false;
}

/**
 * @param {string} refs
 * @param {string[]} remotes
 */
export function extractBranch(refs, remotes) {
  /** @type {string[]} */
  const locals = [];
  /** @type {string[]} */
  const remoteNames = [];

  for (const part of splitRefs(refs)) {
    if (!part || part === "HEAD") continue;
    if (part.startsWith("tag:")) continue;
    const name = part.startsWith("HEAD -> ") ? part.slice("HEAD -> ".length).trim() : part;
    if (!name) continue;
    if (isRemoteTracking(name, remotes)) {
      remoteNames.push(name);
    } else {
      locals.push(name);
    }
  }

  return locals[0] || remoteNames[0] || "-";
}

/**
 * @param {string} subject
 */
export function isSkipCi(subject) {
  return /\[skip\s*ci\]/i.test(String(subject || ""));
}
