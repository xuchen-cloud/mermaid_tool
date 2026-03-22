const EDGE_PATTERN = /^(.*?)\s*(-->|---|-.->)\s*(?:\|([^|]+)\|)?\s*(.*?)$/;
const NODE_ID_PATTERN = /^([A-Za-z0-9_:-]+)(.*)$/;

export function parseFlowchartSource(source) {
  const lines = source
    .split(/\r?\n/)
    .map(stripComments)
    .flatMap(splitStatements)
    .map((line) => line.trim())
    .filter(Boolean);

  const header = lines.shift();
  const headerMatch = header?.match(/^(flowchart|graph)\s+([A-Za-z]+)/i);

  if (!headerMatch) {
    throw new Error("PPT export currently supports Mermaid flowchart/graph diagrams only.");
  }

  const direction = normalizeDirection(headerMatch[2]);
  const nodes = new Map();
  const edges = [];

  for (const line of lines) {
    if (parseEdge(line, nodes, edges)) {
      continue;
    }

    parseStandaloneNode(line, nodes);
  }

  return {
    type: "flowchart",
    direction,
    nodes: Array.from(nodes.values()),
    edges
  };
}

function parseEdge(line, nodes, edges) {
  const match = line.match(EDGE_PATTERN);

  if (!match) {
    return false;
  }

  const [, rawSource, operator, rawLabel, rawTarget] = match;
  const sourceNode = parseNodeToken(rawSource.trim(), nodes);
  const targetNode = parseNodeToken(rawTarget.trim(), nodes);

  if (!sourceNode || !targetNode) {
    throw new Error(`Unable to parse flowchart edge: "${line}"`);
  }

  edges.push({
    id: `edge-${edges.length}`,
    from: sourceNode.id,
    to: targetNode.id,
    label: rawLabel?.trim() ?? "",
    style: {
      dashType: operator === "-.->" ? "dash" : "solid",
      endArrow: operator.endsWith(">") ? "triangle" : "none"
    }
  });

  return true;
}

function parseStandaloneNode(line, nodes) {
  const node = parseNodeToken(line, nodes);

  if (!node) {
    throw new Error(`Unsupported flowchart syntax for PPT export: "${line}"`);
  }
}

function parseNodeToken(token, nodes) {
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
    shape: parsed.shape || existing?.shape || "rect"
  };

  nodes.set(id, nextNode);
  return nextNode;
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
  return decodeEntities(value.trim()).replace(/\\n/g, "\n");
}

function decodeEntities(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
