import PptxGenJS from "pptxgenjs";

const SLIDE_WIDTH = 13.333;
const SLIDE_PADDING = 0.18;

export async function writeFlowchartPptx(diagram, filePath) {
  if (diagram.type !== "flowchart") {
    throw new Error(`Unsupported PPT export type: ${diagram.type}`);
  }

  const pptx = new PptxGenJS();
  const scale = (SLIDE_WIDTH - SLIDE_PADDING * 2) / diagram.canvas.width;
  const slideHeight = diagram.canvas.height * scale + SLIDE_PADDING * 2;

  pptx.defineLayout({
    name: "MERMAID_FLOWCHART",
    width: SLIDE_WIDTH,
    height: slideHeight
  });
  pptx.layout = "MERMAID_FLOWCHART";
  pptx.author = "Codex";
  pptx.company = "OpenAI";
  pptx.subject = "Mermaid Flowchart Export";
  pptx.title = "Mermaid Diagram";

  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };

  for (const node of diagram.nodes) {
    addNode(slide, node, scale);
  }

  for (const edge of diagram.edges) {
    addEdge(slide, edge, scale);
  }

  await pptx.writeFile({ fileName: filePath, compression: true });
}

function addNode(slide, node, scale) {
  const shapeType = mapShapeType(node.shape);
  const x = positionToInches(node.x, scale);
  const y = positionToInches(node.y, scale);
  const w = sizeToInches(node.width, scale);
  const h = sizeToInches(node.height, scale);

  slide.addShape(shapeType, {
    x,
    y,
    w,
    h,
    fill: { color: node.style.fill },
    line: {
      color: node.style.stroke,
      pt: pxToPt(node.style.strokeWidth, scale)
    }
  });

  slide.addText(node.text || "", {
    x,
    y,
    w,
    h,
    fontFace: node.style.fontFamily,
    fontSize: nodeFontPxToPt(node.style.fontSize, scale),
    color: node.style.textColor,
    margin: 0,
    align: "center",
    valign: "mid",
    breakLine: false,
    fit: "shrink"
  });
}

function addEdge(slide, edge, scale) {
  for (let index = 0; index < edge.points.length - 1; index += 1) {
    const start = edge.points[index];
    const end = edge.points[index + 1];
    const isLastSegment = index === edge.points.length - 2;
    const x = positionToInches(Math.min(start.x, end.x), scale);
    const y = positionToInches(Math.min(start.y, end.y), scale);
    const w = Math.max(sizeToInches(Math.abs(end.x - start.x), scale), 0.001);
    const h = Math.max(sizeToInches(Math.abs(end.y - start.y), scale), 0.001);

    slide.addShape("line", {
      x,
      y,
      w,
      h,
      flipH: end.x < start.x,
      flipV: end.y < start.y,
      line: {
        color: edge.style.stroke,
        pt: pxToPt(edge.style.strokeWidth, scale),
        dashType: edge.style.dashType,
        endArrowType: isLastSegment ? edge.style.endArrow : "none"
      }
    });
  }

  if (edge.label?.text) {
    slide.addText(edge.label.text, {
      x: positionToInches(edge.label.x, scale),
      y: positionToInches(edge.label.y, scale),
      w: sizeToInches(edge.label.width, scale),
      h: sizeToInches(edge.label.height, scale),
      fontFace: edge.label.style.fontFamily,
      fontSize: edgeFontPxToPt(edge.label.style.fontSize, scale),
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

function positionToInches(value, scale) {
  return SLIDE_PADDING + value * scale;
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
