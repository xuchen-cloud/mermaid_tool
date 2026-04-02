let PptxGenJS = null;

async function ensurePptxGenJS() {
  if (!PptxGenJS) {
    const mod = await import("pptxgenjs");
    PptxGenJS = mod.default || mod;
  }
}

const SLIDE_WIDTH = 13.333;
const SLIDE_PADDING = 0.18;
const MAX_CONTENT_SCALE = 0.017;

export async function writeFlowchartPptx(diagram, filePath) {
  if (diagram.type !== "flowchart") {
    throw new Error(`Unsupported PPT export type: ${diagram.type}`);
  }

  await ensurePptxGenJS();
  const pptx = buildFlowchartPresentation(diagram);

  await pptx.writeFile({ fileName: filePath, compression: true });
}

export async function writeSequencePptx(diagram, filePath) {
  if (diagram.type !== "sequence") {
    throw new Error(`Unsupported PPT export type: ${diagram.type}`);
  }

  await ensurePptxGenJS();
  const pptx = buildSequencePresentation(diagram);

  await pptx.writeFile({ fileName: filePath, compression: true });
}

export async function writePiePptx(diagram, filePath) {
  if (diagram.type !== "pie") {
    throw new Error(`Unsupported PPT export type: ${diagram.type}`);
  }

  await ensurePptxGenJS();
  const pptx = buildPiePresentation(diagram);
  await pptx.writeFile({ fileName: filePath, compression: true });
}

export async function writeJourneyPptx(diagram, filePath) {
  if (diagram.type !== "journey") {
    throw new Error(`Unsupported PPT export type: ${diagram.type}`);
  }

  await ensurePptxGenJS();
  const pptx = buildJourneyPresentation(diagram);
  await pptx.writeFile({ fileName: filePath, compression: true });
}

export async function writeClassPptx(diagram, filePath) {
  if (diagram.type !== "class") {
    throw new Error(`Unsupported PPT export type: ${diagram.type}`);
  }

  await ensurePptxGenJS();
  const pptx = buildClassPresentation(diagram);
  await pptx.writeFile({ fileName: filePath, compression: true });
}

export async function writeErPptx(diagram, filePath) {
  if (diagram.type !== "er") {
    throw new Error(`Unsupported PPT export type: ${diagram.type}`);
  }

  await ensurePptxGenJS();
  const pptx = buildErPresentation(diagram);
  await pptx.writeFile({ fileName: filePath, compression: true });
}

export async function writeStatePptx(diagram, filePath) {
  if (diagram.type !== "state") {
    throw new Error(`Unsupported PPT export type: ${diagram.type}`);
  }

  await ensurePptxGenJS();
  const pptx = buildStatePresentation(diagram);
  await pptx.writeFile({ fileName: filePath, compression: true });
}

export async function writeDiagramPptx(diagram, filePath) {
  if (diagram.type === "flowchart") {
    return writeFlowchartPptx(diagram, filePath);
  }

  if (diagram.type === "sequence") {
    return writeSequencePptx(diagram, filePath);
  }

  if (diagram.type === "pie") {
    return writePiePptx(diagram, filePath);
  }

  if (diagram.type === "journey") {
    return writeJourneyPptx(diagram, filePath);
  }

  if (diagram.type === "class") {
    return writeClassPptx(diagram, filePath);
  }

  if (diagram.type === "er") {
    return writeErPptx(diagram, filePath);
  }

  if (diagram.type === "state") {
    return writeStatePptx(diagram, filePath);
  }

  throw new Error(`Unsupported PPT export type: ${diagram.type}`);
}

export async function buildDiagramPptxBytes(diagram) {
  await ensurePptxGenJS();
  const pptx = resolvePresentation(diagram);

  if (!pptx) {
    throw new Error(`Unsupported PPT export type: ${diagram.type}`);
  }

  const arrayBuffer = await pptx.write({ outputType: "arraybuffer", compression: true });
  return new Uint8Array(arrayBuffer);
}

function resolvePresentation(diagram) {
  switch (diagram.type) {
    case "flowchart":
      return buildFlowchartPresentation(diagram);
    case "sequence":
      return buildSequencePresentation(diagram);
    case "pie":
      return buildPiePresentation(diagram);
    case "journey":
      return buildJourneyPresentation(diagram);
    case "class":
      return buildClassPresentation(diagram);
    case "er":
      return buildErPresentation(diagram);
    case "state":
      return buildStatePresentation(diagram);
    default:
      return null;
  }
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

function buildPiePresentation(diagram) {
  const pptx = new PptxGenJS();

  pptx.defineLayout({
    name: "MERMAID_PIE",
    width: SLIDE_WIDTH,
    height: 7.5
  });
  pptx.layout = "MERMAID_PIE";
  pptx.author = "Codex";
  pptx.company = "OpenAI";
  pptx.subject = "Mermaid Pie Export";
  pptx.title = "Mermaid Diagram";

  const slide = pptx.addSlide();
  slide.background = { color: diagram.theme?.canvas?.background || "FFFFFF" };

  if (diagram.title) {
    slide.addText(diagram.title, {
      x: 0.45,
      y: 0.28,
      w: 5.2,
      h: 0.35,
      fontFace: diagram.theme?.title?.fontFamily || "Trebuchet MS",
      fontSize: 18,
      color: diagram.theme?.title?.textColor || "333333",
      bold: true,
      margin: 0
    });
  }

  slide.addChart(
    "pie",
    [
      {
        name: diagram.title || "Series 1",
        labels: diagram.sections.map((section) =>
          diagram.showData ? `${section.label} [${section.value}]` : section.label
        ),
        values: diagram.sections.map((section) => section.value)
      }
    ],
    {
      x: 0.4,
      y: 0.8,
      w: 7.8,
      h: 5.8,
      chartColors: diagram.sections.map((section) => section.fill),
      showLegend: true,
      legendPos: "r",
      showTitle: false,
      showValue: Boolean(diagram.showData),
      showPercent: !diagram.showData,
      showLabel: false,
      dataLabelPosition: "bestFit",
      fontFace: diagram.theme?.legend?.fontFamily || "Trebuchet MS",
      color: diagram.theme?.legend?.textColor || "333333"
    }
  );

  return pptx;
}

function buildJourneyPresentation(diagram) {
  const pptx = new PptxGenJS();
  const viewport = getFlowchartSlideMetrics(diagram);

  pptx.defineLayout({
    name: "MERMAID_JOURNEY",
    width: SLIDE_WIDTH,
    height: viewport.slideHeight
  });
  pptx.layout = "MERMAID_JOURNEY";
  pptx.author = "Codex";
  pptx.company = "OpenAI";
  pptx.subject = "Mermaid Journey Export";
  pptx.title = "Mermaid Diagram";

  const slide = pptx.addSlide();
  slide.background = { color: diagram.theme?.canvas?.background || "FFFFFF" };

  if (diagram.title?.text) {
    slide.addText(diagram.title.text, {
      x: positionToInches(diagram.title.x, viewport, "x"),
      y: positionToInches(diagram.title.y, viewport, "y"),
      w: sizeToInches(diagram.title.width, viewport.scale),
      h: sizeToInches(diagram.title.height, viewport.scale),
      fontFace: diagram.title.style.fontFamily,
      fontSize: nodeFontPxToPt(diagram.title.style.fontSize, viewport.scale),
      color: diagram.title.style.textColor,
      margin: 0,
      bold: true
    });
  }

  for (const section of diagram.sections) {
    slide.addShape("roundRect", {
      x: positionToInches(section.x, viewport, "x"),
      y: positionToInches(section.y, viewport, "y"),
      w: sizeToInches(section.width, viewport.scale),
      h: sizeToInches(section.height, viewport.scale),
      rectRadius: 0.08,
      fill: { color: section.fill },
      line: { color: section.fill, pt: 0.75 }
    });

    slide.addText(section.text, {
      x: positionToInches(section.x, viewport, "x"),
      y: positionToInches(section.y, viewport, "y"),
      w: sizeToInches(section.width, viewport.scale),
      h: sizeToInches(section.height, viewport.scale),
      fontFace: diagram.theme?.section?.fontFamily || "Trebuchet MS",
      fontSize: nodeFontPxToPt(diagram.theme?.section?.fontSize || 14, viewport.scale),
      color: section.textColor,
      margin: 0,
      align: "center",
      valign: "mid",
      bold: true
    });
  }

  for (const task of diagram.tasks) {
    slide.addShape("line", {
      x: positionToInches(task.scoreLineX, viewport, "x"),
      y: positionToInches(task.scoreLineY1, viewport, "y"),
      w: 0.001,
      h: Math.max(sizeToInches(task.scoreLineY2 - task.scoreLineY1, viewport.scale), 0.001),
      line: {
        color: diagram.theme?.score?.lineColor || "666666",
        pt: 0.8,
        dashType: "dash"
      }
    });

    slide.addShape("roundRect", {
      x: positionToInches(task.x, viewport, "x"),
      y: positionToInches(task.y, viewport, "y"),
      w: sizeToInches(task.width, viewport.scale),
      h: sizeToInches(task.height, viewport.scale),
      rectRadius: 0.08,
      fill: { color: task.fill },
      line: { color: task.fill, pt: 0.75 }
    });

    slide.addText(task.text, {
      x: positionToInches(task.x + 8, viewport, "x"),
      y: positionToInches(task.y + 8, viewport, "y"),
      w: sizeToInches(task.width - 16, viewport.scale),
      h: sizeToInches(task.height - 18, viewport.scale),
      fontFace: diagram.theme?.task?.fontFamily || "Trebuchet MS",
      fontSize: nodeFontPxToPt(diagram.theme?.task?.fontSize || 13, viewport.scale),
      color: task.textColor,
      margin: 0,
      align: "center",
      valign: "mid",
      fit: "shrink"
    });

    if (task.people.length) {
      slide.addText(task.people.join(", "), {
        x: positionToInches(task.x + 8, viewport, "x"),
        y: positionToInches(task.y + task.height - 15, viewport, "y"),
        w: sizeToInches(task.width - 16, viewport.scale),
        h: sizeToInches(10, viewport.scale),
        fontFace: diagram.theme?.task?.fontFamily || "Trebuchet MS",
        fontSize: nodeFontPxToPt(10, viewport.scale),
        color: task.textColor,
        margin: 0,
        align: "center"
      });
    }

    slide.addShape("ellipse", {
      x: positionToInches(task.scoreLineX - 13, viewport, "x"),
      y: positionToInches(task.scoreBubbleY - 13, viewport, "y"),
      w: sizeToInches(26, viewport.scale),
      h: sizeToInches(26, viewport.scale),
      fill: { color: diagram.theme?.score?.fill || "4F7CF7" },
      line: { color: diagram.theme?.score?.fill || "4F7CF7", pt: 0.75 }
    });

    slide.addText(String(task.score), {
      x: positionToInches(task.scoreLineX - 13, viewport, "x"),
      y: positionToInches(task.scoreBubbleY - 13, viewport, "y"),
      w: sizeToInches(26, viewport.scale),
      h: sizeToInches(26, viewport.scale),
      fontFace: diagram.theme?.task?.fontFamily || "Trebuchet MS",
      fontSize: nodeFontPxToPt(12, viewport.scale),
      color: diagram.theme?.score?.textColor || "FFFFFF",
      margin: 0,
      align: "center",
      valign: "mid",
      bold: true
    });
  }

  return pptx;
}

function buildClassPresentation(diagram) {
  const pptx = new PptxGenJS();
  const viewport = getFlowchartSlideMetrics(diagram);

  pptx.defineLayout({
    name: "MERMAID_CLASS",
    width: SLIDE_WIDTH,
    height: viewport.slideHeight
  });
  pptx.layout = "MERMAID_CLASS";
  pptx.author = "Codex";
  pptx.company = "OpenAI";
  pptx.subject = "Mermaid Class Diagram Export";
  pptx.title = "Mermaid Diagram";

  const slide = pptx.addSlide();
  slide.background = { color: diagram.theme?.canvas?.background || "FFFFFF" };

  for (const node of diagram.nodes) {
    addClassNode(slide, node, viewport);
  }

  for (const edge of diagram.edges) {
    addEdge(slide, edge, viewport);
  }

  return pptx;
}

function buildErPresentation(diagram) {
  const pptx = new PptxGenJS();
  const viewport = getFlowchartSlideMetrics(diagram);

  pptx.defineLayout({
    name: "MERMAID_ER",
    width: SLIDE_WIDTH,
    height: viewport.slideHeight
  });
  pptx.layout = "MERMAID_ER";
  pptx.author = "Codex";
  pptx.company = "OpenAI";
  pptx.subject = "Mermaid ER Diagram Export";
  pptx.title = "Mermaid Diagram";

  const slide = pptx.addSlide();
  slide.background = { color: diagram.theme?.canvas?.background || "FFFFFF" };

  for (const node of diagram.nodes) {
    addErNode(slide, node, viewport);
  }

  for (const edge of diagram.edges) {
    addEdge(slide, edge, viewport);
  }

  return pptx;
}

function buildStatePresentation(diagram) {
  const pptx = new PptxGenJS();
  const viewport = getFlowchartSlideMetrics(diagram);

  pptx.defineLayout({
    name: "MERMAID_STATE",
    width: SLIDE_WIDTH,
    height: viewport.slideHeight
  });
  pptx.layout = "MERMAID_STATE";
  pptx.author = "Codex";
  pptx.company = "OpenAI";
  pptx.subject = "Mermaid State Diagram Export";
  pptx.title = "Mermaid Diagram";

  const slide = pptx.addSlide();
  slide.background = { color: diagram.theme?.canvas?.background || "FFFFFF" };

  for (const group of diagram.groups ?? []) {
    addStateGroup(slide, group, viewport);
  }

  for (const edge of diagram.edges) {
    addEdge(slide, edge, viewport);
  }

  for (const node of diagram.nodes) {
    addStateNode(slide, node, viewport);
  }

  for (const note of diagram.notes ?? []) {
    addStateNote(slide, note, viewport);
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
        beginArrowType: index === 0 ? edge.style.startArrow || "none" : "none",
        endArrowType: isLastSegment ? edge.style.endArrow || "none" : "none"
      }
    });
  }

  addEdgeTextLabel(slide, edge.label, viewport);
  addEdgeTextLabel(slide, edge.startLabel, viewport);
  addEdgeTextLabel(slide, edge.endLabel, viewport);
}

function addEdgeTextLabel(slide, label, viewport) {
  if (label?.text) {
    const textStyle = resolveTextStyle(label.text, label.style.fontFamily);
    slide.addText(label.text, {
      x: positionToInches(label.x, viewport, "x"),
      y: positionToInches(label.y, viewport, "y"),
      w: sizeToInches(label.width, viewport.scale),
      h: sizeToInches(label.height, viewport.scale),
      fontFace: textStyle.fontFace,
      lang: textStyle.lang,
      fontSize: edgeFontPxToPt(label.style.fontSize, viewport.scale),
      color: label.style.textColor,
      align: "center",
      valign: "mid",
      margin: 0,
      fit: "shrink",
      lineSpacingMultiple: 1.0,
      fill: label.style.fill ? { color: label.style.fill, transparency: 12 } : undefined,
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
        beginArrowType: index === 0 ? message.style.startArrow || "none" : "none",
        endArrowType: isLastSegment ? message.style.endArrow || "none" : "none"
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

function addClassNode(slide, node, viewport) {
  const x = positionToInches(node.x, viewport, "x");
  const y = positionToInches(node.y, viewport, "y");
  const w = sizeToInches(node.width, viewport.scale);
  const h = sizeToInches(node.height, viewport.scale);

  slide.addShape("rect", {
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

  for (const section of node.sections) {
    addStructuredSectionText(slide, {
      x: node.x,
      y: node.y + section.yOffset,
      width: node.width,
      height: section.height,
      lines: section.lines,
      fontFamily: node.style.fontFamily,
      fontSize: section.fontSize,
      textColor: node.style.textColor,
      bold: section.bold,
      italic: section.italic,
      align: section.align
    }, viewport);

    if (section !== node.sections[0]) {
      slide.addShape("line", {
        x: positionToInches(node.x, viewport, "x"),
        y: positionToInches(node.y + section.yOffset, viewport, "y"),
        w: sizeToInches(node.width, viewport.scale),
        h: 0.001,
        line: {
          color: node.style.stroke,
          pt: pxToPt(node.style.strokeWidth, viewport.scale)
        }
      });
    }
  }
}

function addErNode(slide, node, viewport) {
  const x = positionToInches(node.x, viewport, "x");
  const y = positionToInches(node.y, viewport, "y");
  const w = sizeToInches(node.width, viewport.scale);
  const headerHeight = sizeToInches(node.headerHeight, viewport.scale);

  slide.addShape("rect", {
    x,
    y,
    w,
    h: sizeToInches(node.height, viewport.scale),
    fill: { color: node.style.bodyFill },
    line: {
      color: node.style.stroke,
      pt: pxToPt(node.style.strokeWidth, viewport.scale)
    }
  });

  slide.addShape("rect", {
    x,
    y,
    w,
    h: headerHeight,
    fill: { color: node.style.fill },
    line: {
      color: node.style.stroke,
      pt: pxToPt(node.style.strokeWidth, viewport.scale)
    }
  });

  addStructuredSectionText(slide, {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.headerHeight,
    lines: [node.title],
    fontFamily: node.style.fontFamily,
    fontSize: node.style.fontSize,
    textColor: node.style.textColor,
    bold: true,
    italic: false,
    align: "center"
  }, viewport);

  for (const [index, row] of node.rows.entries()) {
    addStructuredSectionText(slide, {
      x: node.x,
      y: node.y + node.headerHeight + index * node.rowHeight,
      width: node.width,
      height: node.rowHeight,
      lines: [row],
      fontFamily: node.style.fontFamily,
      fontSize: Math.max(12, node.style.fontSize - 4),
      textColor: node.style.textColor,
      bold: false,
      italic: false,
      align: "left"
    }, viewport);
  }
}

function addStructuredSectionText(slide, section, viewport) {
  const text = section.lines.join("\n");
  const textStyle = resolveTextStyle(text, section.fontFamily);

  slide.addText(text, {
    x: positionToInches(section.x + (section.align === "left" ? 8 : 0), viewport, "x"),
    y: positionToInches(section.y, viewport, "y"),
    w: sizeToInches(section.width - (section.align === "left" ? 16 : 0), viewport.scale),
    h: sizeToInches(section.height, viewport.scale),
    fontFace: textStyle.fontFace,
    lang: textStyle.lang,
    fontSize: nodeFontPxToPt(section.fontSize, viewport.scale),
    color: section.textColor,
    margin: 0,
    bold: Boolean(section.bold),
    italic: Boolean(section.italic),
    align: section.align === "left" ? "left" : "center",
    valign: "mid",
    fit: "shrink",
    lineSpacingMultiple: 1.0,
    line: { color: "FFFFFF", transparency: 100 }
  });
}

function addStateGroup(slide, group, viewport) {
  const x = positionToInches(group.x, viewport, "x");
  const y = positionToInches(group.y, viewport, "y");
  const w = sizeToInches(group.width, viewport.scale);
  const h = sizeToInches(group.height, viewport.scale);
  const titleHeight = sizeToInches(group.titleHeight, viewport.scale);

  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: group.style.bodyFill, transparency: 2 },
    line: {
      color: group.style.stroke,
      pt: pxToPt(group.style.strokeWidth, viewport.scale)
    }
  });

  slide.addShape("roundRect", {
    x,
    y,
    w,
    h: titleHeight,
    rectRadius: 0.08,
    fill: { color: group.style.fill },
    line: {
      color: group.style.stroke,
      pt: pxToPt(group.style.strokeWidth, viewport.scale)
    }
  });

  addStructuredSectionText(slide, {
    x: group.x,
    y: group.y,
    width: group.width,
    height: group.titleHeight,
    lines: [group.label || group.id],
    fontFamily: group.style.fontFamily,
    fontSize: group.style.fontSize,
    textColor: group.style.textColor,
    bold: true,
    italic: false,
    align: "center"
  }, viewport);
}

function addStateNote(slide, note, viewport) {
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

  addStructuredSectionText(slide, {
    x: note.x,
    y: note.y,
    width: note.width,
    height: note.height,
    lines: note.text.split("\n"),
    fontFamily: note.style.fontFamily,
    fontSize: note.style.fontSize,
    textColor: note.style.textColor,
    bold: false,
    italic: false,
    align: "left"
  }, viewport);
}

function addStateNode(slide, node, viewport) {
  switch (node.type) {
    case "start":
      slide.addShape("ellipse", {
        x: positionToInches(node.x, viewport, "x"),
        y: positionToInches(node.y, viewport, "y"),
        w: sizeToInches(node.width, viewport.scale),
        h: sizeToInches(node.height, viewport.scale),
        fill: { color: node.style.fill },
        line: { color: node.style.stroke, pt: pxToPt(node.style.strokeWidth, viewport.scale) }
      });
      return;
    case "end":
      slide.addShape("ellipse", {
        x: positionToInches(node.x, viewport, "x"),
        y: positionToInches(node.y, viewport, "y"),
        w: sizeToInches(node.width, viewport.scale),
        h: sizeToInches(node.height, viewport.scale),
        fill: { color: node.style.innerFill || "FFFFFF" },
        line: { color: node.style.stroke, pt: pxToPt(node.style.strokeWidth, viewport.scale) }
      });
      slide.addShape("ellipse", {
        x: positionToInches(node.x + 5, viewport, "x"),
        y: positionToInches(node.y + 5, viewport, "y"),
        w: sizeToInches(node.width - 10, viewport.scale),
        h: sizeToInches(node.height - 10, viewport.scale),
        fill: { color: node.style.stroke },
        line: { color: node.style.stroke, pt: pxToPt(node.style.strokeWidth, viewport.scale) }
      });
      return;
    case "choice":
      slide.addShape("diamond", {
        x: positionToInches(node.x, viewport, "x"),
        y: positionToInches(node.y, viewport, "y"),
        w: sizeToInches(node.width, viewport.scale),
        h: sizeToInches(node.height, viewport.scale),
        fill: { color: node.style.fill },
        line: { color: node.style.stroke, pt: pxToPt(node.style.strokeWidth, viewport.scale) }
      });
      if (node.label) {
        addStructuredSectionText(slide, {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          lines: [node.label],
          fontFamily: node.style.fontFamily,
          fontSize: Math.max(12, node.style.fontSize - 2),
          textColor: node.style.textColor,
          bold: true,
          italic: false,
          align: "center"
        }, viewport);
      }
      return;
    case "fork":
    case "join":
      slide.addShape("rect", {
        x: positionToInches(node.x, viewport, "x"),
        y: positionToInches(node.y, viewport, "y"),
        w: sizeToInches(node.width, viewport.scale),
        h: sizeToInches(node.height, viewport.scale),
        fill: { color: node.style.fill },
        line: { color: node.style.stroke, pt: pxToPt(node.style.strokeWidth, viewport.scale) }
      });
      return;
    default:
      slide.addShape("roundRect", {
        x: positionToInches(node.x, viewport, "x"),
        y: positionToInches(node.y, viewport, "y"),
        w: sizeToInches(node.width, viewport.scale),
        h: sizeToInches(node.height, viewport.scale),
        rectRadius: 0.08,
        fill: { color: node.style.fill },
        line: {
          color: node.style.stroke,
          pt: pxToPt(node.style.strokeWidth, viewport.scale)
        }
      });

      if (node.descriptionHeight > 0) {
        slide.addShape("line", {
          x: positionToInches(node.x, viewport, "x"),
          y: positionToInches(node.y + node.titleHeight, viewport, "y"),
          w: sizeToInches(node.width, viewport.scale),
          h: 0.001,
          line: {
            color: node.style.stroke,
            pt: pxToPt(node.style.strokeWidth, viewport.scale)
          }
        });
      }

      addStructuredSectionText(slide, {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.titleHeight || node.height,
        lines: [node.label || node.id],
        fontFamily: node.style.fontFamily,
        fontSize: node.style.fontSize,
        textColor: node.style.textColor,
        bold: true,
        italic: false,
        align: "center"
      }, viewport);

      if (node.descriptionHeight > 0) {
        addStructuredSectionText(slide, {
          x: node.x,
          y: node.y + node.titleHeight,
          width: node.width,
          height: node.descriptionHeight,
          lines: node.descriptions ?? [],
          fontFamily: node.style.fontFamily,
          fontSize: Math.max(12, node.style.fontSize - 4),
          textColor: node.style.textColor,
          bold: false,
          italic: false,
          align: "center"
        }, viewport);
      }
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
