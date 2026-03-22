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

export function layoutFlowchart(parsed, theme = {}) {
  const styles = createFlowchartStyles(theme);
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  const layoutOptions = styles.layout;
  graph.setGraph({
    rankdir: parsed.direction,
    ranksep: layoutOptions.rankSpacing,
    nodesep: layoutOptions.nodeSpacing,
    edgesep: 10,
    marginx: layoutOptions.padding,
    marginy: layoutOptions.padding
  });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of parsed.nodes) {
    const size = measureNode(node, styles.node);
    graph.setNode(node.id, {
      ...node,
      width: size.width,
      height: size.height
    });
  }

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

  const nodes = parsed.nodes.map((node) => {
    const layoutNode = graph.node(node.id);

    return {
      ...node,
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
    const label = edge.label ? placeEdgeLabel(edge.label, points, styles.edgeLabel) : null;

    return {
      ...edge,
      points,
      label,
      style: {
        ...styles.edge,
        dashType: edge.style.dashType,
        endArrow: edge.style.endArrow
      }
    };
  });

  return {
    type: "flowchart",
    source: parsed.source,
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

function measureNode(node, nodeStyle) {
  const lines = node.text.split(/\n+/).filter(Boolean);
  const longestLineWidth = lines.reduce(
    (max, line) => Math.max(max, estimateTextWidth(line, nodeStyle.fontSize)),
    0
  );
  const baseWidth = longestLineWidth + 24;
  const baseHeight = lines.length * nodeStyle.fontSize * 1.08 + 12;

  if (node.shape === "diamond") {
    return {
      width: Math.max(140, baseWidth * 1.08),
      height: Math.max(82, baseHeight * 1.4)
    };
  }

  if (node.shape === "ellipse") {
    return {
      width: Math.max(104, baseWidth + 8),
      height: Math.max(56, baseHeight + 4)
    };
  }

  return {
    width: Math.max(98, baseWidth),
    height: Math.max(42, baseHeight)
  };
}

function measureEdgeLabel(text, edgeLabelStyle) {
  const width = estimateTextWidth(text, edgeLabelStyle.fontSize) + 8;

  return {
    width: Math.max(28, width),
    height: 16
  };
}

function estimateTextWidth(text, fontSize) {
  let units = 0;

  for (const char of text) {
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

function adjustEdgePoints(points, sourceNode, targetNode) {
  if (!points || points.length < 2 || !sourceNode || !targetNode) {
    return points?.map((point) => ({ x: point.x, y: point.y })) ?? [];
  }

  const adjusted = points.map((point) => ({ x: point.x, y: point.y }));
  adjusted[0] = intersectNodeBoundary(sourceNode, adjusted[1]);
  adjusted[adjusted.length - 1] = intersectNodeBoundary(
    targetNode,
    adjusted[adjusted.length - 2]
  );
  return adjusted;
}

function placeEdgeLabel(text, points, edgeLabelStyle = DEFAULT_EDGE_LABEL_STYLE) {
  if (points.length < 2) {
    return null;
  }

  const { width, height } = measureEdgeLabel(text, edgeLabelStyle);
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

function createFlowchartStyles(theme) {
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
      nodeSpacing: Math.max(20, theme.layout?.nodeSpacing ?? 28),
      rankSpacing: Math.max(28, theme.layout?.rankSpacing ?? 54),
      padding: Math.max(4, theme.layout?.padding ?? 8)
    }
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

function intersectNodeBoundary(node, towardPoint) {
  const center = {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2
  };

  switch (node.shape) {
    case "diamond":
      return intersectDiamond(center, node.width, node.height, towardPoint);
    case "ellipse":
      return intersectEllipse(center, node.width, node.height, towardPoint);
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
