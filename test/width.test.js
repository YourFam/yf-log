import assert from "node:assert/strict";
import { test } from "node:test";
import { stringDisplayWidth, truncateToWidth } from "../src/width.js";
import { formatBoxTable } from "../src/table.js";
import { createColor } from "../src/color.js";

test("emoji and CJK use display width 2", () => {
  assert.equal(stringDisplayWidth("✨"), 2);
  assert.equal(stringDisplayWidth("字"), 2);
  assert.equal(stringDisplayWidth("abc"), 3);
});

test("truncate keeps ellipsis and does not split wide chars past width", () => {
  const text = "hello ✨ world";
  const out = truncateToWidth(text, 10);
  assert.ok(stringDisplayWidth(out) <= 10);
  assert.ok(out.endsWith("..."));
});

test("table fits commit column to terminal width", () => {
  const color = createColor({ isTTY: false, env: { NO_COLOR: "1" } });
  const lines = formatBoxTable(
    [
      { key: "sno", header: "#" },
      { key: "commit", header: "Commit" },
    ],
    [{ sno: "1", commit: "x".repeat(80) }],
    { terminalColumns: 40, color, fitKey: "commit" },
  );
  for (const line of lines) {
    assert.ok(line.length <= 40, line);
  }
  assert.ok(lines.some((l) => l.includes("...")));
});
