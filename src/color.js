export const ANSI = {
  reset: "\u001b[0m",
  boldYellow: "\u001b[1;93m",
  headingRight: "\u001b[38;5;111m",
  brightYellow: "\u001b[93m",
  brightCyan: "\u001b[96m",
  brightMagenta: "\u001b[95m",
  green: "\u001b[32m",
  red: "\u001b[31m",
  gray: "\u001b[90m",
  blue: "\u001b[38;5;45m",
};

/**
 * @param {{ isTTY: boolean, env: NodeJS.ProcessEnv }} opts
 */
export function createColor(opts) {
  const enabled = Boolean(opts.isTTY) && opts.env.NO_COLOR === undefined;
  /**
   * @param {string} value
   * @param {string} code
   */
  const wrap = (value, code) => (enabled ? `${code}${value}${ANSI.reset}` : value);
  return {
    enabled,
    wrap,
    heading: (value) => wrap(value, ANSI.boldYellow),
    headingRight: (value) => wrap(value, ANSI.headingRight),
    yellow: (value) => wrap(value, ANSI.brightYellow),
    cyan: (value) => wrap(value, ANSI.brightCyan),
    magenta: (value) => wrap(value, ANSI.brightMagenta),
    green: (value) => wrap(value, ANSI.green),
    red: (value) => wrap(value, ANSI.red),
    gray: (value) => wrap(value, ANSI.gray),
    blue: (value) => wrap(value, ANSI.blue),
  };
}

/**
 * @param {string} value
 */
export function stripAnsi(value) {
  return String(value).replace(/\u001b\[[0-9;]*m/g, "");
}
