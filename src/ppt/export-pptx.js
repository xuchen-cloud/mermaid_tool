import PptxGenJS from "pptxgenjs";

const SLIDE_WIDTH = 13.333;
const SLIDE_PADDING = 0.18;
const MAX_CONTENT_SCALE = 0.017;

export async function writeFlowchartPptx(diagram, filePath) {
  if (diagram.type !== "flowchart") {
    throw new Error(`Unsupported PPT export type: ${diagram.type}`);
  }

  const pptx = buildFlowchartPresentation(diagram);

  await pptx.writeFile({ fileName: filePath, compression: true });
}

export async function writeSequencePptx(diagram, filePath) {
  if (diagram.type !== "sequence") {
    throw new Error(`Unsupported PPT export type: ${diagram.type}`);
  }

  const pptx = buildSequencePresentation(diagram);

  await pptx.writeFile({ fileName: filePath, compression: true });
}

export async function writeDiagramPptx(diagram, filePath) {
  if (diagram.type === "flowchart") {
    return writeFlowchartPptx(diagram, filePath);
  }

  if (diagram.type === "sequence") {
    return writeSequencePptx(diagram, filePath);
  }

  throw new Error(`Unsupported PPT export type: ${diagram.type}`);
}

export async function buildDiagramPptxBytes(diagram) {
  const pptx =
    diagram.type === "flowchart"
      ? buildFlowchartPresentation(diagram)
      : diagram.type === "sequence"
        ? buildSequencePresentation(diagram)
        : null;

  if (!pptx) {
    throw new Error(`Unsupported PPT export type: ${diagram.type}`);
  }

  const arrayBuffer = await pptx.write({ outputType: "arraybuffer", compression: true });
  return new Uint8Array(arrayBuffer);
}

function buildFlowchartPresentation(diagram) {
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
  slide.background = { color: diagram.theme?.canvas?.background || "FFFFFF" };

  for (const node of diagram.nodes) {
    addNode(slide, node, viewport);
  }

  for (const edge of diagram.edges) {
    addEdge(slide, edge, viewport);
  }

  return pptx;
}

function buildSequencePresentation(diagram) {
  const pptx = new PptxGenJS();
  const viewport = getFlowchartSlideMetrics(diagram);

  pptx.defineLayout({
    name: "MERMAID_SEQUENCE",
    width: SLIDE_WIDTH,
    height: viewport.slideHeight
  });
  pptx.layout = "MERMAID_SEQUENCE";
  pptx.author = "Codex";
  pptx.company = "OpenAI";
  pptx.subject = "Mermaid Sequence Export";
  pptx.title = "Mermaid Diagram";

  const slide = pptx.addSlide();
  slide.background = { color: diagram.theme?.canvas?.background || "FFFFFF" };

  if (diagram.title?.text) {
    addSequenceTitle(slide, diagram.title, viewport);
  }

  for (const fragment of diagram.fragments) {
    addSequenceFragment(slide, fragment, viewport);
  }

  for (const participant of diagram.participants) {
    addSequenceParticipant(slide, participant, viewport);
  }

  for (const lifeline of diagram.lifelines) {
    addSequenceLifeline(slide, lifeline, viewport);
  }

  for (const activation of diagram.activations) {
    addSequenceActivation(slide, activation, viewport);
  }

  for (const message of diagram.messages) {
    addSequenceMessage(slide, message, viewport);
  }

  for (const note of diagram.notes) {
    addSequenceNote(slide, note, viewport);
  }

  return pptx;
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
  const textStyle = resolveTextStyle(node.text || "", node.style.fontFamily);

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
    fontFace: textStyle.fontFace,
    lang: textStyle.lang,
    fontSize: nodeFontPxToPt(node.style.fontSize, viewport.scale),
    color: node.style.textColor,
    margin: 0,
    align: "center",
    valign: "mid",
    fit: "shrink",
    lineSpacingMultiple: 1.0
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
    const textStyle = resolveTextStyle(edge.label.text, edge.label.style.fontFamily);
    slide.addText(edge.label.text, {
      x: positionToInches(edge.label.x, viewport, "x"),
      y: positionToInches(edge.label.y, viewport, "y"),
      w: sizeToInches(edge.label.width, viewport.scale),
      h: sizeToInches(edge.label.height, viewport.scale),
      fontFace: textStyle.fontFace,
      lang: textStyle.lang,
      fontSize: edgeFontPxToPt(edge.label.style.fontSize, viewport.scale),
      color: edge.label.style.textColor,
      align: "center",
      valign: "mid",
      margin: 0,
      fit: "shrink",
      lineSpacingMultiple: 1.0,
      fill: edge.label.style.fill ? { color: edge.label.style.fill, transparency: 12 } : undefined,
      line: { color: "FFFFFF", transparency: 100 }
    });
  }
}

function addSequenceParticipant(slide, participant, viewport) {
  const x = positionToInches(participant.x, viewport, "x");
  const y = positionToInches(participant.y, viewport, "y");
  const w = sizeToInches(participant.width, viewport.scale);
  const h = sizeToInches(participant.height, viewport.scale);

  slide.addShape("rect", {
    x,
    y,
    w,
    h,
    fill: { color: participant.style.fill },
    line: {
      color: participant.style.stroke,
      pt: pxToPt(participant.style.strokeWidth, viewport.scale)
    }
  });

  slide.addText(participant.text, {
    x,
    y,
    w,
    h,
    fontFace: participant.style.fontFamily,
    fontSize: nodeFontPxToPt(participant.style.fontSize, viewport.scale),
    color: participant.style.textColor,
    margin: 0,
    align: "center",
    valign: "mid",
    fit: "shrink"
  });
}

function addSequenceLifeline(slide, lifeline, viewport) {
  const x = positionToInches(lifeline.x, viewport, "x");
  const y = positionToInches(lifeline.y1, viewport, "y");
  const h = Math.max(sizeToInches(lifeline.y2 - lifeline.y1, viewport.scale), 0.001);

  slide.addShape("line", {
    x,
    y,
    w: 0.001,
    h,
    line: {
      color: lifeline.style.stroke,
      pt: pxToPt(lifeline.style.strokeWidth, viewport.scale),
      dashType: lifeline.style.dashType
    }
  });
}

function addSequenceActivation(slide, activation, viewport) {
  slide.addShape("rect", {
    x: positionToInches(activation.x, viewport, "x"),
    y: positionToInches(activation.y, viewport, "y"),
    w: sizeToInches(activation.width, viewport.scale),
    h: sizeToInches(activation.height, viewport.scale),
    fill: { color: activation.style.fill },
    line: {
      color: activation.style.stroke,
      pt: pxToPt(activation.style.strokeWidth, viewport.scale)
    }
  });
}

function addSequenceMessage(slide, message, viewport) {
  for (let index = 0; index < message.points.length - 1; index += 1) {
    const start = message.points[index];
    const end = message.points[index + 1];
    const isLastSegment = index === message.points.length - 2;
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
        color: message.style.stroke,
        pt: pxToPt(message.style.strokeWidth, viewport.scale),
        dashType: message.style.dashType,
        endArrowType: isLastSegment ? message.style.endArrow : "none"
      }
    });
  }

  if (message.label?.text) {
    slide.addText(message.label.text, {
      x: positionToInches(message.label.x, viewport, "x"),
      y: positionToInches(message.label.y, viewport, "y"),
      w: sizeToInches(message.label.width, viewport.scale),
      h: sizeToInches(message.label.height, viewport.scale),
      fontFace: message.label.style.fontFamily,
      fontSize: edgeFontPxToPt(message.label.style.fontSize, viewport.scale),
      color: message.label.style.textColor,
      align: "center",
      valign: "mid",
      margin: 0,
      line: { color: "FFFFFF", transparency: 100 }
    });
  }
}

function addSequenceNote(slide, note, viewport) {
  slide.addShape("rect", {
    x: positionToInches(note.x, viewport, "x"),
    y: positionToInches(note.y, viewport, "y"),
    w: sizeToInches(note.width, viewport.scale),
    h: sizeToInches(note.height, viewport.scale),
    fill: { color: note.style.fill },
    line: {
      color: note.style.stroke,
      pt: pxToPt(note.style.strokeWidth, viewport.scale)
    }
  });

  slide.addText(note.text, {
    x: positionToInches(note.x, viewport, "x"),
    y: positionToInches(note.y, viewport, "y"),
    w: sizeToInches(note.width, viewport.scale),
    h: sizeToInches(note.height, viewport.scale),
    fontFace: note.style.fontFamily,
    fontSize: edgeFontPxToPt(note.style.fontSize, viewport.scale),
    color: note.style.textColor,
    margin: 0,
    align: "center",
    valign: "mid",
    fit: "shrink"
  });
}

function addSequenceFragment(slide, fragment, viewport) {
  slide.addShape("rect", {
    x: positionToInches(fragment.x, viewport, "x"),
    y: positionToInches(fragment.y, viewport, "y"),
    w: sizeToInches(fragment.width, viewport.scale),
    h: sizeToInches(fragment.height, viewport.scale),
    fill: { color: fragment.style.fill, transparency: 100 },
    line: {
      color: fragment.style.stroke,
      pt: pxToPt(fragment.style.strokeWidth, viewport.scale)
    }
  });

  slide.addText(`${fragment.kind.toUpperCase()} ${fragment.title}`, {
    x: positionToInches(fragment.x + 8, viewport, "x"),
    y: positionToInches(fragment.y + 4, viewport, "y"),
    w: sizeToInches(Math.max(fragment.width - 16, 40), viewport.scale),
    h: sizeToInches(18, viewport.scale),
    fontFace: fragment.style.fontFamily,
    fontSize: edgeFontPxToPt(fragment.style.fontSize, viewport.scale),
    color: fragment.style.textColor,
    margin: 0,
    align: "left",
    valign: "mid",
    line: { color: "FFFFFF", transparency: 100 }
  });

  for (const separator of fragment.branchSeparators) {
    slide.addShape("line", {
      x: positionToInches(fragment.x, viewport, "x"),
      y: positionToInches(separator.y, viewport, "y"),
      w: sizeToInches(fragment.width, viewport.scale),
      h: 0.001,
      line: {
        color: fragment.style.stroke,
        pt: pxToPt(fragment.style.strokeWidth, viewport.scale),
        dashType: "dash"
      }
    });

    if (separator.title) {
      slide.addText(separator.title, {
        x: positionToInches(fragment.x + 8, viewport, "x"),
        y: positionToInches(separator.y - 16, viewport, "y"),
        w: sizeToInches(Math.max(fragment.width - 16, 40), viewport.scale),
        h: sizeToInches(14, viewport.scale),
        fontFace: fragment.style.fontFamily,
        fontSize: edgeFontPxToPt(fragment.style.fontSize, viewport.scale),
        color: fragment.style.textColor,
        margin: 0,
        align: "left",
        valign: "mid",
        line: { color: "FFFFFF", transparency: 100 }
      });
    }
  }
}

function addSequenceTitle(slide, title, viewport) {
  slide.addText(title.text, {
    x: positionToInches(title.x, viewport, "x"),
    y: positionToInches(title.y, viewport, "y"),
    w: sizeToInches(title.width, viewport.scale),
    h: sizeToInches(title.height, viewport.scale),
    fontFace: title.style.fontFamily,
    fontSize: nodeFontPxToPt(title.style.fontSize, viewport.scale),
    color: title.style.textColor,
    margin: 0,
    align: "center",
    valign: "mid",
    fit: "shrink",
    line: { color: "FFFFFF", transparency: 100 }
  });
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
  return Math.max(4.0, value * scale * 64.8);
}

function edgeFontPxToPt(value, scale) {
  return Math.max(3.8, value * scale * 64.8);
}

function resolveTextStyle(text, fontFace) {
  if (containsCjk(text)) {
    return {
      fontFace: "PingFang SC",
      lang: "zh-CN"
    };
  }

  return {
    fontFace,
    lang: "en-US"
  };
}

function containsCjk(text) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/u.test(text);
}
