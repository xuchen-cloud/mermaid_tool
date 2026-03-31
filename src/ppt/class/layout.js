import dagre from "dagre";

const DEFAULT_NODE_STYLE = {
  fill: "ECECFF",
  stroke: "9370DB",
  strokeWidth: 1.25,
  textColor: "333333",
  fontSize: 18,
  fontFamily: "Trebuchet MS"
};

const DEFAULT_EDGE_STYLE = {
  stroke: "333333",
  strokeWidth: 1.75
};

const DEFAULT_EDGE_LABEL_STYLE = {
  fill: "E8E8E8",
  textColor: "333333",
  fontSize: 14,
  fontFamily: "Trebuchet MS"
};

export function layoutClassDiagram(parsed, theme = {}) {
  const styles = createClassStyles(theme);
  const graph = new dagre.graphlib.Graph({ multigraph: true });

  graph.setGraph({
    rankdir: parsed.direction,
    ranksep: styles.layout.rankSpacing,
    nodesep: styles.layout.nodeSpacing,
    edgesep: 14,
    marginx: styles.layout.padding,
    marginy: styles.layout.padding
  });
  graph.setDefaultEdgeLabel(() => ({}));

  const measuredNodes = parsed.nodes.map((node) => {
    const measurement = measureClassNode(node, styles);
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
      kind: "class",
      x: layoutNode.x - layoutNode.width / 2,
      y: layoutNode.y - layoutNode.height / 2,
      width: layoutNode.width,
      height: layoutNode.height,
      style: { ...styles.node }
    };
  });
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  const edges = parsed.edges.map((edge) => {
    const layoutEdge = graph.edge({ v: edge.from, w: edge.to, name: edge.id });
    const points = adjustEdgePoints(layoutEdge.points, nodeMap.get(edge.from), nodeMap.get(edge.to));

    return {
      ...edge,
      points,
      label: edge.label ? placeEdgeLabel(edge.label, points, styles.edgeLabel) : null,
      startLabel: edge.startLabel
        ? placeTerminalLabel(edge.startLabel, points, "start", styles.edgeLabel)
        : null,
      endLabel: edge.endLabel
        ? placeTerminalLabel(edge.endLabel, points, "end", styles.edgeLabel)
        : null,
      style: {
        ...styles.edge,
        dashType: edge.style.dashType,
        startArrow: edge.style.startArrow,
        endArrow: edge.style.endArrow
      }
    };
  });

  return {
    type: "class",
    direction: parsed.direction,
    theme: {
      canvas: {
        background: styles.canvas.background
      }
    },
    canvas: measureCanvas(nodes, edges),
    nodes,
    edges
  };
}

function measureClassNode(node, styles) {
  const titleFontSize = styles.node.fontSize;
  const annotationFontSize = Math.max(12, titleFontSize - 4);
  const memberFontSize = Math.max(12, titleFontSize - 3);
  const sections = [];
  let width = Math.max(
    140,
    estimateMultilineWidth(node.title, titleFontSize) + 34
  );

  if (node.annotations.length) {
    sections.push(
      createSection("annotations", node.annotations, annotationFontSize, {
        align: "center",
        italic: true
      })
    );
    width = Math.max(width, widestLine(node.annotations, annotationFontSize) + 34);
  }

  sections.push(
    createSection("title", [node.title], titleFontSize, {
      align: "center",
      bold: true
    })
  );

  if (node.members.length) {
    sections.push(createSection("members", node.members, memberFontSize, { align: "left" }));
    width = Math.max(width, widestLine(node.members, memberFontSize) + 36);
  }

  if (node.methods.length) {
    sections.push(createSection("methods", node.methods, memberFontSize, { align: "left" }));
    width = Math.max(width, widestLine(node.methods, memberFontSize) + 36);
  }

  let cursorY = 0;
  for (const section of sections) {
    section.yOffset = cursorY;
    cursorY += section.height;
  }

  return {
    width,
    height: cursorY,
    sections
  };
}

function createSection(kind, lines, fontSize, options = {}) {
  const filteredLines = lines.filter(Boolean);
  const lineCount = Math.max(1, filteredLines.length);
  const paddingY = kind === "title" ? 10 : 8;

  return {
    kind,
    lines: filteredLines,
    fontSize,
    align: options.align || "left",
    bold: Boolean(options.bold),
    italic: Boolean(options.italic),
    height: Math.max(fontSize * 1.35 + paddingY * 2, lineCount * fontSize * 1.18 + paddingY * 2)
  };
}

function widestLine(lines, fontSize) {
  return lines.reduce(
    (max, line) => Math.max(max, estimateTextWidth(line, fontSize)),
    0
  );
}

function estimateMultilineWidth(text, fontSize) {
  return String(text || "")
    .split(/\n+/)
    .filter(Boolean)
    .reduce((max, line) => Math.max(max, estimateTextWidth(line, fontSize)), 0);
}

function createClassStyles(theme) {
  return {
    canvas: {
      background: theme.canvas?.background || "FFFFFF"
    },
    node: {
      ...DEFAULT_NODE_STYLE,
      ...(theme.node || {})
    },
    edge: {
      ...DEFAULT_EDGE_STYLE,
      ...(theme.edge || {})
    },
    edgeLabel: {
      ...DEFAULT_EDGE_LABEL_STYLE,
      ...(theme.edgeLabel || {})
    },
    layout: {
      nodeSpacing: Math.max(24, theme.layout?.nodeSpacing ?? 36),
      rankSpacing: Math.max(36, theme.layout?.rankSpacing ?? 70),
      padding: Math.max(4, theme.layout?.padding ?? 8)
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

function placeTerminalLabel(text, points, terminal, edgeLabelStyle = DEFAULT_EDGE_LABEL_STYLE) {
  if (points.length < 2) {
    return null;
  }

  const { width, height } = measureLabel(text, edgeLabelStyle);
  const isStart = terminal === "start";
  const anchor = isStart ? points[0] : points[points.length - 1];
  const toward = isStart ? points[1] : points[points.length - 2];
  const dx = toward.x - anchor.x;
  const dy = toward.y - anchor.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const along = 18;
  const baseX = anchor.x + (dx / length) * along;
  const baseY = anchor.y + (dy / length) * along;
  const offset = Math.abs(dx) >= Math.abs(dy) ? { x: 0, y: -12 } : { x: dx >= 0 ? 12 : -12, y: 0 };

  return {
    text,
    x: baseX - width / 2 + offset.x,
    y: baseY - height / 2 + offset.y,
    width,
    height,
    style: {
      ...edgeLabelStyle
    }
  };
}

function adjustEdgePoints(points, sourceNode, targetNode) {
  if (!points || points.length < 2 || !sourceNode || !targetNode) {
    return points?.map((point) => ({ x: point.x, y: point.y })) ?? [];
  }

  const adjusted = points.map((point) => ({ x: point.x, y: point.y }));
  adjusted[0] = intersectRect(sourceNode, adjusted[1]);
  adjusted[adjusted.length - 1] = intersectRect(targetNode, adjusted[adjusted.length - 2]);
  return adjusted;
}

function intersectRect(node, towardPoint) {
  const center = {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2
  };
  const dx = towardPoint.x - center.x;
  const dy = towardPoint.y - center.y;

  if (dx === 0 && dy === 0) {
    return center;
  }

  const scale = 1 / Math.max(Math.abs(dx) / (node.width / 2), Math.abs(dy) / (node.height / 2));
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale
  };
}

function measureCanvas(nodes, edges) {
  let maxX = 0;
  let maxY = 0;

  for (const node of nodes) {
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  for (const edge of edges) {
    for (const point of edge.points) {
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    for (const label of [edge.label, edge.startLabel, edge.endLabel]) {
      if (!label) {
        continue;
      }
      maxX = Math.max(maxX, label.x + label.width);
      maxY = Math.max(maxY, label.y + label.height);
    }
  }

  return {
    width: maxX + 16,
    height: maxY + 16
  };
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

function isCjk(char) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(char);
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

  return points[Math.floor(points.length / 2)];
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
