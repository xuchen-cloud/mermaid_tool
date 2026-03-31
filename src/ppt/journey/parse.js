const TITLE_PATTERN = /^title\s+(.+)$/i;
const SECTION_PATTERN = /^section\s+(.+)$/i;
const TASK_PATTERN = /^(.*?)\s*:\s*([0-5])(?:\s*:\s*(.*))?$/;

export function parseJourneySource(source) {
  const lines = source
    .split(/\r?\n/)
    .map((line, index) => ({
      text: stripComments(line).trim(),
      lineNumber: index + 1
    }))
    .filter((entry) => entry.text);

  const header = lines.shift();
  if (!/^journey\b/i.test(header?.text ?? "")) {
    throw new Error("PPT export currently supports Mermaid journey diagrams only.");
  }

  const sections = [];
  const tasks = [];
  let title = "";
  let currentSection = null;

  for (const entry of lines) {
    const titleMatch = entry.text.match(TITLE_PATTERN);
    if (titleMatch) {
      title = normalizeText(titleMatch[1]);
      continue;
    }

    const sectionMatch = entry.text.match(SECTION_PATTERN);
    if (sectionMatch) {
      currentSection = {
        id: `section-${sections.length}`,
        text: normalizeText(sectionMatch[1]),
        sourceLines: [entry.lineNumber]
      };
      sections.push(currentSection);
      continue;
    }

    const taskMatch = entry.text.match(TASK_PATTERN);
    if (!taskMatch) {
      throw new Error(`Unsupported journey syntax for PPT export: "${entry.text}"`);
    }

    if (!currentSection) {
      currentSection = {
        id: `section-${sections.length}`,
        text: "Tasks",
        sourceLines: []
      };
      sections.push(currentSection);
    }

    const people = String(taskMatch[3] ?? "")
      .split(",")
      .map((value) => normalizeText(value))
      .filter(Boolean);

    tasks.push({
      id: `task-${tasks.length}`,
      sectionId: currentSection.id,
      text: normalizeText(taskMatch[1]),
      score: Number(taskMatch[2]),
      people,
      lineStart: entry.lineNumber,
      lineEnd: entry.lineNumber
    });
  }

  if (!tasks.length) {
    throw new Error("Journey diagrams require at least one task for PPT export.");
  }

  return {
    type: "journey",
    title,
    sections,
    tasks
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
