const PARTICIPANT_PATTERN = /^(participant|actor)\s+([A-Za-z0-9_.:-]+)(?:\s+as\s+(.+))?$/i;
const MESSAGE_PATTERN =
  /^([A-Za-z0-9_.:-]+?)\s*(-->>|->>|-->|->)\s*([A-Za-z0-9_.:-]+)\s*:\s*(.+)$/;
const NOTE_PATTERN = /^note\s+(left of|right of|over)\s+([^:]+?)\s*:\s*(.+)$/i;
const ACTIVATE_PATTERN = /^activate\s+([A-Za-z0-9_.:-]+)$/i;
const DEACTIVATE_PATTERN = /^deactivate\s+([A-Za-z0-9_.:-]+)$/i;
const FRAGMENT_START_PATTERN = /^(alt|opt|loop)\b(?:\s+(.*))?$/i;
const ELSE_PATTERN = /^else\b(?:\s+(.*))?$/i;
const END_PATTERN = /^end$/i;
const TITLE_PATTERN = /^title\s+(.+)$/i;

export function parseSequenceSource(source) {
  const lines = source
    .split(/\r?\n/)
    .map((line, index) => ({
      text: stripComments(line).trim(),
      lineNumber: index + 1
    }))
    .filter((entry) => entry.text);

  const header = lines.shift();

  if (!/^sequenceDiagram\b/i.test(header?.text ?? "")) {
    throw new Error("PPT export currently supports Mermaid flowchart and sequenceDiagram only.");
  }

  const participants = new Map();
  const events = [];
  let title = "";
  let lastTextEvent = null;

  for (const entry of lines) {
    const parsedTitle = parseTitle(entry.text);

    if (parsedTitle !== null) {
      title = parsedTitle;
      lastTextEvent = null;
      continue;
    }

    if (parseParticipant(entry, participants)) {
      lastTextEvent = null;
      continue;
    }

    const messageEvent = parseMessage(entry, participants);

    if (messageEvent) {
      events.push(messageEvent);
      lastTextEvent = messageEvent;
      continue;
    }

    const noteEvent = parseNote(entry, participants);

    if (noteEvent) {
      events.push(noteEvent);
      lastTextEvent = noteEvent;
      continue;
    }

    if (parseActivate(entry, participants, events) || parseDeactivate(entry, participants, events)) {
      lastTextEvent = null;
      continue;
    }

    if (parseFragmentBoundary(entry, events)) {
      lastTextEvent = null;
      continue;
    }

    if (lastTextEvent?.text) {
      lastTextEvent.text = `${lastTextEvent.text}\n${normalizeText(entry.text)}`;
      lastTextEvent.lineEnd = entry.lineNumber;
      continue;
    }

    throw new Error(`Unsupported sequenceDiagram syntax for PPT export: "${entry.text}"`);
  }

  return {
    type: "sequence",
    title,
    participants: Array.from(participants.values()),
    events
  };
}

function parseTitle(line) {
  const match = line.match(TITLE_PATTERN);
  return match ? normalizeText(match[1]) : null;
}

function parseParticipant(entry, participants) {
  const match = entry.text.match(PARTICIPANT_PATTERN);

  if (!match) {
    return false;
  }

  const [, , id, label] = match;
  ensureParticipant(id, participants, label?.trim(), entry.lineNumber);
  return true;
}

function parseMessage(entry, participants) {
  const match = entry.text.match(MESSAGE_PATTERN);

  if (!match) {
    return null;
  }

  const [, fromId, operator, toId, rawText] = match;
  const from = ensureParticipant(fromId, participants);
  const to = ensureParticipant(toId, participants);
  return {
    type: "message",
    from: from.id,
    to: to.id,
    lineStart: entry.lineNumber,
    lineEnd: entry.lineNumber,
    text: normalizeText(rawText),
    arrow: normalizeMessageArrow(operator)
  };
}

function parseNote(entry, participants) {
  const match = entry.text.match(NOTE_PATTERN);

  if (!match) {
    return null;
  }

  const [, placement, rawTargets, rawText] = match;
  const targetIds = rawTargets
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((id) => ensureParticipant(id, participants).id);

  return {
    type: "note",
    placement: placement.toLowerCase(),
    targets: targetIds,
    lineStart: entry.lineNumber,
    lineEnd: entry.lineNumber,
    text: normalizeText(rawText)
  };
}

function parseActivate(entry, participants, events) {
  const match = entry.text.match(ACTIVATE_PATTERN);

  if (!match) {
    return false;
  }

  const participant = ensureParticipant(match[1], participants);
  events.push({
    type: "activate",
    participant: participant.id,
    lineStart: entry.lineNumber,
    lineEnd: entry.lineNumber
  });
  return true;
}

function parseDeactivate(entry, participants, events) {
  const match = entry.text.match(DEACTIVATE_PATTERN);

  if (!match) {
    return false;
  }

  const participant = ensureParticipant(match[1], participants);
  events.push({
    type: "deactivate",
    participant: participant.id,
    lineStart: entry.lineNumber,
    lineEnd: entry.lineNumber
  });
  return true;
}

function parseFragmentBoundary(entry, events) {
  const startMatch = entry.text.match(FRAGMENT_START_PATTERN);

  if (startMatch) {
    const [, kind, title] = startMatch;
    events.push({
      type: "fragment-start",
      kind: kind.toLowerCase(),
      lineStart: entry.lineNumber,
      lineEnd: entry.lineNumber,
      title: normalizeText(title ?? kind)
    });
    return true;
  }

  const elseMatch = entry.text.match(ELSE_PATTERN);

  if (elseMatch) {
    events.push({
      type: "fragment-else",
      lineStart: entry.lineNumber,
      lineEnd: entry.lineNumber,
      title: normalizeText(elseMatch[1] ?? "else")
    });
    return true;
  }

  if (END_PATTERN.test(entry.text)) {
    events.push({
      type: "fragment-end",
      lineStart: entry.lineNumber,
      lineEnd: entry.lineNumber
    });
    return true;
  }

  return false;
}

function ensureParticipant(id, participants, label, lineNumber = null) {
  const existing = participants.get(id);

  if (existing) {
    if (label) {
      existing.text = label;
    }
    if (lineNumber !== null) {
      existing.sourceLines = addSourceLine(existing.sourceLines, lineNumber);
    }
    return existing;
  }

  const participant = {
    id,
    text: label || id,
    sourceLines: lineNumber !== null ? [lineNumber] : []
  };
  participants.set(id, participant);
  return participant;
}

function addSourceLine(lines, lineNumber) {
  if (lineNumber === null) {
    return lines;
  }

  const nextLines = new Set(lines);
  nextLines.add(lineNumber);
  return [...nextLines].sort((left, right) => left - right);
}

function normalizeMessageArrow(operator) {
  return {
    style: operator.includes("--") ? "dash" : "solid",
    endArrow: operator.endsWith(">") ? "triangle" : "none"
  };
}

function stripComments(line) {
  const commentIndex = line.indexOf("%%");
  return commentIndex === -1 ? line : line.slice(0, commentIndex);
}

function normalizeText(value) {
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
