const TITLE_PATTERN = /^title\s+(.+)$/i;
const SECTION_PATTERN = /^(.*?)\s*:\s*(-?\d+(?:\.\d+)?)\s*$/;

export function parsePieSource(source) {
  const lines = source
    .split(/\r?\n/)
    .map((line, index) => ({
      text: stripComments(line).trim(),
      lineNumber: index + 1
    }))
    .filter((entry) => entry.text);

  const header = lines.shift();
  const headerMatch = header?.text.match(/^pie(?:\s+(showData))?\b/i);

  if (!headerMatch) {
    throw new Error("PPT export currently supports Mermaid pie diagrams only.");
  }

  const showData = Boolean(headerMatch[1]);
  const sections = [];
  let title = "";

  for (const entry of lines) {
    const titleMatch = entry.text.match(TITLE_PATTERN);
    if (titleMatch) {
      title = normalizeText(titleMatch[1]);
      continue;
    }

    const sectionMatch = entry.text.match(SECTION_PATTERN);
    if (!sectionMatch) {
      throw new Error(`Unsupported pie syntax for PPT export: "${entry.text}"`);
    }

    const value = Number(sectionMatch[2]);
    if (!Number.isFinite(value)) {
      throw new Error(`Pie section value is invalid: "${entry.text}"`);
    }

    sections.push({
      id: `section-${sections.length}`,
      label: normalizeText(sectionMatch[1]),
      value,
      lineStart: entry.lineNumber,
      lineEnd: entry.lineNumber
    });
  }

  if (!sections.length) {
    throw new Error("Pie diagrams require at least one section for PPT export.");
  }

  return {
    type: "pie",
    title,
    showData,
    sections
  };
}

function stripComments(line) {
  const commentIndex = line.indexOf("%%");
  return commentIndex === -1 ? line : line.slice(0, commentIndex);
}

function normalizeText(value) {
  const decoded = value
    .trim()
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  if (decoded.length >= 2) {
    const first = decoded[0];
    const last = decoded[decoded.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return decoded.slice(1, -1).trim();
    }
  }

  return decoded;
}
