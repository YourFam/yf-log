export function charDisplayWidth(char) {
  const codePoint = char.codePointAt(0) ?? 0;

  if (codePoint === 0) {
    return 0;
  }

  if (
    codePoint < 32 ||
    (codePoint >= 0x7f && codePoint < 0xa0) ||
    /\p{Mark}/u.test(char)
  ) {
    return 0;
  }

  if (/\p{Extended_Pictographic}/u.test(char)) {
    return 2;
  }

  if (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2329 && codePoint <= 0x232a) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6)
  ) {
    return 2;
  }

  return 1;
}

export function stringDisplayWidth(value) {
  const text = String(value);
  let width = 0;
  for (const char of Array.from(text)) {
    width += charDisplayWidth(char);
  }
  return width;
}

export function truncateToWidth(value, width) {
  const text = String(value);
  if (stringDisplayWidth(text) <= width) {
    return text;
  }

  if (width <= 3) {
    return "";
  }

  const ellipsis = "...";
  const targetWidth = width - ellipsis.length;
  let currentWidth = 0;
  let result = "";

  for (const char of Array.from(text)) {
    const charWidth = charDisplayWidth(char);
    if (currentWidth + charWidth > targetWidth) {
      break;
    }
    result += char;
    currentWidth += charWidth;
  }

  return `${result}${ellipsis}`;
}

export function padRight(value, width) {
  const text = truncateToWidth(value, width);
  const displayWidth = stringDisplayWidth(text);
  if (displayWidth >= width) {
    return text;
  }
  return text + " ".repeat(width - displayWidth);
}

export function padLeft(value, width) {
  const text = String(value);
  const displayWidth = stringDisplayWidth(text);
  if (displayWidth >= width) {
    return text;
  }
  return " ".repeat(width - displayWidth) + text;
}
