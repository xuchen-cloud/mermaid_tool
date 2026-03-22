import PptxGenJS from "pptxgenjs";

const SLIDE_WIDTH = 13.333;
const SLIDE_PADDING = 0.18;
const MAX_CONTENT_SCALE = 0.017;

export async function writeFlowchartPptx(diagram, filePath) {
  if (diagram.type !== "flowchart") {
    throw new Error(`Unsupported PPT export type: ${diagram.type}`);
  }

  const pptx = new PptxGenJS();
  const viewport = getFlowchartSlideMetrics(diagram);

  pptx.defineLayout({
    name: "MERMAID_FLOWCHART",
    width: SLIDE_WIDTH,
    height: viewport.slideHeight
  });
  pptx.layout = "MERMAID_FLOWCHART";
  pptx.author = "Codex";
  pptx.company = "OpenAI";
  pptx.subject = "Mermaid Flowchart Export";
  pptx.title = "Mermaid Diagram";

  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };

  for (const node of diagram.nodes) {
    addNode(slide, node, viewport);
  }

  for (const edge of diagram.edges) {
    addEdge(slide, edge, viewport);
  }

  await pptx.writeFile({ fileName: filePath, compression: true });
}

export function getFlowchartSlideMetrics(diagram) {
  const usableWidth = SLIDE_WIDTH - SLIDE_PADDING * 2;
  const fitScale = usableWidth / diagram.canvas.width;
  const scale = Math.min(fitScale, MAX_CONTENT_SCALE);
  const contentWidth = diagram.canvas.width * scale;
  const slideHeight = diagram.canvas.height * scale + SLIDE_PADDING * 2;

  return {
    scale,
    slideWidth: SLIDE_WIDTH,
    slideHeight,
    padding: SLIDE_PADDING,
    offsetX: Math.max(0, (usableWidth - contentWidth) / 2),
    offsetY: 0
  };
}

function addNode(slide, node, viewport) {
  const shapeType = mapShapeType(node.shape);
  const x = positionToInches(node.x, viewport, "x");
  const y = positionToInches(node.y, viewport, "y");
  const w = sizeToInches(node.width, viewport.scale);
  const h = sizeToInches(node.height, viewport.scale);

  slide.addShape(shapeType, {
    x,
    y,
    w,
    h,
    fill: { color: node.style.fill },
    line: {
      color: node.style.stroke,
      pt: pxToPt(node.style.strokeWidth, viewport.scale)
    }
  });

  slide.addText(node.text || "", {
    x,
    y,
    w,
    h,
    fontFace: node.style.fontFamily,
    fontSize: nodeFontPxToPt(node.style.fontSize, viewport.scale),
    color: node.style.textColor,
    margin: 0,
    align: "center",
    valign: "mid",
    breakLine: false,
    fit: "shrink"
  });
}

function addEdge(slide, edge, viewport) {
  for (let index = 0; index < edge.points.length - 1; index += 1) {
    const start = edge.points[index];
    const end = edge.points[index + 1];
    const isLastSegment = index === edge.points.length - 2;
    const x = positionToInches(Math.min(start.x, end.x), viewport, "x");
    const y = positionToInches(Math.min(start.y, end.y), viewport, "y");
    const w = Math.max(sizeToInches(Math.abs(end.x - start.x), viewport.scale), 0.001);
    const h = Math.max(sizeToInches(Math.abs(end.y - start.y), viewport.scale), 0.001);

    slide.addShape("line", {
      x,
      y,
      w,
      h,
      flipH: end.x < start.x,
      flipV: end.y < start.y,
      line: {
        color: edge.style.stroke,
        pt: pxToPt(edge.style.strokeWidth, viewport.scale),
        dashType: edge.style.dashType,
        endArrowType: isLastSegment ? edge.style.endArrow : "none"
      }
    });
  }

  if (edge.label?.text) {
    slide.addText(edge.label.text, {
      x: positionToInches(edge.label.x, viewport, "x"),
      y: positionToInches(edge.label.y, viewport, "y"),
      w: sizeToInches(edge.label.width, viewport.scale),
      h: sizeToInches(edge.label.height, viewport.scale),
      fontFace: edge.label.style.fontFamily,
      fontSize: edgeFontPxToPt(edge.label.style.fontSize, viewport.scale),
      color: edge.label.style.textColor,
      align: "center",
      valign: "mid",
      margin: 0,
      fill: edge.label.style.fill ? { color: edge.label.style.fill, transparency: 12 } : undefined,
      line: { color: "FFFFFF", transparency: 100 }
    });
  }
}

function mapShapeType(shape) {
  switch (shape) {
    case "diamond":
      return "diamond";
    case "ellipse":
      return "ellipse";
    case "roundRect":
      return "roundRect";
    default:
      return "rect";
  }
}

function positionToInches(value, viewport, axis) {
  const offset = axis === "x" ? viewport.offsetX : viewport.offsetY;
  return viewport.padding + offset + value * viewport.scale;
}

function sizeToInches(value, scale) {
  return value * scale;
}

function pxToPt(value, scale) {
  return Math.max(0.6, value * scale * 72);
}

function nodeFontPxToPt(value, scale) {
  return Math.max(8.5, value * scale * 72);
}

function edgeFontPxToPt(value, scale) {
  return Math.max(7.5, value * scale * 72);
}
