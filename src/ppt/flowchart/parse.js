const EDGE_PATTERN = /^(.*?)\s*(-->|---|-.->)\s*(?:\|([^|]+)\|)?\s*(.*?)$/;
const EDGE_WITH_TEXT_LABEL_PATTERN = /^(.*?)\s*(--|-\.)\s*([^>|-][\s\S]*?)\s*(-->|\.->)\s*(.*?)$/;
const NODE_ID_PATTERN = /^([A-Za-z0-9_:-]+)(.*)$/;

export function parseFlowchartSource(source) {
  const statements = source
    .split(/\r?\n/)
    .flatMap((line, index) => {
      return splitStatements(stripComments(line))
        .map((statement) => statement.trim())
        .filter(Boolean)
        .map((statement) => ({
          text: statement,
          lineStart: index + 1,
          lineEnd: index + 1
        }));
    });

  const header = statements.shift();
  const headerMatch = header?.text.match(/^(flowchart|graph)\s+([A-Za-z]+)/i);

  if (!headerMatch) {
    throw new Error("PPT export currently supports Mermaid flowchart/graph diagrams only.");
  }

  const direction = normalizeDirection(headerMatch[2]);
  const nodes = new Map();
  const edges = [];

  for (const statement of statements) {
    if (parseEdge(statement, nodes, edges)) {
      continue;
    }

    parseStandaloneNode(statement, nodes);
  }

  return {
    type: "flowchart",
    direction,
    nodes: Array.from(nodes.values()),
    edges
  };
}

function parseEdge(statement, nodes, edges) {
  const line = statement.text;
  const textLabelMatch = !line.includes("|") ? line.match(EDGE_WITH_TEXT_LABEL_PATTERN) : null;

  if (textLabelMatch) {
    const [, rawSource, operatorPrefix, rawLabel, operatorSuffix, rawTarget] = textLabelMatch;
    const sourceNode = parseNodeToken(rawSource.trim(), nodes, statement);
    const targetNode = parseNodeToken(rawTarget.trim(), nodes, statement);

    if (!sourceNode || !targetNode) {
      throw new Error(`Unable to parse flowchart edge: "${line}"`);
    }

    const operator = `${operatorPrefix}${operatorSuffix}`;
    edges.push({
      id: `edge-${edges.length}`,
      from: sourceNode.id,
      to: targetNode.id,
      lineStart: statement.lineStart,
      lineEnd: statement.lineEnd,
      label: normalizeText(rawLabel.trim()),
      style: {
        dashType: operator.includes(".") ? "dash" : "solid",
        endArrow: operator.endsWith(">") ? "triangle" : "none"
      }
    });

    return true;
  }

  const match = line.match(EDGE_PATTERN);

  if (!match) {
    return false;
  }

  const [, rawSource, operator, rawLabel, rawTarget] = match;
  const sourceNode = parseNodeToken(rawSource.trim(), nodes, statement);
  const targetNode = parseNodeToken(rawTarget.trim(), nodes, statement);

  if (!sourceNode || !targetNode) {
    throw new Error(`Unable to parse flowchart edge: "${line}"`);
  }

  edges.push({
    id: `edge-${edges.length}`,
    from: sourceNode.id,
    to: targetNode.id,
    lineStart: statement.lineStart,
    lineEnd: statement.lineEnd,
    label: normalizeText(rawLabel?.trim() ?? ""),
    style: {
      dashType: operator === "-.->" ? "dash" : "solid",
      endArrow: operator.endsWith(">") ? "triangle" : "none"
    }
  });

  return true;
}

function parseStandaloneNode(statement, nodes) {
  const node = parseNodeToken(statement.text, nodes, statement);

  if (!node) {
    throw new Error(`Unsupported flowchart syntax for PPT export: "${statement.text}"`);
  }
}

function parseNodeToken(token, nodes, statement) {
  if (!token) {
    return null;
  }

  const match = token.match(NODE_ID_PATTERN);

  if (!match) {
    return null;
  }

  const [, id, remainder] = match;
  const descriptor = remainder.trim();
  const parsed = parseNodeDescriptor(descriptor);
  const existing = nodes.get(id);
  const nextNode = {
    id,
    text: parsed.text || existing?.text || id,
    shape: parsed.shape || existing?.shape || "rect",
    sourceLines: mergeSourceLines(existing?.sourceLines, statement)
  };

  nodes.set(id, nextNode);
  return nextNode;
}

function mergeSourceLines(existingLines = [], statement) {
  if (!statement?.lineStart) {
    return existingLines;
  }

  const nextLines = new Set(existingLines);
  for (let line = statement.lineStart; line <= statement.lineEnd; line += 1) {
    nextLines.add(line);
  }
  return [...nextLines].sort((left, right) => left - right);
}

function parseNodeDescriptor(descriptor) {
  if (!descriptor) {
    return {};
  }

  if (descriptor.startsWith("[") && descriptor.endsWith("]")) {
    return { text: normalizeNodeText(descriptor.slice(1, -1)), shape: "rect" };
  }

  if (descriptor.startsWith("{") && descriptor.endsWith("}")) {
    return { text: normalizeNodeText(descriptor.slice(1, -1)), shape: "diamond" };
  }

  if (descriptor.startsWith("((") && descriptor.endsWith("))")) {
    return { text: normalizeNodeText(descriptor.slice(2, -2)), shape: "ellipse" };
  }

  if (descriptor.startsWith("(") && descriptor.endsWith(")")) {
    return { text: normalizeNodeText(descriptor.slice(1, -1)), shape: "roundRect" };
  }

  return { text: normalizeNodeText(descriptor) };
}

function normalizeDirection(direction) {
  const normalized = direction.toUpperCase();

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

function splitStatements(line) {
  const parts = [];
  let current = "";
  let entityDepth = 0;

  for (const char of line) {
    if (char === "&") {
      entityDepth += 1;
    }

    if (char === ";" && entityDepth === 0) {
      parts.push(current);
      current = "";
      continue;
    }

    current += char;

    if (char === ";" && entityDepth > 0) {
      entityDepth = 0;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function normalizeNodeText(value) {
  return normalizeText(value);
}

function normalizeText(value) {
  return stripWrappingQuotes(
    decodeEntities(value.trim())
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/\\n/g, "\n")
  );
}

function decodeEntities(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripWrappingQuotes(value) {
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];

  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1).trim();
  }

  return value;
}
