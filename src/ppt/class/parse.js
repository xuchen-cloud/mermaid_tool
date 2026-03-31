const DIRECTION_PATTERN = /^direction\s+([A-Za-z]+)/i;
const CLASS_ID_PATTERN = /[A-Za-z0-9_.:~-]+/;
const RELATION_OPERATOR_PATTERN =
  /<\|--|--\|>|<\|\.\.|\.\.\|>|\*--|--\*|o--|--o|\*\.\.|\.\.\*|o\.\.|\.\.o|-->|<--|\.\.>|<\.\.|--|\.\.|\(\)--|--\(\)/;
const CLASS_WITH_LABEL_PATTERN =
  /^class\s+([A-Za-z0-9_.:~-]+)\s*\[\s*"?([\s\S]*?)"?\s*\]\s*(\{\s*\})?\s*(\{)?\s*$/i;
const CLASS_DECLARATION_PATTERN = /^class\s+(.+?)\s*(\{\s*\})?\s*(\{)?\s*$/i;
const MEMBER_STATEMENT_PATTERN = /^([A-Za-z0-9_.:~-]+)\s*:\s*(.+)$/;
const ANNOTATION_STATEMENT_PATTERN = /^<<([^>]+)>>\s+([A-Za-z0-9_.:~-]+)$/;
const IGNORED_PREFIX_PATTERN = /^(?:note\b|click\b|link\b|style\b|classDef\b|cssClass\b)/i;

export function parseClassSource(source) {
  const lines = source
    .split(/\r?\n/)
    .map((line, index) => ({
      text: stripComments(line).trim(),
      lineNumber: index + 1
    }))
    .filter((entry) => entry.text);

  const header = lines.shift();
  if (!/^classDiagram(?:-v2)?\b/i.test(header?.text ?? "")) {
    throw new Error("PPT export currently supports Mermaid classDiagram diagrams only.");
  }

  const nodes = new Map();
  const edges = [];
  const blockStack = [];
  let direction = "TB";

  for (const entry of lines) {
    const currentBlock = blockStack[blockStack.length - 1] ?? null;

    if (currentBlock?.type === "class") {
      if (/^\}\s*$/.test(entry.text)) {
        blockStack.pop();
        continue;
      }

      addClassMember(nodes, currentBlock.classId, entry.text, entry.lineNumber);
      continue;
    }

    if (currentBlock?.type === "namespace" && /^\}\s*$/.test(entry.text)) {
      blockStack.pop();
      continue;
    }

    const directionMatch = entry.text.match(DIRECTION_PATTERN);
    if (directionMatch) {
      direction = normalizeDirection(directionMatch[1]);
      continue;
    }

    if (parseClassDeclaration(entry, nodes, blockStack)) {
      continue;
    }

    const annotationMatch = entry.text.match(ANNOTATION_STATEMENT_PATTERN);
    if (annotationMatch) {
      const [, annotation, classId] = annotationMatch;
      const node = ensureClass(nodes, classId, entry.lineNumber);
      node.annotations.push(normalizeText(annotation));
      continue;
    }

    if (parseClassRelation(entry, nodes, edges)) {
      continue;
    }

    const memberMatch = entry.text.match(MEMBER_STATEMENT_PATTERN);
    if (memberMatch) {
      addClassMember(nodes, memberMatch[1], memberMatch[2], entry.lineNumber);
      continue;
    }

    if (/^namespace\b/i.test(entry.text) && entry.text.includes("{")) {
      blockStack.push({ type: "namespace" });
      continue;
    }

    if (IGNORED_PREFIX_PATTERN.test(entry.text)) {
      continue;
    }

    throw new Error(`Unsupported classDiagram syntax for PPT export: "${entry.text}"`);
  }

  return {
    type: "class",
    direction,
    nodes: Array.from(nodes.values()),
    edges
  };
}

function parseClassDeclaration(entry, nodes, blockStack) {
  const labeledMatch = entry.text.match(CLASS_WITH_LABEL_PATTERN);
  if (labeledMatch) {
    const [, classId, label, emptyBody, openBody] = labeledMatch;
    const node = ensureClass(nodes, classId, entry.lineNumber);
    node.title = normalizeText(label) || node.title;
    if (openBody && !emptyBody) {
      blockStack.push({ type: "class", classId: node.id });
    }
    return true;
  }

  const declarationMatch = entry.text.match(CLASS_DECLARATION_PATTERN);
  if (!declarationMatch) {
    return false;
  }

  const [, rawBody, emptyBody, openBody] = declarationMatch;
  const classNames = rawBody
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!classNames.length) {
    return false;
  }

  for (const classId of classNames) {
    ensureClass(nodes, classId, entry.lineNumber);
  }

  if (openBody && !emptyBody && classNames.length === 1) {
    blockStack.push({ type: "class", classId: classNames[0] });
  }

  return true;
}

function parseClassRelation(entry, nodes, edges) {
  const operatorMatch = entry.text.match(RELATION_OPERATOR_PATTERN);
  if (!operatorMatch) {
    return false;
  }

  const operator = operatorMatch[0];
  const operatorIndex = entry.text.indexOf(operator);
  const leftSide = entry.text.slice(0, operatorIndex).trim();
  const rightSide = entry.text.slice(operatorIndex + operator.length).trim();

  const leftMatch = leftSide.match(/^([A-Za-z0-9_.:~-]+)\s*(?:"([^"]+)")?\s*$/);
  const rightMatch = rightSide.match(/^(?:"([^"]+)")?\s*([A-Za-z0-9_.:~-]+)(?:\s*:\s*(.+))?$/);

  if (!leftMatch || !rightMatch) {
    return false;
  }

  const [, fromId, startLabel = ""] = leftMatch;
  const [, endLabel = "", toId, edgeLabel = ""] = rightMatch;
  const from = ensureClass(nodes, fromId, entry.lineNumber);
  const to = ensureClass(nodes, toId, entry.lineNumber);
  const arrowStyle = mapClassRelationStyle(operator);

  edges.push({
    id: `edge-${edges.length}`,
    from: from.id,
    to: to.id,
    lineStart: entry.lineNumber,
    lineEnd: entry.lineNumber,
    label: normalizeText(edgeLabel),
    startLabel: normalizeText(startLabel),
    endLabel: normalizeText(endLabel),
    style: arrowStyle
  });

  return true;
}

function mapClassRelationStyle(operator) {
  const dashType = operator.includes("..") ? "dash" : "solid";
  let startArrow = "none";
  let endArrow = "none";

  if (operator.startsWith("<|") || operator === "<--" || operator === "<..") {
    startArrow = "triangle";
  } else if (operator.startsWith("*") || operator.startsWith("o")) {
    startArrow = "diamond";
  } else if (operator.startsWith("()")) {
    startArrow = "oval";
  }

  if (operator.endsWith("|>") || operator === "-->" || operator === "..>") {
    endArrow = "triangle";
  } else if (operator.endsWith("*") || operator.endsWith("o")) {
    endArrow = "diamond";
  } else if (operator.endsWith("()")) {
    endArrow = "oval";
  }

  return {
    dashType,
    startArrow,
    endArrow
  };
}

function addClassMember(nodes, classId, rawMember, lineNumber) {
  const node = ensureClass(nodes, classId, lineNumber);
  const member = normalizeText(rawMember);

  if (!member) {
    return;
  }

  if (member.startsWith("<<") && member.endsWith(">>")) {
    node.annotations.push(member.slice(2, -2).trim());
    return;
  }

  if (member.includes(")")) {
    node.methods.push(member);
    return;
  }

  node.members.push(member);
}

function ensureClass(nodes, id, lineNumber = null) {
  const key = normalizeId(id);
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
    annotations: [],
    members: [],
    methods: [],
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

function normalizeId(value) {
  return normalizeText(value);
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
