import { padLeft, padRight, stringDisplayWidth } from "./width.js";

/**
 * @typedef {object} TableColumn
 * @property {string} key
 * @property {string} header
 * @property {"left" | "right"} [align]
 * @property {(text: string, color: ReturnType<import("./color.js").createColor>) => string} [paint]
 */

/**
 * @param {TableColumn[]} columns
 * @param {Record<string, string>[]} rows
 * @param {{ terminalColumns?: number, color?: ReturnType<import("./color.js").createColor>, fitKey?: string }} [opts]
 */
export function formatBoxTable(columns, rows, opts = {}) {
  const fitKey = opts.fitKey || "commit";
  /** @type {Record<string, number>} */
  const widths = {};
  for (const col of columns) {
    widths[col.key] = stringDisplayWidth(col.header);
    for (const row of rows) {
      widths[col.key] = Math.max(widths[col.key], stringDisplayWidth(row[col.key] ?? ""));
    }
  }

  const terminalColumns = Number.isFinite(opts.terminalColumns)
    ? Number(opts.terminalColumns)
    : 0;
  if (terminalColumns > 0 && columns.some((c) => c.key === fitKey)) {
    const other = columns.filter((c) => c.key !== fitKey).reduce((sum, c) => sum + widths[c.key], 0);
    const frame = 3 * columns.length + 1;
    const available = terminalColumns - other - frame;
    if (available >= 20) {
      widths[fitKey] = Math.min(widths[fitKey], available);
    }
  }

  const border = `+${columns.map((c) => "-".repeat(widths[c.key] + 2)).join("+")}+`;

  /**
   * @param {Record<string, string>} values
   * @param {boolean} paint
   */
  const buildRow = (values, paint) => {
    const cells = columns.map((col) => {
      const raw = values[col.key] ?? "";
      const padded =
        col.align === "right"
          ? padLeft(raw, widths[col.key])
          : padRight(raw, widths[col.key]);
      if (paint && col.paint && opts.color) {
        return col.paint(padded, opts.color);
      }
      return padded;
    });
    return `| ${cells.join(" | ")} |`;
  };

  const headerValues = Object.fromEntries(columns.map((c) => [c.key, c.header]));
  const lines = [border, buildRow(headerValues, false), border];
  for (const row of rows) {
    lines.push(buildRow(row, true));
  }
  lines.push(border);
  return lines;
}

/**
 * @param {string[]} parts
 * @param {ReturnType<import("./color.js").createColor>} color
 * @param {number} terminalColumns
 */
export function formatHeading(parts, color, terminalColumns) {
  const labeled = parts.filter((p) => p != null && p !== "");
  const plain = labeled.join("    ");
  const colored = labeled
    .map((part, i) => (i === 0 ? color.heading(part) : color.headingRight(part)))
    .join("    ");
  const width = terminalColumns > 0 ? terminalColumns : Math.max(plain.length, 40);
  const rule = color.gray("─".repeat(width));
  return ["", colored, rule].join("\n");
}
