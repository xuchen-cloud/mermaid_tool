import dagre from "dagre";

const DEFAULT_STATE_STYLE = {
  fill: "ECECFF",
  stroke: "9370DB",
  strokeWidth: 1.25,
  textColor: "333333",
  fontSize: 18,
  fontFamily: "Trebuchet MS"
};

const DEFAULT_EDGE_STYLE = {
  stroke: "333333",
  strokeWidth: 1.6
};

const DEFAULT_NOTE_STYLE = {
  fill: "FFF8C4",
  stroke: "C3B260",
  strokeWidth: 1,
  textColor: "333333",
  fontSize: 14,
  fontFamily: "Trebuchet MS"
};

const DEFAULT_GROUP_STYLE = {
  fill: "ECECFF",
  bodyFill: "FFFFFF",
  stroke: "9370DB",
  strokeWidth: 1.1,
  textColor: "333333",
  fontSize: 16,
  fontFamily: "Trebuchet MS"
};

const DEFAULT_EDGE_LABEL_STYLE = {
  fill: "E8E8E8",
  textColor: "333333",
  fontSize: 13,
  fontFamily: "Trebuchet MS"
};

const NOTE_GAP = 28;
const GROUP_PADDING = 18;
const GROUP_TITLE_HEIGHT = 28;

export function layoutStateDiagram(parsed, theme = {}) {
  const styles = createStateStyles(theme);
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  const stateNodes = parsed.states.filter((node) => node.type !== "group");

  graph.setGraph({
    rankdir: parsed.direction,
    ranksep: styles.layout.rankSpacing,
    nodesep: styles.layout.nodeSpacing,
    edgesep: 12,
    marginx: styles.layout.padding,
    marginy: styles.layout.padding
  });
  graph.setDefaultEdgeLabel(() => ({}));

  const measuredNodes = stateNodes.map((node) => {
    const measurement = measureStateNode(node, parsed.direction, styles);
    graph.setNode(node.id, {
      ...node,
      width: measurement.width,
      height: measurement.height
    });
    return {
      ...node,
      ...measurement
    };
  });

  for (const edge of parsed.edges) {
    if (!graph.hasNode(edge.from) || !graph.hasNode(edge.to)) {
      continue;
    }

    graph.setEdge(
      edge.from,
      edge.to,
      {
        ...edge,
        width: 0,
        height: 0,
        labelpos: "c"
      },
      edge.id
    );
  }

  dagre.layout(graph);

  const nodes = measuredNodes.map((node) => {
    const layoutNode = graph.node(node.id);
    return {
      ...node,
      kind: node.type === "note" ? "note" : "state",
      x: layoutNode.x - layoutNode.width / 2,
      y: layoutNode.y - layoutNode.height / 2,
      width: layoutNode.width,
      height: layoutNode.height,
      style: resolveNodeStyle(node, styles)
    };
  });
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  const notes = positionNotes(parsed.notes, nodeMap, styles);
  for (const note of notes) {
    nodeMap.set(note.id, note);
  }

  const groups = positionGroups(parsed.states.filter((node) => node.type === "group"), nodeMap, styles);
  for (const group of groups) {
    nodeMap.set(group.id, group);
  }

  const edges = parsed.edges.map((edge) =>
    layoutStateEdge(edge, graph, nodeMap, styles.edge, styles.edgeLabel)
  );
  const noteEdges = notes.map((note, index) => layoutNoteEdge(note, nodeMap.get(note.targetId), styles, index));
  const normalized = normalizeDiagramOrigin(nodes, notes, groups, [...edges, ...noteEdges]);

  return {
    type: "state",
    direction: parsed.direction,
    theme: {
      canvas: {
        background: styles.canvas.background
      },
      state: styles.state,
      note: styles.note,
      group: styles.group,
      edge: styles.edge,
      edgeLabel: styles.edgeLabel
    },
    nodes: normalized.nodes,
    notes: normalized.notes,
    groups: normalized.groups,
    edges: normalized.edges,
    canvas: measureCanvas(
      normalized.nodes,
      normalized.notes,
      normalized.groups,
      normalized.edges
    )
  };
}

function measureStateNode(node, direction, styles) {
  switch (node.type) {
    case "start":
      return { width: 22, height: 22 };
    case "end":
      return { width: 28, height: 28 };
    case "choice":
      return { width: 92, height: 56 };
    case "fork":
    case "join":
      return isHorizontalFlow(direction) ? { width: 14, height: 76 } : { width: 76, height: 14 };
    default:
      return measureDefaultState(node, styles.state);
  }
}

function measureDefaultState(node, stateStyle) {
  const titleLines = [node.label || node.id].filter(Boolean);
  const descriptionLines = node.descriptions ?? [];
  const titleWidth = widestLine(titleLines, stateStyle.fontSize);
  const descriptionWidth = widestLine(descriptionLines, Math.max(12, stateStyle.fontSize - 4));
  const width = Math.max(110, titleWidth + 32, descriptionWidth + 28);
  const hasDescription = descriptionLines.length > 0;
  const titleHeight = Math.max(28, stateStyle.fontSize * 1.3 + 14);
  const descriptionHeight = hasDescription
    ? Math.max(24, descriptionLines.length * Math.max(12, stateStyle.fontSize - 4) * 1.18 + 14)
    : 0;

  return {
    width,
    height: titleHeight + descriptionHeight,
    titleHeight,
    descriptionHeight
  };
}

function resolveNodeStyle(node, styles) {
  switch (node.type) {
    case "start":
      return {
        ...styles.state,
        fill: styles.edge.stroke,
        stroke: styles.edge.stroke,
        textColor: styles.state.textColor
      };
    case "end":
      return {
        ...styles.state,
        innerFill: styles.canvas.background
      };
    case "choice":
      return styles.state;
    case "fork":
    case "join":
      return {
        ...styles.state,
        fill: styles.edge.stroke,
        stroke: styles.edge.stroke
      };
    default:
      return styles.state;
  }
}

function positionNotes(parsedNotes, nodeMap, styles) {
  return parsedNotes.map((note) => {
    const target = nodeMap.get(note.targetId);
    const measurement = measureNote(note, styles.note);
    const noteX =
      note.position === "left of"
        ? (target?.x ?? 0) - measurement.width - NOTE_GAP
        : (target?.x ?? 0) + (target?.width ?? 0) + NOTE_GAP;
    const noteY = (target?.y ?? 0) + Math.max(0, ((target?.height ?? measurement.height) - measurement.height) / 2);

    return {
      ...note,
      kind: "note",
      x: noteX,
      y: noteY,
      width: measurement.width,
      height: measurement.height,
      style: styles.note
    };
  });
}

function measureNote(note, noteStyle) {
  const lines = note.text.split(/\n+/).filter(Boolean);
  const width = Math.max(120, widestLine(lines, noteStyle.fontSize) + 20);
  const height = Math.max(42, lines.length * noteStyle.fontSize * 1.18 + 16);
  return { width, height };
}

function positionGroups(parsedGroups, nodeMap, styles) {
  const depthMap = new Map(parsedGroups.map((group) => [group.id, getGroupDepth(group, parsedGroups)]));
  const groups = [];
  const groupMap = new Map();
  const sortedGroups = [...parsedGroups].sort(
    (left, right) => (depthMap.get(right.id) || 0) - (depthMap.get(left.id) || 0)
  );

  for (const group of sortedGroups) {
    const childBoxes = [
      ...Array.from(nodeMap.values()).filter((node) => node.parentId === group.id),
      ...groups.filter((candidate) => candidate.parentId === group.id)
    ];

    let x = 0;
    let y = 0;
    let width = 180;
    let height = 88;

    if (childBoxes.length) {
      const minX = Math.min(...childBoxes.map((item) => item.x));
      const minY = Math.min(...childBoxes.map((item) => item.y));
      const maxX = Math.max(...childBoxes.map((item) => item.x + item.width));
      const maxY = Math.max(...childBoxes.map((item) => item.y + item.height));

      x = minX - GROUP_PADDING;
      y = minY - GROUP_PADDING - GROUP_TITLE_HEIGHT;
      width = maxX - minX + GROUP_PADDING * 2;
      height = maxY - minY + GROUP_PADDING * 2 + GROUP_TITLE_HEIGHT;
    }

    const layoutGroup = {
      ...group,
      kind: "group",
      x,
      y,
      width,
      height,
      titleHeight: GROUP_TITLE_HEIGHT,
      style: styles.group
    };
    groups.push(layoutGroup);
    groupMap.set(group.id, layoutGroup);
  }

  return groups.sort((left, right) => (depthMap.get(left.id) || 0) - (depthMap.get(right.id) || 0));
}

function getGroupDepth(group, groups) {
  let depth = 0;
  let currentParentId = group.parentId;

  while (currentParentId) {
    const parent = groups.find((candidate) => candidate.id === currentParentId);
    if (!parent) {
      break;
    }
    depth += 1;
    currentParentId = parent.parentId;
  }

  return depth;
}

function layoutStateEdge(edge, graph, nodeMap, edgeStyle, edgeLabelStyle) {
  const fromNode = nodeMap.get(edge.from);
  const toNode = nodeMap.get(edge.to);
  const graphEdge = graph.hasEdge({ v: edge.from, w: edge.to, name: edge.id })
    ? graph.edge({ v: edge.from, w: edge.to, name: edge.id })
    : null;
  const rawPoints =
    graphEdge?.points?.map((point) => ({ x: point.x, y: point.y })) ??
    buildFallbackPoints(fromNode, toNode);
  const points = adjustEdgePoints(rawPoints, fromNode, toNode);

  return {
    ...edge,
    points,
    label: edge.label ? placeEdgeLabel(edge.label, points, edgeLabelStyle) : null,
    style: {
      ...edgeStyle,
      dashType: edge.style.dashType,
      startArrow: edge.style.startArrow,
      endArrow: edge.style.endArrow
    }
  };
}

function layoutNoteEdge(note, target, styles, index) {
  const from =
    note.position === "left of"
      ? { x: note.x + note.width, y: note.y + note.height / 2 }
      : { x: note.x, y: note.y + note.height / 2 };
  const to =
    note.position === "left of"
      ? { x: target.x, y: target.y + target.height / 2 }
      : { x: target.x + target.width, y: target.y + target.height / 2 };

  return {
    id: `note-edge-${index}`,
    from: note.id,
    to: target.id,
    lineStart: note.lineStart,
    lineEnd: note.lineEnd,
    label: null,
    points: [from, to],
    style: {
      ...styles.edge,
      dashType: "dash",
      startArrow: "none",
      endArrow: "none"
    }
  };
}

function buildFallbackPoints(fromNode, toNode) {
  if (!fromNode || !toNode) {
    return [];
  }

  return [
    { x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2 },
    { x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2 }
  ];
}

function adjustEdgePoints(points, fromNode, toNode) {
  if (!points.length || !fromNode || !toNode) {
    return points;
  }

  const adjusted = points.map((point) => ({ x: point.x, y: point.y }));
  adjusted[0] = intersectNodeBoundary(fromNode, adjusted[1] ?? adjusted[0]);
  adjusted[adjusted.length - 1] = intersectNodeBoundary(
    toNode,
    adjusted[adjusted.length - 2] ?? adjusted[adjusted.length - 1]
  );
  return adjusted;
}

function intersectNodeBoundary(node, towardPoint) {
  const center = {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2
  };

  switch (node.type) {
    case "start":
    case "end":
      return intersectEllipse(center, node.width, node.height, towardPoint);
    case "choice":
      return intersectDiamond(center, node.width, node.height, towardPoint);
    case "fork":
    case "join":
      return intersectRect(center, node.width, node.height, towardPoint);
    default:
      return intersectRect(center, node.width, node.height, towardPoint);
  }
}

function intersectRect(center, width, height, towardPoint) {
  const dx = towardPoint.x - center.x;
  const dy = towardPoint.y - center.y;

  if (dx === 0 && dy === 0) {
    return center;
  }

  const scale = 1 / Math.max(Math.abs(dx) / (width / 2), Math.abs(dy) / (height / 2));
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale
  };
}

function intersectEllipse(center, width, height, towardPoint) {
  const dx = towardPoint.x - center.x;
  const dy = towardPoint.y - center.y;

  if (dx === 0 && dy === 0) {
    return center;
  }

  const rx = width / 2;
  const ry = height / 2;
  const scale = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale
  };
}

function intersectDiamond(center, width, height, towardPoint) {
  const dx = towardPoint.x - center.x;
  const dy = towardPoint.y - center.y;

  if (dx === 0 && dy === 0) {
    return center;
  }

  const scale = 1 / (Math.abs(dx) / (width / 2) + Math.abs(dy) / (height / 2));
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale
  };
}

function createStateStyles(theme) {
  const flowchart = theme.flowchart || {};
  const sequence = theme.sequence || {};

  return {
    canvas: {
      background: theme.canvas?.background || "FFFFFF"
    },
    state: {
      ...DEFAULT_STATE_STYLE,
      ...(flowchart.node || {})
    },
    edge: {
      ...DEFAULT_EDGE_STYLE,
      ...(flowchart.edge || {})
    },
    note: {
      ...DEFAULT_NOTE_STYLE,
      ...(sequence.note || {})
    },
    group: {
      ...DEFAULT_GROUP_STYLE,
      fill: flowchart.node?.fill || DEFAULT_GROUP_STYLE.fill,
      stroke: flowchart.node?.stroke || DEFAULT_GROUP_STYLE.stroke,
      textColor: flowchart.node?.textColor || DEFAULT_GROUP_STYLE.textColor,
      fontFamily: flowchart.node?.fontFamily || DEFAULT_GROUP_STYLE.fontFamily
    },
    edgeLabel: {
      ...DEFAULT_EDGE_LABEL_STYLE,
      ...(flowchart.edgeLabel || {})
    },
    layout: {
      nodeSpacing: Math.max(28, flowchart.layout?.nodeSpacing ?? 40),
      rankSpacing: Math.max(40, flowchart.layout?.rankSpacing ?? 64),
      padding: Math.max(8, flowchart.layout?.padding ?? 12)
    }
  };
}

function placeEdgeLabel(text, points, edgeLabelStyle = DEFAULT_EDGE_LABEL_STYLE) {
  if (points.length < 2) {
    return null;
  }

  const { width, height } = measureLabel(text, edgeLabelStyle);
  const midpoint = getPolylineMidpoint(points);
  const offset = getLabelOffset(points);

  return {
    text,
    x: midpoint.x - width / 2 + offset.x,
    y: midpoint.y - height / 2 + offset.y,
    width,
    height,
    style: {
      ...edgeLabelStyle
    }
  };
}

function measureLabel(text, edgeLabelStyle) {
  const lines = String(text || "").split(/\n+/).filter(Boolean);
  const longestLineWidth = lines.reduce(
    (max, line) => Math.max(max, estimateTextWidth(line, edgeLabelStyle.fontSize)),
    0
  );
  const width = longestLineWidth + 10;
  const height = Math.max(16, lines.length * edgeLabelStyle.fontSize * 1.05 + 4);

  return {
    width: Math.max(28, width),
    height
  };
}

function widestLine(lines, fontSize) {
  return lines.reduce(
    (max, line) => Math.max(max, estimateTextWidth(line, fontSize)),
    0
  );
}

function estimateTextWidth(text, fontSize) {
  let units = 0;

  for (const char of String(text || "")) {
    if (/\s/.test(char)) {
      units += 0.35;
      continue;
    }

    if (isCjk(char)) {
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

function isHorizontalFlow(direction) {
  return direction === "LR" || direction === "RL";
}

function isCjk(char) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(char);
}

function measureCanvas(nodes, notes, groups, edges) {
  let maxX = 0;
  let maxY = 0;

  for (const item of [...nodes, ...notes, ...groups]) {
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }

  for (const edge of edges) {
    for (const point of edge.points) {
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    if (edge.label) {
      maxX = Math.max(maxX, edge.label.x + edge.label.width);
      maxY = Math.max(maxY, edge.label.y + edge.label.height);
    }
  }

  return {
    width: maxX + 16,
    height: maxY + 16
  };
}

function normalizeDiagramOrigin(nodes, notes, groups, edges) {
  const items = [...nodes, ...notes, ...groups];
  const minX = Math.min(
    0,
    ...items.map((item) => item.x),
    ...edges.flatMap((edge) => edge.points.map((point) => point.x)),
    ...edges.flatMap((edge) => (edge.label ? [edge.label.x] : []))
  );
  const minY = Math.min(
    0,
    ...items.map((item) => item.y),
    ...edges.flatMap((edge) => edge.points.map((point) => point.y)),
    ...edges.flatMap((edge) => (edge.label ? [edge.label.y] : []))
  );

  const shiftX = minX < 0 ? -minX + 8 : 0;
  const shiftY = minY < 0 ? -minY + 8 : 0;

  if (!shiftX && !shiftY) {
    return { nodes, notes, groups, edges };
  }

  return {
    nodes: nodes.map((item) => shiftBox(item, shiftX, shiftY)),
    notes: notes.map((item) => shiftBox(item, shiftX, shiftY)),
    groups: groups.map((item) => shiftBox(item, shiftX, shiftY)),
    edges: edges.map((edge) => shiftEdge(edge, shiftX, shiftY))
  };
}

function shiftBox(item, shiftX, shiftY) {
  return {
    ...item,
    x: item.x + shiftX,
    y: item.y + shiftY
  };
}

function shiftEdge(edge, shiftX, shiftY) {
  return {
    ...edge,
    points: edge.points.map((point) => ({
      x: point.x + shiftX,
      y: point.y + shiftY
    })),
    label: edge.label
      ? {
          ...edge.label,
          x: edge.label.x + shiftX,
          y: edge.label.y + shiftY
        }
      : null
  };
}

function getPolylineMidpoint(points) {
  const segments = [];
  let totalLength = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    segments.push({ start, end, length });
    totalLength += length;
  }

  let remaining = totalLength / 2;
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const ratio = segment.length === 0 ? 0 : remaining / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        y: segment.start.y + (segment.end.y - segment.start.y) * ratio
      };
    }
    remaining -= segment.length;
  }

  return points[Math.floor(points.length / 2)] ?? { x: 0, y: 0 };
}

function getLabelOffset(points) {
  if (points.length < 2) {
    return { x: 0, y: -12 };
  }

  const midpointIndex = Math.max(0, Math.floor((points.length - 2) / 2));
  const start = points[midpointIndex];
  const end = points[midpointIndex + 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: 0, y: -10 };
  }

  return { x: dx >= 0 ? 10 : -10, y: 0 };
}
