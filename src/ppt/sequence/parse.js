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
    .map(stripComments)
    .map((line) => line.trim())
    .filter(Boolean);

  const header = lines.shift();

  if (!/^sequenceDiagram\b/i.test(header ?? "")) {
    throw new Error("PPT export currently supports Mermaid flowchart and sequenceDiagram only.");
  }

  const participants = new Map();
  const events = [];
  let title = "";
  let lastTextEvent = null;

  for (const line of lines) {
    const parsedTitle = parseTitle(line);

    if (parsedTitle !== null) {
      title = parsedTitle;
      lastTextEvent = null;
      continue;
    }

    if (parseParticipant(line, participants)) {
      lastTextEvent = null;
      continue;
    }

    const messageEvent = parseMessage(line, participants);

    if (messageEvent) {
      events.push(messageEvent);
      lastTextEvent = messageEvent;
      continue;
    }

    const noteEvent = parseNote(line, participants);

    if (noteEvent) {
      events.push(noteEvent);
      lastTextEvent = noteEvent;
      continue;
    }

    if (parseActivate(line, participants, events) || parseDeactivate(line, participants, events)) {
      lastTextEvent = null;
      continue;
    }

    if (parseFragmentBoundary(line, events)) {
      lastTextEvent = null;
      continue;
    }

    if (lastTextEvent?.text) {
      lastTextEvent.text = `${lastTextEvent.text}\n${normalizeText(line)}`;
      continue;
    }

    throw new Error(`Unsupported sequenceDiagram syntax for PPT export: "${line}"`);
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

function parseParticipant(line, participants) {
  const match = line.match(PARTICIPANT_PATTERN);

  if (!match) {
    return false;
  }

  const [, , id, label] = match;
  ensureParticipant(id, participants, label?.trim());
  return true;
}

function parseMessage(line, participants, events) {
  const match = line.match(MESSAGE_PATTERN);

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
    text: normalizeText(rawText),
    arrow: normalizeMessageArrow(operator)
  };
}

function parseNote(line, participants) {
  const match = line.match(NOTE_PATTERN);

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
    text: normalizeText(rawText)
  };
}

function parseActivate(line, participants, events) {
  const match = line.match(ACTIVATE_PATTERN);

  if (!match) {
    return false;
  }

  const participant = ensureParticipant(match[1], participants);
  events.push({
    type: "activate",
    participant: participant.id
  });
  return true;
}

function parseDeactivate(line, participants, events) {
  const match = line.match(DEACTIVATE_PATTERN);

  if (!match) {
    return false;
  }

  const participant = ensureParticipant(match[1], participants);
  events.push({
    type: "deactivate",
    participant: participant.id
  });
  return true;
}

function parseFragmentBoundary(line, events) {
  const startMatch = line.match(FRAGMENT_START_PATTERN);

  if (startMatch) {
    const [, kind, title] = startMatch;
    events.push({
      type: "fragment-start",
      kind: kind.toLowerCase(),
      title: normalizeText(title ?? kind)
    });
    return true;
  }

  const elseMatch = line.match(ELSE_PATTERN);

  if (elseMatch) {
    events.push({
      type: "fragment-else",
      title: normalizeText(elseMatch[1] ?? "else")
    });
    return true;
  }

  if (END_PATTERN.test(line)) {
    events.push({ type: "fragment-end" });
    return true;
  }

  return false;
}

function ensureParticipant(id, participants, label) {
  const existing = participants.get(id);

  if (existing) {
    if (label) {
      existing.text = label;
    }
    return existing;
  }

  const participant = {
    id,
    text: label || id
  };
  participants.set(id, participant);
  return participant;
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
