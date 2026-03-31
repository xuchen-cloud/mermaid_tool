const DIRECTION_PATTERN = /^direction\s+([A-Za-z]+)/i;
const SINGLE_NOTE_PATTERN = /^note\s+(left of|right of)\s+([^\s]+)\s*:\s*(.+)$/i;
const BLOCK_NOTE_PATTERN = /^note\s+(left of|right of)\s+([^\s]+)\s*$/i;
const STATE_ALIAS_WITH_DESC_PATTERN =
  /^state\s+"([^"]+)"\s+as\s+([^\s{]+)\s*:\s*(.+)$/i;
const STATE_ALIAS_PATTERN =
  /^state\s+"([^"]+)"\s+as\s+([^\s{]+)(?:\s+<<(fork|join|choice)>>)?\s*(\{)?\s*$/i;
const STATE_DECL_WITH_DESC_PATTERN = /^state\s+([^\s{]+)\s*:\s*(.+)$/i;
const STATE_DECL_PATTERN =
  /^state\s+([^\s{]+)(?:\s+<<(fork|join|choice)>>)?\s*(\{)?\s*$/i;
const PLAIN_DESC_PATTERN = /^([^\s:{][^:]*?)\s*:\s*(.+)$/;
const RELATION_PATTERN = /^(.+?)\s*-->\s*(.+?)(?:\s*:\s*(.+))?$/;
const PSEUDO_STATE_TOKEN = "[*]";
const RESERVED_PREFIX_PATTERN = /^(?:classDef\b|class\b|style\b|click\b|stateDiagram\b|stateDiagram-v2\b)/i;

export function parseStateSource(source) {
  const lines = source
    .split(/\r?\n/)
    .map((line, index) => ({
      text: stripComments(line).trim(),
      lineNumber: index + 1
    }))
    .filter((entry) => entry.text);

  const header = lines.shift();
  if (!/^stateDiagram(?:-v2)?\b/i.test(header?.text ?? "")) {
    throw new Error("PPT export currently supports Mermaid stateDiagram diagrams only.");
  }

  const states = new Map();
  const edges = [];
  const notes = [];
  const groupStack = [];
  let direction = "TB";
  let pseudoCounter = 0;
  let noteBlock = null;

  for (const entry of lines) {
    if (noteBlock) {
      if (/^end note$/i.test(entry.text)) {
        notes.push({
          id: `note-${notes.length}`,
          targetId: noteBlock.targetId,
          position: noteBlock.position,
          text: noteBlock.lines.join("\n"),
          lineStart: noteBlock.lineStart,
          lineEnd: entry.lineNumber,
          parentId: noteBlock.parentId
        });
        noteBlock = null;
        continue;
      }

      noteBlock.lines.push(normalizeText(entry.text));
      continue;
    }

    if (/^\}\s*$/.test(entry.text)) {
      const group = groupStack.pop();
      if (group) {
        group.lineEnd = entry.lineNumber;
        group.sourceLines = addSourceLine(group.sourceLines, entry.lineNumber);
      }
      continue;
    }

    const directionMatch = entry.text.match(DIRECTION_PATTERN);
    if (directionMatch) {
      direction = normalizeDirection(directionMatch[1]);
      continue;
    }

    if (/^hide empty description$/i.test(entry.text)) {
      continue;
    }

    const singleNoteMatch = entry.text.match(SINGLE_NOTE_PATTERN);
    if (singleNoteMatch) {
      const [, position, rawTarget, rawText] = singleNoteMatch;
      const target = ensureState(
        states,
        normalizeEndpointToken(rawTarget),
        {
          lineNumber: entry.lineNumber,
          parentId: getCurrentGroupId(groupStack)
        }
      );
      notes.push({
        id: `note-${notes.length}`,
        targetId: target.id,
        position: position.toLowerCase(),
        text: normalizeText(rawText),
        lineStart: entry.lineNumber,
        lineEnd: entry.lineNumber,
        parentId: target.parentId
      });
      continue;
    }

    const blockNoteMatch = entry.text.match(BLOCK_NOTE_PATTERN);
    if (blockNoteMatch) {
      const [, position, rawTarget] = blockNoteMatch;
      const target = ensureState(
        states,
        normalizeEndpointToken(rawTarget),
        {
          lineNumber: entry.lineNumber,
          parentId: getCurrentGroupId(groupStack)
        }
      );
      noteBlock = {
        targetId: target.id,
        position: position.toLowerCase(),
        lineStart: entry.lineNumber,
        parentId: target.parentId,
        lines: []
      };
      continue;
    }

    const stateAliasWithDescMatch = entry.text.match(STATE_ALIAS_WITH_DESC_PATTERN);
    if (stateAliasWithDescMatch) {
      const [, label, id, rawDescription] = stateAliasWithDescMatch;
      const state = ensureState(states, id, {
        label,
        lineNumber: entry.lineNumber,
        parentId: getCurrentGroupId(groupStack)
      });
      addStateDescription(state, rawDescription, entry.lineNumber);
      continue;
    }

    const stateAliasMatch = entry.text.match(STATE_ALIAS_PATTERN);
    if (stateAliasMatch) {
      const [, label, id, specialType = "", openGroup] = stateAliasMatch;
      const state = ensureState(states, id, {
        label,
        type: normalizeSpecialStateType(specialType),
        lineNumber: entry.lineNumber,
        parentId: getCurrentGroupId(groupStack)
      });
      if (openGroup) {
        state.type = "group";
        state.lineStart = entry.lineNumber;
        groupStack.push(state);
      }
      continue;
    }

    const stateDeclWithDescMatch = entry.text.match(STATE_DECL_WITH_DESC_PATTERN);
    if (stateDeclWithDescMatch) {
      const [, id, rawDescription] = stateDeclWithDescMatch;
      const state = ensureState(states, id, {
        lineNumber: entry.lineNumber,
        parentId: getCurrentGroupId(groupStack)
      });
      addStateDescription(state, rawDescription, entry.lineNumber);
      continue;
    }

    const stateDeclMatch = entry.text.match(STATE_DECL_PATTERN);
    if (stateDeclMatch) {
      const [, id, specialType = "", openGroup] = stateDeclMatch;
      const state = ensureState(states, id, {
        type: normalizeSpecialStateType(specialType),
        lineNumber: entry.lineNumber,
        parentId: getCurrentGroupId(groupStack)
      });
      if (openGroup) {
        state.type = "group";
        state.lineStart = entry.lineNumber;
        groupStack.push(state);
      }
      continue;
    }

    const relationMatch = entry.text.match(RELATION_PATTERN);
    if (relationMatch) {
      const [, rawFrom, rawTo, rawLabel = ""] = relationMatch;
      const from = resolveRelationEndpoint(states, rawFrom, entry.lineNumber, groupStack, () => {
        pseudoCounter += 1;
        return pseudoCounter;
      }, "from");
      const to = resolveRelationEndpoint(states, rawTo, entry.lineNumber, groupStack, () => {
        pseudoCounter += 1;
        return pseudoCounter;
      }, "to");

      edges.push({
        id: `edge-${edges.length}`,
        from: from.id,
        to: to.id,
        lineStart: entry.lineNumber,
        lineEnd: entry.lineNumber,
        label: normalizeText(rawLabel),
        style: {
          dashType: "solid",
          startArrow: "none",
          endArrow: "triangle"
        }
      });
      continue;
    }

    const plainDescMatch = entry.text.match(PLAIN_DESC_PATTERN);
    if (plainDescMatch && !entry.text.startsWith("note ")) {
      const [, id, rawDescription] = plainDescMatch;
      const normalizedId = normalizeEndpointToken(id);
      if (!RESERVED_PREFIX_PATTERN.test(normalizedId)) {
        const state = ensureState(states, normalizedId, {
          lineNumber: entry.lineNumber,
          parentId: getCurrentGroupId(groupStack)
        });
        addStateDescription(state, rawDescription, entry.lineNumber);
        continue;
      }
    }

    if (entry.text === "--") {
      continue;
    }

    if (RESERVED_PREFIX_PATTERN.test(entry.text)) {
      continue;
    }

    ensureState(states, normalizeEndpointToken(entry.text), {
      lineNumber: entry.lineNumber,
      parentId: getCurrentGroupId(groupStack)
    });
  }

  return {
    type: "state",
    direction,
    states: Array.from(states.values()),
    notes,
    edges
  };
}

function resolveRelationEndpoint(states, rawToken, lineNumber, groupStack, nextPseudoId, side) {
  const token = normalizeEndpointToken(rawToken);
  if (token === PSEUDO_STATE_TOKEN) {
    const id = `${side === "from" ? "start" : "end"}-${nextPseudoId()}`;
    return ensureState(states, id, {
      label: "",
      type: side === "from" ? "start" : "end",
      lineNumber,
      parentId: getCurrentGroupId(groupStack)
    });
  }

  return ensureState(states, token, {
    lineNumber,
    parentId: getCurrentGroupId(groupStack)
  });
}

function addStateDescription(state, rawDescription, lineNumber) {
  const description = normalizeText(rawDescription);
  if (!description) {
    return;
  }

  state.descriptions.push(description);
  state.sourceLines = addSourceLine(state.sourceLines, lineNumber);
}

function ensureState(states, rawId, options = {}) {
  const id = normalizeEndpointToken(rawId);
  const existing = states.get(id);

  if (existing) {
    if (options.label && !existing.label) {
      existing.label = normalizeText(options.label);
    }
    if (options.type && existing.type === "default") {
      existing.type = options.type;
    }
    if (options.parentId && !existing.parentId) {
      existing.parentId = options.parentId;
    }
    if (options.lineNumber) {
      existing.sourceLines = addSourceLine(existing.sourceLines, options.lineNumber);
    }
    return existing;
  }

  const label = normalizeText(options.label || id);
  const state = {
    id,
    label: options.type === "start" || options.type === "end" ? "" : label,
    type: options.type || "default",
    descriptions: [],
    parentId: options.parentId || null,
    sourceLines: options.lineNumber ? [options.lineNumber] : [],
    lineStart: options.lineNumber ?? null,
    lineEnd: options.lineNumber ?? null
  };
  states.set(id, state);
  return state;
}

function addSourceLine(lines, lineNumber) {
  const nextLines = new Set(lines);
  nextLines.add(lineNumber);
  return [...nextLines].sort((left, right) => left - right);
}

function getCurrentGroupId(groupStack) {
  return groupStack[groupStack.length - 1]?.id ?? null;
}

function normalizeSpecialStateType(value) {
  switch (String(value || "").toLowerCase()) {
    case "choice":
      return "choice";
    case "fork":
      return "fork";
    case "join":
      return "join";
    default:
      return "default";
  }
}

function normalizeEndpointToken(value) {
  return normalizeText(value);
}

function stripComments(line) {
  const commentIndex = line.indexOf("%%");
  return commentIndex === -1 ? line : line.slice(0, commentIndex);
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
