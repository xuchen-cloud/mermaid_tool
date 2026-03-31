const DIRECTION_PATTERN = /^direction\s+([A-Za-z]+)/i;
const ENTITY_START_PATTERN = /^([A-Za-z0-9_.:-]+)\s*\{\s*$/;
const RELATIONSHIP_PATTERN =
  /^([A-Za-z0-9_.:-]+)\s+(\|\||\|o|o\||o\{|\|\{|\}\||\}o)\s*(--|\.\.|-\.|\.-)\s*(\|\||\|o|o\||o\{|\|\{|\}\||\}o)\s+([A-Za-z0-9_.:-]+)(?:\s*:\s*(.+))?$/;
const ATTRIBUTE_PATTERN =
  /^([^\s]+)\s+([^\s]+)(?:\s+((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*))?(?:\s+"([^"]+)")?$/i;
const IGNORED_PREFIX_PATTERN = /^(?:style\b|classDef\b|class\b)/i;

export function parseErSource(source) {
  const lines = source
    .split(/\r?\n/)
    .map((line, index) => ({
      text: stripComments(line).trim(),
      lineNumber: index + 1
    }))
    .filter((entry) => entry.text);

  const header = lines.shift();
  if (!/^erDiagram\b/i.test(header?.text ?? "")) {
    throw new Error("PPT export currently supports Mermaid erDiagram diagrams only.");
  }

  const nodes = new Map();
  const edges = [];
  let direction = "TB";
  let currentEntityId = null;

  for (const entry of lines) {
    if (currentEntityId) {
      if (/^\}\s*$/.test(entry.text)) {
        currentEntityId = null;
        continue;
      }

      const attribute = parseAttribute(entry.text);
      if (!attribute) {
        throw new Error(`Unsupported erDiagram attribute syntax for PPT export: "${entry.text}"`);
      }

      const entity = ensureEntity(nodes, currentEntityId, entry.lineNumber);
      entity.attributes.push({
        ...attribute,
        lineStart: entry.lineNumber,
        lineEnd: entry.lineNumber
      });
      continue;
    }

    const directionMatch = entry.text.match(DIRECTION_PATTERN);
    if (directionMatch) {
      direction = normalizeDirection(directionMatch[1]);
      continue;
    }

    const entityStartMatch = entry.text.match(ENTITY_START_PATTERN);
    if (entityStartMatch) {
      currentEntityId = entityStartMatch[1];
      ensureEntity(nodes, currentEntityId, entry.lineNumber);
      continue;
    }

    const relationshipMatch = entry.text.match(RELATIONSHIP_PATTERN);
    if (relationshipMatch) {
      const [, fromId, fromCardinality, connector, toCardinality, toId, label = ""] =
        relationshipMatch;
      const from = ensureEntity(nodes, fromId, entry.lineNumber);
      const to = ensureEntity(nodes, toId, entry.lineNumber);

      edges.push({
        id: `edge-${edges.length}`,
        from: from.id,
        to: to.id,
        lineStart: entry.lineNumber,
        lineEnd: entry.lineNumber,
        label: normalizeText(label),
        startLabel: formatErCardinality(fromCardinality),
        endLabel: formatErCardinality(toCardinality),
        style: {
          dashType: connector.includes(".") ? "dash" : "solid",
          startArrow: "none",
          endArrow: "none"
        }
      });
      continue;
    }

    if (IGNORED_PREFIX_PATTERN.test(entry.text)) {
      continue;
    }

    ensureEntity(nodes, entry.text, entry.lineNumber);
  }

  return {
    type: "er",
    direction,
    nodes: Array.from(nodes.values()),
    edges
  };
}

function parseAttribute(text) {
  const match = text.match(ATTRIBUTE_PATTERN);
  if (!match) {
    return null;
  }

  const [, type, name, rawKeys = "", comment = ""] = match;
  return {
    type: normalizeText(type),
    name: normalizeText(name),
    keys: rawKeys
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
    comment: normalizeText(comment)
  };
}

function ensureEntity(nodes, id, lineNumber = null) {
  const key = normalizeText(id);
  const existing = nodes.get(key);

  if (existing) {
    if (lineNumber !== null) {
      existing.sourceLines = addSourceLine(existing.sourceLines, lineNumber);
    }
    return existing;
  }

  const node = {
    id: key,
    title: key,
    attributes: [],
    sourceLines: lineNumber !== null ? [lineNumber] : []
  };
  nodes.set(key, node);
  return node;
}

function addSourceLine(lines, lineNumber) {
  const next = new Set(lines);
  next.add(lineNumber);
  return [...next].sort((left, right) => left - right);
}

function formatErCardinality(token) {
  switch (token) {
    case "||":
      return "1";
    case "|o":
    case "o|":
      return "0..1";
    case "|{":
    case "}|":
      return "1..*";
    case "o{":
    case "}o":
      return "0..*";
    default:
      return token;
  }
}

function normalizeDirection(direction) {
  const normalized = String(direction || "").toUpperCase();

  if (normalized === "TD") {
    return "TB";
  }

  if (!["TB", "BT", "LR", "RL"].includes(normalized)) {
    return "TB";
  }

  return normalized;
}

function stripComments(line) {
  const commentIndex = line.indexOf("%%");
  return commentIndex === -1 ? line : line.slice(0, commentIndex);
}

function normalizeText(value) {
  const decoded = String(value || "")
    .trim()
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\\n/g, "\n");

  if (decoded.length >= 2) {
    const first = decoded[0];
    const last = decoded[decoded.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return decoded.slice(1, -1).trim();
    }
  }

  return decoded;
}
