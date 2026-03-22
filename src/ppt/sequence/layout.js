const HEADER_STYLE = {
  fill: "ECECFF",
  stroke: "9370DB",
  strokeWidth: 1.2,
  textColor: "333333",
  fontSize: 18,
  fontFamily: "Trebuchet MS"
};

const LIFELINE_STYLE = {
  stroke: "666666",
  strokeWidth: 1.1,
  dashType: "dash"
};

const MESSAGE_STYLE = {
  stroke: "333333",
  strokeWidth: 1.5,
  textColor: "333333",
  fontSize: 14,
  fontFamily: "Trebuchet MS"
};

const NOTE_STYLE = {
  fill: "FFF8C4",
  stroke: "C3B260",
  strokeWidth: 1,
  textColor: "333333",
  fontSize: 14,
  fontFamily: "Trebuchet MS"
};

const ACTIVATION_STYLE = {
  fill: "DDD9FF",
  stroke: "9370DB",
  strokeWidth: 1
};

const FRAGMENT_STYLE = {
  stroke: "9A9A9A",
  strokeWidth: 1.1,
  textColor: "333333",
  fontSize: 13,
  fontFamily: "Trebuchet MS",
  fill: "FFFFFF"
};

const TOP_PADDING = 20;
const SIDE_PADDING = 24;
const HEADER_HEIGHT = 42;
const PARTICIPANT_GAP = 88;
const EVENT_GAP = 44;
const NOTE_GAP = 18;
const MESSAGE_LABEL_GAP = 20;
const ACTIVATION_WIDTH = 14;
const TITLE_HEIGHT = 30;
const TITLE_GAP = 14;

export function layoutSequence(parsed, theme = {}) {
  const styles = createSequenceStyles(theme);
  const titleOffset = parsed.title ? TITLE_HEIGHT + TITLE_GAP : 0;
  const participants = layoutParticipants(parsed.participants, styles.header, titleOffset);
  const participantMap = new Map(participants.map((participant) => [participant.id, participant]));
  const lifelineTop = TOP_PADDING + titleOffset + HEADER_HEIGHT;
  const fragments = [];
  const notes = [];
  const messages = [];
  const activations = [];
  const activationStacks = new Map(parsed.participants.map((participant) => [participant.id, []]));
  const fragmentStack = [];

  let cursorY = lifelineTop + 36;

  for (const event of parsed.events) {
    switch (event.type) {
      case "message": {
        const message = placeMessage(event, participantMap, cursorY, styles.message);
        message.label.style = { ...styles.message };
        message.style = {
          ...styles.message,
          dashType: event.arrow.style,
          endArrow: event.arrow.endArrow
        };
        messages.push(message);
        cursorY += message.height + EVENT_GAP;
        break;
      }
      case "note": {
        const note = placeNote(event, participantMap, cursorY, styles.note);
        note.style = { ...styles.note };
        notes.push(note);
        cursorY += note.height + NOTE_GAP;
        break;
      }
      case "activate": {
        const stack = activationStacks.get(event.participant);
        stack?.push(Math.max(lifelineTop + 10, cursorY - 14));
        break;
      }
      case "deactivate": {
        closeActivation(event.participant, cursorY, activationStacks, participantMap, activations);
        break;
      }
      case "fragment-start": {
        fragmentStack.push({
          kind: event.kind,
          title: event.title,
          top: Math.max(lifelineTop + 8, cursorY - 18),
          branchSeparators: []
        });
        cursorY += 8;
        break;
      }
      case "fragment-else": {
        const fragment = fragmentStack[fragmentStack.length - 1];
        if (fragment) {
          fragment.branchSeparators.push({
            y: Math.max(lifelineTop + 14, cursorY - 10),
            title: event.title
          });
        }
        cursorY += 8;
        break;
      }
      case "fragment-end": {
        const fragment = fragmentStack.pop();
        if (fragment) {
          fragments.push({
            id: `fragment-${fragments.length}`,
            kind: fragment.kind,
            title: fragment.title,
            x: participants[0].centerX - participants[0].width / 2 - 18,
            y: fragment.top,
            width:
              participants[participants.length - 1].centerX +
              participants[participants.length - 1].width / 2 -
              (participants[0].centerX - participants[0].width / 2) +
              36,
            height: Math.max(54, cursorY - fragment.top + 8),
            branchSeparators: fragment.branchSeparators,
            style: { ...styles.fragment }
          });
        }
        cursorY += 6;
        break;
      }
      default:
        break;
    }
  }

  for (const participant of participants) {
    const stack = activationStacks.get(participant.id) ?? [];
    while (stack.length > 0) {
      const startY = stack.pop();
      activations.push(buildActivation(participant, startY, cursorY, styles.activation));
    }
  }

  const lifelineBottom = Math.max(
    cursorY + 20,
    ...activations.map((activation) => activation.y + activation.height + 10),
    ...notes.map((note) => note.y + note.height + 10),
    ...fragments.map((fragment) => fragment.y + fragment.height + 10)
  );

  const lifelines = participants.map((participant) => ({
    id: `lifeline-${participant.id}`,
    x: participant.centerX,
    y1: lifelineTop,
    y2: lifelineBottom,
    style: { ...styles.lifeline }
  }));

  return {
    type: "sequence",
    title: parsed.title
      ? {
          text: parsed.title,
          x: SIDE_PADDING,
          y: TOP_PADDING,
          width:
            participants[participants.length - 1].centerX +
            participants[participants.length - 1].width / 2 -
            participants[0].x,
          height: TITLE_HEIGHT,
          style: {
            textColor: styles.header.textColor,
            fontSize: styles.header.fontSize + 2,
            fontFamily: styles.header.fontFamily
          }
        }
      : null,
    theme: {
      canvas: {
        background: styles.canvas.background
      }
    },
    participants,
    lifelines,
    messages,
    activations,
    notes,
    fragments,
    canvas: {
      width: participants[participants.length - 1].centerX + participants[participants.length - 1].width / 2 + SIDE_PADDING,
      height: lifelineBottom + SIDE_PADDING
    }
  };
}

function layoutParticipants(sourceParticipants, headerStyle, titleOffset = 0) {
  const participants = [];
  let cursorX = SIDE_PADDING;

  for (const source of sourceParticipants) {
    const width = Math.max(112, estimateTextWidth(source.text, headerStyle.fontSize) + 30);
    const participant = {
      ...source,
      x: cursorX,
      y: TOP_PADDING + titleOffset,
      width,
      height: HEADER_HEIGHT,
      centerX: cursorX + width / 2,
      style: { ...headerStyle }
    };

    participants.push(participant);
    cursorX += width + PARTICIPANT_GAP;
  }

  return participants;
}

function placeMessage(event, participantMap, y, messageStyle) {
  const from = participantMap.get(event.from);
  const to = participantMap.get(event.to);
  const isSelf = event.from === event.to;
  const labelWidth = Math.max(44, estimateTextWidth(event.text, messageStyle.fontSize) + 10);
  const labelHeight = measureTextBlockHeight(event.text, messageStyle.fontSize, 1.15);

  if (isSelf) {
    const loopWidth = 42;
    const loopHeight = 28;
    const x = from.centerX;

    return {
      id: `message-${event.from}-${event.to}-${y}`,
      type: "self",
      text: event.text,
      points: [
        { x, y },
        { x: x + loopWidth, y },
        { x: x + loopWidth, y: y + loopHeight },
        { x, y: y + loopHeight }
      ],
      label: {
        text: event.text,
        x: x + 8,
        y: y - labelHeight - 4,
        width: labelWidth,
        height: labelHeight,
        style: { ...messageStyle }
      },
      height: loopHeight + labelHeight,
      style: {
        ...messageStyle,
        dashType: event.arrow.style,
        endArrow: event.arrow.endArrow
      }
    };
  }

  const startX = from.centerX;
  const endX = to.centerX;
  const midX = (startX + endX) / 2;

  return {
    id: `message-${event.from}-${event.to}-${y}`,
    type: "message",
    text: event.text,
    points: [
      { x: startX, y },
      { x: endX, y }
    ],
    label: {
      text: event.text,
      x: midX - labelWidth / 2,
      y: y - MESSAGE_LABEL_GAP,
      width: labelWidth,
      height: labelHeight,
      style: { ...messageStyle }
    },
    height: Math.max(20, labelHeight + 4),
    style: {
      ...messageStyle,
      dashType: event.arrow.style,
      endArrow: event.arrow.endArrow
    }
  };
}

function placeNote(event, participantMap, y, noteStyle) {
  const lines = event.text.split(/\n+/).filter(Boolean);
  const width =
    Math.max(...lines.map((line) => estimateTextWidth(line, noteStyle.fontSize)), 42) + 20;
  const height = measureTextBlockHeight(event.text, noteStyle.fontSize, 1.18) + 10;

  let x = SIDE_PADDING;

  if (event.placement === "left of") {
    const target = participantMap.get(event.targets[0]);
    x = target.centerX - width - 26;
  } else if (event.placement === "right of") {
    const target = participantMap.get(event.targets[0]);
    x = target.centerX + 26;
  } else {
    const targets = event.targets.map((id) => participantMap.get(id)).filter(Boolean);
    const centers = targets.map((target) => target.centerX);
    const minX = Math.min(...centers);
    const maxX = Math.max(...centers);
    x = (minX + maxX) / 2 - width / 2;
  }

  return {
    id: `note-${y}`,
    text: event.text,
    x,
    y,
    width,
    height,
    style: { ...noteStyle }
  };
}

function closeActivation(participantId, cursorY, activationStacks, participantMap, activations) {
  const stack = activationStacks.get(participantId);

  if (!stack?.length) {
    return;
  }

  const startY = stack.pop();
  const participant = participantMap.get(participantId);
  activations.push(buildActivation(participant, startY, cursorY));
}

function buildActivation(participant, startY, cursorY, activationStyle = ACTIVATION_STYLE) {
  return {
    id: `activation-${participant.id}-${startY}`,
    participant: participant.id,
    x: participant.centerX - ACTIVATION_WIDTH / 2,
    y: startY,
    width: ACTIVATION_WIDTH,
    height: Math.max(24, cursorY - startY),
    style: { ...activationStyle }
  };
}

function measureTextBlockHeight(text, fontSize, lineHeight) {
  const lines = text.split(/\n+/).filter(Boolean).length || 1;
  return lines * fontSize * lineHeight;
}

function estimateTextWidth(text, fontSize) {
  let units = 0;

  for (const char of text) {
    if (/\s/.test(char)) {
      units += 0.35;
      continue;
    }

    if (/[\u3400-\u9FFF\uF900-\uFAFF]/.test(char)) {
      units += 1;
      continue;
    }

    if (/[A-Z0-9]/.test(char)) {
      units += 0.72;
      continue;
    }

    if (/[a-z]/.test(char)) {
      units += 0.58;
      continue;
    }

    units += 0.62;
  }

  return units * fontSize;
}

function createSequenceStyles(theme) {
  return {
    canvas: {
      background: theme.canvas?.background || "FFFFFF"
    },
    header: {
      ...HEADER_STYLE,
      ...(theme.header || {})
    },
    lifeline: {
      ...LIFELINE_STYLE,
      ...(theme.lifeline || {})
    },
    message: {
      ...MESSAGE_STYLE,
      ...(theme.message || {})
    },
    note: {
      ...NOTE_STYLE,
      ...(theme.note || {})
    },
    activation: {
      ...ACTIVATION_STYLE,
      ...(theme.activation || {})
    },
    fragment: {
      ...FRAGMENT_STYLE,
      ...(theme.fragment || {})
    }
  };
}
