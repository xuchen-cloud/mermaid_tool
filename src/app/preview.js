let mermaidInstance = null;

async function ensureMermaid() {
  if (!mermaidInstance) {
    const mod = await import("../../node_modules/mermaid/dist/mermaid.esm.min.mjs");
    mermaidInstance = mod.default || mod;
  }
  return mermaidInstance;
}
import { getVisiblePieSections } from "../ppt/pie/layout.js";
import { app } from "./context.js";
import {
  defaultPreviewDimensions,
  previewWheelZoomStep,
  sampleCode
} from "./constants.js";
import { createDefaultPreviewCompareState } from "./state.js";
import {
  isMermaidDocumentKind,
  normalizeError,
  t,
  updateStatus,
  updateStatusByKey
} from "./common.js";
import { isEditableElement } from "./utils.js";

export function initializePreviewModule() {
  app.dom.zoomInButton.addEventListener("click", () => adjustPreviewScale(0.1));
  app.dom.zoomOutButton.addEventListener("click", () => adjustPreviewScale(-0.1));
  app.dom.zoomFitButton.addEventListener("click", () => resetPreviewScale());
  app.dom.previewBeforeZoomOutButton.addEventListener("click", () => adjustComparePreviewScale("before", -0.1));
  app.dom.previewBeforeZoomFitButton.addEventListener("click", () => resetComparePreviewScale("before"));
  app.dom.previewBeforeZoomInButton.addEventListener("click", () => adjustComparePreviewScale("before", 0.1));
  app.dom.previewAfterZoomOutButton.addEventListener("click", () => adjustComparePreviewScale("after", -0.1));
  app.dom.previewAfterZoomFitButton.addEventListener("click", () => resetComparePreviewScale("after"));
  app.dom.previewAfterZoomInButton.addEventListener("click", () => adjustComparePreviewScale("after", 0.1));
  app.dom.previewFrame.addEventListener("mouseenter", () => {
    app.state.previewIsHovered = true;
    syncPreviewPanMode();
    updatePreviewPanCursor();
  });
  app.dom.previewFrame.addEventListener("mouseleave", () => {
    app.state.previewIsHovered = false;
    syncPreviewPanMode();
    updatePreviewPanCursor();
  });
  app.dom.previewFrame.addEventListener("mousedown", (event) => handlePreviewPanStart(event));
  app.dom.previewFrame.addEventListener("mousemove", (event) => handlePreviewPanMove(event));
  app.dom.previewFrame.addEventListener("click", (event) => handlePreviewSelectionClick(event));
  app.dom.previewBody.addEventListener("mousedown", () => {
    app.dom.previewFrame.focus({ preventScroll: true });
  });
  app.dom.previewFrame.addEventListener("wheel", (event) => handlePreviewWheel(event), {
    passive: false
  });

  for (const button of [
    app.dom.zoomInButton,
    app.dom.zoomOutButton,
    app.dom.zoomFitButton,
    app.dom.previewBeforeZoomOutButton,
    app.dom.previewBeforeZoomFitButton,
    app.dom.previewBeforeZoomInButton,
    app.dom.previewAfterZoomOutButton,
    app.dom.previewAfterZoomFitButton,
    app.dom.previewAfterZoomInButton
  ]) {
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      app.dom.previewFrame.focus({ preventScroll: true });
    });
  }

  window.addEventListener("mouseup", () => stopPreviewPanning());
  window.addEventListener("keydown", (event) => handlePreviewFrameKeydown(event));
  window.addEventListener("keyup", (event) => handlePreviewFrameKeyup(event));
  window.addEventListener("resize", () => {
    if (app.dom.preview.classList.contains("is-visible") || app.dom.previewCompare.classList.contains("is-visible")) {
      applyPreviewScale();
    }
  });

  app.modules.preview = {
    scheduleRender,
    renderSampleIfIdle,
    resetPreviewSurface,
    clearPreviewSourceSelection,
    applyPreviewSourceSelection,
    serializeSvg,
    serializeSvgFromContainer,
    getPrimaryPreviewContainer,
    getPrimaryPreviewSvgElement,
    getSvgSize,
    buildExportableSvg,
    fitPreviewToFrame,
    applyPreviewTheme,
    getRasterBackgroundColor,
    renderDiagram,
    resetPreviewScale,
    shouldShowComparePreview
  };
}

export function renderSampleIfIdle() {
  if (!app.state.currentWorkspace.rootPath && !app.modules.editor?.getVisibleMermaidSource?.().trim()) {
    void renderDiagram(sampleCode, app.state.currentMermaidConfig);
  }
}

export function scheduleRender() {
  if (!isMermaidDocumentKind(app.state.currentDocument.kind)) {
    resetPreviewSurface();
    app.modules.export?.setExportButtonsDisabled?.(true);
    return;
  }

  const source = getPreviewRenderSource();
  if (!source.trim()) {
    resetPreviewSurface();
    app.modules.export?.setExportButtonsDisabled?.(true);
    updateStatusByKey("idle", "status.readyBadge", "status.startMessage");
    app.state.currentMermaidDocument = null;
    app.state.previewSourceMap = null;
    return;
  }

  updateStatusByKey("rendering", "status.renderingBadge", "status.renderingMessage");
  window.clearTimeout(app.state.timers.render);
  app.state.timers.render = window.setTimeout(async () => {
    try {
      await renderDiagram(source, app.state.currentMermaidConfig);
    } catch (error) {
      app.state.latestSvg = "";
      app.modules.export?.setExportButtonsDisabled?.(true);
      updateStatus("error", t("status.configErrorBadge"), normalizeError(error));
    }
  }, 220);
}

export async function renderDiagram(source, mermaidConfig) {
  const compareSources = getPreviewCompareSources(source);
  if (compareSources) {
    await renderCompareDiagram(compareSources, mermaidConfig);
    return;
  }

  try {
    const rendered = await renderMermaidMarkup(source, mermaidConfig, "mermaid");
    const { dimensions } = mountRenderedSvg(app.dom.preview, rendered);
    app.state.latestSvgDimensions = { ...dimensions };
    app.state.latestSvg = serializeSvg();
    app.state.currentMermaidDocument = app.documentCache.resolve(source);
    app.state.previewSourceMap = app.state.currentMermaidDocument;
    annotatePreviewSourceMap(app.state.currentMermaidDocument);
    app.state.previewCompareState = createDefaultPreviewCompareState();
    app.dom.previewCompare.hidden = true;
    app.dom.previewCompare.classList.remove("is-visible");
    app.dom.previewCompare.removeAttribute("data-layout");
    app.dom.previewBefore.innerHTML = "";
    app.dom.previewAfter.innerHTML = "";
    renderPreviewCompareUiState();
    app.dom.preview.classList.add("is-visible");
    app.dom.previewEmpty.style.display = "none";
    fitPreviewToFrame({ resetViewport: true });
    app.modules.export?.setExportButtonsDisabled?.(false);
    updateStatusByKey("success", "status.renderedBadge", "status.renderedMessage");
  } catch (error) {
    resetPreviewSurface();
    updateStatus("error", t("status.errorBadge"), normalizeError(error));
  }
}

async function renderCompareDiagram({ beforeSource, afterSource }, mermaidConfig) {
  const previousState = app.state.previewCompareState.isActive
    ? app.state.previewCompareState
    : createDefaultPreviewCompareState();
  const beforeResult = await renderPreviewVariant(
    app.dom.previewBefore,
    beforeSource,
    mermaidConfig,
    "mermaid-before"
  );
  const afterResult = await renderPreviewVariant(
    app.dom.previewAfter,
    afterSource,
    mermaidConfig,
    "mermaid-after"
  );
  const layout = choosePreviewCompareLayout(beforeResult.dimensions, afterResult.dimensions);

  app.state.latestSvg = afterResult.svg;
  app.state.latestSvgDimensions = { ...afterResult.dimensions };
  app.state.currentMermaidDocument = app.documentCache.resolve(afterSource);
  app.state.previewSourceMap = null;
  app.state.previewCompareState = {
    isActive: true,
    layout,
    before: {
      svg: beforeResult.svg,
      dimensions: { ...beforeResult.dimensions },
      error: beforeResult.error,
      scale: previousState.before.scale,
      fitScale: previousState.before.fitScale,
      autoFit: previousState.before.autoFit
    },
    after: {
      svg: afterResult.svg,
      dimensions: { ...afterResult.dimensions },
      error: afterResult.error,
      scale: previousState.after.scale,
      fitScale: previousState.after.fitScale,
      autoFit: previousState.after.autoFit
    }
  };
  app.dom.preview.innerHTML = "";
  app.dom.preview.classList.remove("is-visible");
  app.dom.previewCompare.hidden = false;
  app.dom.previewCompare.classList.add("is-visible");
  app.dom.previewCompare.dataset.layout = layout;
  renderPreviewCompareUiState();
  app.dom.previewEmpty.style.display = "none";
  fitComparePreviewToFrame({ resetViewport: true });
  app.modules.export?.setExportButtonsDisabled?.(!afterResult.svg);

  if (afterResult.error) {
    updateStatus("error", t("status.errorBadge"), afterResult.error);
    return;
  }

  updateStatusByKey("success", "status.renderedBadge", "status.renderedMessage");
}

async function renderPreviewVariant(container, source, mermaidConfig, prefix) {
  container.innerHTML = "";

  try {
    const rendered = await renderMermaidMarkup(source, mermaidConfig, prefix);
    const { dimensions } = mountRenderedSvg(container, rendered);
    return {
      svg: serializeSvgFromContainer(container),
      dimensions,
      error: ""
    };
  } catch (error) {
    container.replaceChildren(createPreviewCompareErrorElement(normalizeError(error)));
    return {
      svg: "",
      dimensions: { ...defaultPreviewDimensions },
      error: normalizeError(error)
    };
  }
}

async function renderMermaidMarkup(source, mermaidConfig, prefix) {
  if (!mermaidInstance) {
    if (app.dom.previewEmpty) {
      app.dom.previewEmpty.textContent = t("status.loadingEngine") || "Loading diagram engine...";
      app.dom.previewEmpty.style.display = "block";
      app.dom.preview.classList.remove("is-visible");
      // Allow browser to flush the paint so user can see the loading message
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  const m = await ensureMermaid();
  m.initialize(mermaidConfig);
  const id = `${prefix}-${crypto.randomUUID()}`;
  return m.render(id, source);
}

function mountRenderedSvg(container, rendered) {
  container.innerHTML = rendered.svg;
  rendered.bindFunctions?.(container);
  const svgElement = container.querySelector("svg");
  return {
    svgElement,
    dimensions: svgElement ? getSvgSize(svgElement) : { ...defaultPreviewDimensions }
  };
}

function createPreviewCompareErrorElement(message) {
  const element = document.createElement("div");
  element.className = "preview-compare-error";
  element.textContent = message;
  return element;
}

function getPreviewRenderSource() {
  return app.modules.editor?.getVisibleMermaidSource?.() ?? "";
}

function getPreviewCompareSources(source) {
  if (!shouldShowComparePreview()) {
    return null;
  }

  return {
    beforeSource: app.state.aiInlineState.sourceCode,
    afterSource: source
  };
}

export function shouldShowComparePreview() {
  return Boolean(
    isMermaidDocumentKind(app.state.currentDocument.kind) &&
      app.state.aiInlineState.isOpen &&
      app.state.aiInlineState.mode === "modify" &&
      app.state.aiInlineState.sourceCode.trim() &&
      app.modules.editor?.getActiveEditorSource?.().trim() &&
      (app.state.aiInlineState.isGenerating ||
        app.state.aiInlineState.hasUnacceptedChanges ||
        app.state.aiInlineState.model)
  );
}

function renderPreviewCompareUiState() {
  const isActive = app.state.previewCompareState.isActive;
  const hasBeforeSvg = Boolean(app.state.previewCompareState.before.svg);
  const hasAfterSvg = Boolean(app.state.previewCompareState.after.svg);

  app.dom.previewCanvasTools.hidden = isActive;
  app.dom.previewBeforeZoomOutButton.disabled = !hasBeforeSvg;
  app.dom.previewBeforeZoomFitButton.disabled = !hasBeforeSvg;
  app.dom.previewBeforeZoomInButton.disabled = !hasBeforeSvg;
  app.dom.previewAfterZoomOutButton.disabled = !hasAfterSvg;
  app.dom.previewAfterZoomFitButton.disabled = !hasAfterSvg;
  app.dom.previewAfterZoomInButton.disabled = !hasAfterSvg;

  if (app.dom.previewCompareBeforeCard) {
    app.dom.previewCompareBeforeCard.hidden = false;
  }

  if (app.dom.previewCompareAfterCard) {
    app.dom.previewCompareAfterCard.hidden = false;
  }
}

function choosePreviewCompareLayout(beforeDimensions, afterDimensions) {
  const beforeWide = beforeDimensions.width >= beforeDimensions.height;
  const afterWide = afterDimensions.width >= afterDimensions.height;
  return beforeWide && afterWide ? "rows" : "columns";
}

export function resetPreviewSurface() {
  app.state.latestSvg = "";
  app.state.latestSvgDimensions = { ...defaultPreviewDimensions };
  app.state.previewSourceMap = null;
  app.state.currentMermaidDocument = null;
  app.state.previewCompareState = createDefaultPreviewCompareState();
  app.dom.preview.innerHTML = "";
  app.dom.preview.classList.remove("is-visible");
  app.dom.previewBefore.innerHTML = "";
  app.dom.previewAfter.innerHTML = "";
  app.dom.previewCompare.hidden = true;
  app.dom.previewCompare.classList.remove("is-visible");
  app.dom.previewCompare.removeAttribute("data-layout");
  app.dom.previewEmpty.style.display = "block";
  renderPreviewCompareUiState();
}

function updatePreviewPanCursor() {
  app.dom.previewFrame.classList.toggle(
    "preview-frame-pan-ready",
    app.state.previewIsHovered && app.state.previewPanMode
  );
  app.dom.previewFrame.classList.toggle(
    "preview-frame-panning",
    Boolean(app.state.previewPanState)
  );
}

function handlePreviewFrameKeydown(event) {
  if (
    (event.key === "=" || event.key === "+" || event.key === "-" || event.key === "0") &&
    app.dom.previewBody.contains(event.target)
  ) {
    if (event.key === "=" || event.key === "+") {
      event.preventDefault();
      adjustPreviewScale(0.1);
      return;
    }

    if (event.key === "-") {
      event.preventDefault();
      adjustPreviewScale(-0.1);
      return;
    }

    event.preventDefault();
    resetPreviewScale();
    return;
  }

  if (event.code !== "Space" || isEditableElement(event.target)) {
    return;
  }

  app.state.previewSpacePressed = true;
  if (!app.state.previewIsHovered) {
    return;
  }

  event.preventDefault();
  syncPreviewPanMode();
  updatePreviewPanCursor();
}

function handlePreviewFrameKeyup(event) {
  if (event.code !== "Space") {
    return;
  }

  app.state.previewSpacePressed = false;
  app.state.previewPanMode = false;
  stopPreviewPanning();
  updatePreviewPanCursor();
}

function syncPreviewPanMode() {
  app.state.previewPanMode =
    app.state.previewIsHovered &&
    app.state.previewSpacePressed &&
    !isEditableElement(document.activeElement);
}

function handlePreviewPanStart(event) {
  app.dom.previewFrame.focus({ preventScroll: true });

  if (
    !app.state.previewPanMode ||
    event.button !== 0 ||
    event.target.closest(".preview-canvas-tools")
  ) {
    return;
  }

  event.preventDefault();
  app.state.previewPanState = {
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: app.dom.previewFrame.scrollLeft,
    scrollTop: app.dom.previewFrame.scrollTop
  };
  updatePreviewPanCursor();
}

function handlePreviewPanMove(event) {
  if (!app.state.previewPanState) {
    return;
  }

  event.preventDefault();
  app.dom.previewFrame.scrollLeft =
    app.state.previewPanState.scrollLeft - (event.clientX - app.state.previewPanState.startX);
  app.dom.previewFrame.scrollTop =
    app.state.previewPanState.scrollTop - (event.clientY - app.state.previewPanState.startY);
}

function stopPreviewPanning() {
  if (!app.state.previewPanState) {
    return;
  }

  app.state.previewPanState = null;
  updatePreviewPanCursor();
}

function handlePreviewWheel(event) {
  if (!app.state.previewIsHovered || !isPreviewWheelZoomGesture(event)) {
    return;
  }

  const direction = Math.sign(event.deltaY || event.deltaX);
  if (!direction) {
    return;
  }

  event.preventDefault();
  adjustPreviewScale(direction < 0 ? previewWheelZoomStep : -previewWheelZoomStep);
}

function isPreviewWheelZoomGesture(event) {
  return isApplePlatform() ? event.metaKey : event.ctrlKey;
}

function isApplePlatform() {
  const platform = navigator.userAgentData?.platform ?? navigator.platform ?? "";
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

function handlePreviewSelectionClick(event) {
  if (!(event.target instanceof Element) || app.state.previewPanState || app.state.aiInlineState.isOpen) {
    return;
  }

  const selection = resolvePreviewSourceSelection(event.target);
  if (!selection) {
    clearPreviewSourceSelection();
    return;
  }

  applyPreviewSourceSelection(selection, { scrollIntoView: true });
}

function resolvePreviewSourceSelection(target) {
  const sourceMap = app.state.previewSourceMap;
  if (!sourceMap) {
    return null;
  }

  const annotatedElement = target.closest("[data-source-kind]");
  if (!annotatedElement) {
    return null;
  }

  switch (annotatedElement.dataset.sourceKind) {
    case "flowchart-node":
      return buildFlowchartNodeSelection(annotatedElement.dataset.sourceKey);
    case "flowchart-edge":
      return buildFlowchartEdgeSelection(
        annotatedElement.dataset.sourceFrom,
        annotatedElement.dataset.sourceTo
      );
    case "sequence-participant":
      return buildSequenceParticipantSelection(annotatedElement.dataset.sourceKey);
    case "sequence-message":
      return buildSequenceMessageSelection(Number.parseInt(annotatedElement.dataset.sourceIndex ?? "", 10));
    case "sequence-note":
      return buildSequenceNoteSelection(Number.parseInt(annotatedElement.dataset.sourceIndex ?? "", 10));
    case "pie-section":
      return buildPieSectionSelection(annotatedElement.dataset.sourceKey);
    case "journey-section":
      return buildJourneySectionSelection(annotatedElement.dataset.sourceKey);
    case "journey-task":
      return buildJourneyTaskSelection(annotatedElement.dataset.sourceKey);
    case "class-node":
      return buildClassNodeSelection(annotatedElement.dataset.sourceKey);
    case "class-edge":
      return buildClassEdgeSelection(Number.parseInt(annotatedElement.dataset.sourceIndex ?? "", 10));
    case "er-node":
      return buildErNodeSelection(annotatedElement.dataset.sourceKey);
    case "er-edge":
      return buildErEdgeSelection(Number.parseInt(annotatedElement.dataset.sourceIndex ?? "", 10));
    case "state-node":
      return buildStateNodeSelection(annotatedElement.dataset.sourceKey);
    case "state-note":
      return buildStateNoteSelection(annotatedElement.dataset.sourceKey);
    case "state-group":
      return buildStateGroupSelection(annotatedElement.dataset.sourceKey);
    case "state-edge":
      return buildStateEdgeSelection(Number.parseInt(annotatedElement.dataset.sourceIndex ?? "", 10));
    default:
      return null;
  }
}

function annotatePreviewSourceMap(sourceMap) {
  if (!sourceMap) {
    return;
  }

  if (sourceMap.type === "flowchart") {
    annotateFlowchartPreviewSourceMap(sourceMap.parsed);
    return;
  }

  if (sourceMap.type === "sequence") {
    annotateSequencePreviewSourceMap(sourceMap.parsed);
    return;
  }

  if (sourceMap.type === "pie") {
    annotatePiePreviewSourceMap(sourceMap.parsed);
    return;
  }

  if (sourceMap.type === "journey") {
    annotateJourneyPreviewSourceMap(sourceMap.parsed);
    return;
  }

  if (sourceMap.type === "class") {
    annotateClassPreviewSourceMap(sourceMap.parsed);
    return;
  }

  if (sourceMap.type === "er") {
    annotateErPreviewSourceMap(sourceMap.parsed);
    return;
  }

  if (sourceMap.type === "state") {
    annotateStatePreviewSourceMap(sourceMap.parsed);
  }
}

function annotateFlowchartPreviewSourceMap(parsed) {
  for (const nodeElement of app.dom.preview.querySelectorAll("g.node[id]")) {
    const nodeId = resolveFlowchartNodeKey(nodeElement, parsed);
    if (!nodeId) {
      continue;
    }

    annotatePreviewElement(nodeElement, { kind: "flowchart-node", key: nodeId });
    annotatePreviewElement(nodeElement.querySelector(".nodeLabel, .label"), {
      kind: "flowchart-node",
      key: nodeId
    });
  }

  for (const edgePath of app.dom.preview.querySelectorAll("path.flowchart-link")) {
    const edgeInfo = extractFlowchartEdgeInfo(edgePath);
    if (!edgeInfo) {
      continue;
    }

    annotatePreviewElement(edgePath, {
      kind: "flowchart-edge",
      from: edgeInfo.from,
      to: edgeInfo.to
    });
  }

  for (const edgeLabel of app.dom.preview.querySelectorAll(".edgeLabel")) {
    const edgeId = edgeLabel.querySelector(".label[data-id]")?.getAttribute("data-id");
    if (!edgeId) {
      continue;
    }

    const edgePath = app.dom.preview.querySelector(`path.flowchart-link#${CSS.escape(edgeId)}`);
    const edgeInfo = edgePath ? extractFlowchartEdgeInfo(edgePath) : null;
    if (!edgeInfo) {
      continue;
    }

    annotatePreviewElement(edgeLabel, {
      kind: "flowchart-edge",
      from: edgeInfo.from,
      to: edgeInfo.to
    });
  }
}

function annotateSequencePreviewSourceMap(parsed) {
  for (const namedElement of app.dom.preview.querySelectorAll("[name]")) {
    const participantId = resolveSequenceParticipantKey(namedElement.getAttribute("name"), parsed);
    if (!participantId) {
      continue;
    }

    annotatePreviewElement(namedElement, {
      kind: "sequence-participant",
      key: participantId
    });
    annotatePreviewElement(namedElement.parentElement, {
      kind: "sequence-participant",
      key: participantId
    });
  }

  const messageEvents = parsed.events.filter((event) => event.type === "message");
  const messageLines = Array.from(app.dom.preview.querySelectorAll(".messageLine0, .messageLine1"));
  const messageTexts = Array.from(app.dom.preview.querySelectorAll(".messageText"));

  for (const [index] of messageEvents.entries()) {
    annotatePreviewIndexedElement(messageLines[index], "sequence-message", index);
    annotatePreviewIndexedElement(messageTexts[index], "sequence-message", index);
  }

  const noteEvents = parsed.events.filter((event) => event.type === "note");
  const noteRects = Array.from(app.dom.preview.querySelectorAll("rect.note"));
  const noteTexts = Array.from(app.dom.preview.querySelectorAll(".noteText"));

  for (const [index] of noteEvents.entries()) {
    annotatePreviewIndexedElement(noteRects[index], "sequence-note", index);
    annotatePreviewIndexedElement(noteTexts[index], "sequence-note", index);
    annotatePreviewIndexedElement(noteRects[index]?.parentElement, "sequence-note", index);
  }
}

function annotatePiePreviewSourceMap(parsed) {
  const visibleSections = getVisiblePieSections(parsed);
  const slicePaths = Array.from(app.dom.preview.querySelectorAll("path.pieCircle"));
  const sliceTexts = Array.from(app.dom.preview.querySelectorAll("text.slice"));
  const legends = Array.from(app.dom.preview.querySelectorAll("g.legend"));

  for (const [index, section] of visibleSections.entries()) {
    annotatePreviewElement(slicePaths[index], { kind: "pie-section", key: section.id });
    annotatePreviewElement(sliceTexts[index], { kind: "pie-section", key: section.id });
  }

  for (const [index, section] of parsed.sections.entries()) {
    annotatePreviewElement(legends[index], { kind: "pie-section", key: section.id });
  }
}

function annotateJourneyPreviewSourceMap(parsed) {
  const sections = Array.from(app.dom.preview.querySelectorAll("rect.journey-section"));
  const tasks = Array.from(app.dom.preview.querySelectorAll("rect.task"));

  for (const [index, section] of parsed.sections.entries()) {
    const element = sections[index];
    annotatePreviewElement(element, { kind: "journey-section", key: section.id });
    annotatePreviewElement(element?.parentElement, {
      kind: "journey-section",
      key: section.id
    });
  }

  for (const [index, task] of parsed.tasks.entries()) {
    const element = tasks[index];
    annotatePreviewElement(element, { kind: "journey-task", key: task.id });
    annotatePreviewElement(element?.parentElement, { kind: "journey-task", key: task.id });
  }
}

function annotateClassPreviewSourceMap(parsed) {
  const nodeElements = Array.from(app.dom.preview.querySelectorAll("g.node, g.classGroup"));

  for (const element of nodeElements) {
    const nodeId = resolveClassNodeKey(element, parsed);
    if (!nodeId) {
      continue;
    }

    annotatePreviewElement(element, { kind: "class-node", key: nodeId });
    annotatePreviewElement(element.querySelector(".label, .nodeLabel, foreignObject, text"), {
      kind: "class-node",
      key: nodeId
    });
  }

  const relationPaths = Array.from(app.dom.preview.querySelectorAll("path.relation"));
  const relationLabels = Array.from(app.dom.preview.querySelectorAll(".edgeLabel"));

  for (const [index, path] of relationPaths.entries()) {
    annotatePreviewIndexedElement(path, "class-edge", index);
  }

  for (const [index, label] of relationLabels.entries()) {
    annotatePreviewIndexedElement(label, "class-edge", index);
  }
}

function annotateErPreviewSourceMap(parsed) {
  const nodeElements = Array.from(app.dom.preview.querySelectorAll("g.node"));

  for (const element of nodeElements) {
    const nodeId = resolveErNodeKey(element, parsed);
    if (!nodeId) {
      continue;
    }

    annotatePreviewElement(element, { kind: "er-node", key: nodeId });
    annotatePreviewElement(element.querySelector(".entityBox, foreignObject, text"), {
      kind: "er-node",
      key: nodeId
    });
  }

  const relationPaths = Array.from(app.dom.preview.querySelectorAll("path.relationshipLine"));
  const relationLabels = Array.from(app.dom.preview.querySelectorAll(".edgeLabel"));

  for (const [index, path] of relationPaths.entries()) {
    annotatePreviewIndexedElement(path, "er-edge", index);
  }

  for (const [index, label] of relationLabels.entries()) {
    annotatePreviewIndexedElement(label, "er-edge", index);
  }
}

function annotateStatePreviewSourceMap(parsed) {
  const groupElements = Array.from(app.dom.preview.querySelectorAll("g.cluster"));
  const noteElements = Array.from(app.dom.preview.querySelectorAll("g.node.statediagram-note"));
  const stateElements = Array.from(
    app.dom.preview.querySelectorAll("g.node.statediagram-state, g.node")
  ).filter((element) => !element.classList.contains("statediagram-note"));
  const stateNodes = parsed.states.filter((node) => node.type !== "group");
  const groups = parsed.states.filter((node) => node.type === "group");

  for (const [index, element] of stateElements.entries()) {
    const node = stateNodes[index];
    if (!node) {
      continue;
    }
    annotatePreviewElement(element, { kind: "state-node", key: node.id });
  }

  for (const [index, element] of noteElements.entries()) {
    const note = parsed.notes[index];
    if (!note) {
      continue;
    }
    annotatePreviewElement(element, { kind: "state-note", key: note.id });
  }

  for (const [index, element] of groupElements.entries()) {
    const group = groups[index];
    if (!group) {
      continue;
    }
    annotatePreviewElement(element, { kind: "state-group", key: group.id });
  }

  const edgePaths = Array.from(app.dom.preview.querySelectorAll("path.transition"));
  const edgeLabels = Array.from(app.dom.preview.querySelectorAll(".edgeLabel"));

  for (const [index, element] of edgePaths.entries()) {
    if (parsed.edges[index]) {
      annotatePreviewIndexedElement(element, "state-edge", index);
    }
  }

  for (const [index, element] of edgeLabels.entries()) {
    if (parsed.edges[index]) {
      annotatePreviewIndexedElement(element, "state-edge", index);
    }
  }
}

function annotatePreviewElement(element, options) {
  if (!(element instanceof Element)) {
    return;
  }

  element.dataset.sourceKind = options.kind;
  if (options.key) {
    element.dataset.sourceKey = options.key;
  }
  if (options.from) {
    element.dataset.sourceFrom = options.from;
  }
  if (options.to) {
    element.dataset.sourceTo = options.to;
  }
}

function annotatePreviewIndexedElement(element, kind, index) {
  if (!(element instanceof Element)) {
    return;
  }
  element.dataset.sourceKind = kind;
  element.dataset.sourceIndex = String(index);
}

function resolveFlowchartNodeKey(nodeElement, parsed) {
  if (!(nodeElement instanceof Element)) {
    return null;
  }

  const rawIdCandidates = [nodeElement.getAttribute("data-id"), nodeElement.getAttribute("id")]
    .map((value) => value?.trim())
    .filter(Boolean);

  for (const candidate of rawIdCandidates) {
    const directMatch = parsed.nodes.find((node) => node.id === candidate);
    if (directMatch) {
      return directMatch.id;
    }

    const suffixMatch = parsed.nodes.find(
      (node) => candidate.endsWith(`-${node.id}`) || candidate.includes(`-${node.id}-`)
    );
    if (suffixMatch) {
      return suffixMatch.id;
    }
  }

  const labelText = normalizePreviewText(
    nodeElement.querySelector(".nodeLabel, .label")?.textContent ?? ""
  );
  if (!labelText) {
    return null;
  }

  const matches = parsed.nodes.filter(
    (node) => normalizePreviewText(node.text) === labelText
  );
  return matches.length === 1 ? matches[0].id : null;
}

function extractFlowchartEdgeInfo(edgePath) {
  if (!(edgePath instanceof Element)) {
    return null;
  }

  const fromClass = [...edgePath.classList].find((value) => value.startsWith("LS-"));
  const toClass = [...edgePath.classList].find((value) => value.startsWith("LE-"));

  if (!fromClass || !toClass) {
    return null;
  }

  return {
    from: fromClass.slice(3),
    to: toClass.slice(3)
  };
}

function resolveSequenceParticipantKey(rawValue, parsed) {
  if (!rawValue) {
    return null;
  }

  const participant = parsed.participants.find(
    (item) => item.id === rawValue || item.text === rawValue
  );
  return participant?.id ?? null;
}

function resolveClassNodeKey(nodeElement, parsed) {
  if (!(nodeElement instanceof Element)) {
    return null;
  }

  const rawIdCandidates = [nodeElement.getAttribute("data-id"), nodeElement.getAttribute("id")]
    .map((value) => value?.trim())
    .filter(Boolean);

  for (const candidate of rawIdCandidates) {
    const directMatch = parsed.nodes.find((node) => node.id === candidate);
    if (directMatch) {
      return directMatch.id;
    }
  }

  const text = normalizePreviewText(nodeElement.textContent ?? "");
  if (!text) {
    return null;
  }

  const matches = parsed.nodes.filter((node) => {
    const title = normalizePreviewText(node.title ?? node.id);
    return title && text.includes(title);
  });
  return matches.length === 1 ? matches[0].id : null;
}

function resolveErNodeKey(nodeElement, parsed) {
  if (!(nodeElement instanceof Element)) {
    return null;
  }

  const text = normalizePreviewText(nodeElement.textContent ?? "");
  if (!text) {
    return null;
  }

  const matches = parsed.nodes.filter((node) => {
    const title = normalizePreviewText(node.title ?? node.id);
    return title && text.includes(title);
  });
  return matches.length === 1 ? matches[0].id : null;
}

function getPreviewSourceMapForType(type) {
  return app.state.previewSourceMap?.type === type ? app.state.previewSourceMap.parsed : null;
}

function buildFlowchartNodeSelection(nodeId) {
  const parsed = getPreviewSourceMapForType("flowchart");
  const node = parsed?.nodes.find((item) => item.id === nodeId);
  return createPreviewSelection(node?.sourceLines ?? []);
}

function buildFlowchartEdgeSelection(from, to) {
  const parsed = getPreviewSourceMapForType("flowchart");
  if (!parsed || !from || !to) {
    return null;
  }

  const lines = new Set();
  for (const edge of parsed.edges) {
    if (edge.from === from && edge.to === to) {
      addLineRange(lines, edge.lineStart, edge.lineEnd);
    }
  }
  return createPreviewSelection(lines);
}

function buildSequenceParticipantSelection(participantId) {
  const parsed = getPreviewSourceMapForType("sequence");
  if (!parsed || !participantId) {
    return null;
  }

  const participant = parsed.participants.find((item) => item.id === participantId);
  const lines = new Set(participant?.sourceLines ?? []);
  for (const event of parsed.events) {
    if (sequenceEventIncludesParticipant(event, participantId)) {
      addLineRange(lines, event.lineStart, event.lineEnd);
    }
  }
  return createPreviewSelection(lines);
}

function buildSequenceMessageSelection(index) {
  const parsed = getPreviewSourceMapForType("sequence");
  if (!parsed || !Number.isInteger(index)) {
    return null;
  }

  const messages = parsed.events.filter((event) => event.type === "message");
  const target = messages[index];
  if (!target) {
    return null;
  }

  const lines = new Set();
  for (const message of messages) {
    if (message.from === target.from && message.to === target.to && message.text === target.text) {
      addLineRange(lines, message.lineStart, message.lineEnd);
    }
  }
  return createPreviewSelection(lines);
}

function buildSequenceNoteSelection(index) {
  const parsed = getPreviewSourceMapForType("sequence");
  if (!parsed || !Number.isInteger(index)) {
    return null;
  }

  const notes = parsed.events.filter((event) => event.type === "note");
  const target = notes[index];
  if (!target) {
    return null;
  }

  const targetKey = buildSequenceNoteKey(target);
  const lines = new Set();
  for (const note of notes) {
    if (buildSequenceNoteKey(note) === targetKey) {
      addLineRange(lines, note.lineStart, note.lineEnd);
    }
  }
  return createPreviewSelection(lines);
}

function buildPieSectionSelection(sectionId) {
  const parsed = getPreviewSourceMapForType("pie");
  const section = parsed?.sections.find((item) => item.id === sectionId);
  return section ? createPreviewSelection([section.lineStart]) : null;
}

function buildJourneySectionSelection(sectionId) {
  const parsed = getPreviewSourceMapForType("journey");
  if (!parsed || !sectionId) {
    return null;
  }

  const section = parsed.sections.find((item) => item.id === sectionId);
  if (!section) {
    return null;
  }

  const lines = new Set(section.sourceLines ?? []);
  for (const task of parsed.tasks) {
    if (task.sectionId === sectionId) {
      addLineRange(lines, task.lineStart, task.lineEnd);
    }
  }
  return createPreviewSelection(lines);
}

function buildJourneyTaskSelection(taskId) {
  const parsed = getPreviewSourceMapForType("journey");
  const task = parsed?.tasks.find((item) => item.id === taskId);
  return task ? createPreviewSelection([task.lineStart]) : null;
}

function buildClassNodeSelection(nodeId) {
  const parsed = getPreviewSourceMapForType("class");
  const node = parsed?.nodes.find((item) => item.id === nodeId);
  return createPreviewSelection(node?.sourceLines ?? []);
}

function buildClassEdgeSelection(index) {
  const parsed = getPreviewSourceMapForType("class");
  const edge = Number.isInteger(index) ? parsed?.edges[index] : null;
  return edge ? createPreviewSelection([edge.lineStart]) : null;
}

function buildErNodeSelection(nodeId) {
  const parsed = getPreviewSourceMapForType("er");
  const node = parsed?.nodes.find((item) => item.id === nodeId);
  return createPreviewSelection(node?.sourceLines ?? []);
}

function buildErEdgeSelection(index) {
  const parsed = getPreviewSourceMapForType("er");
  const edge = Number.isInteger(index) ? parsed?.edges[index] : null;
  return edge ? createPreviewSelection([edge.lineStart]) : null;
}

function buildStateNodeSelection(nodeId) {
  const parsed = getPreviewSourceMapForType("state");
  const node = parsed?.states.find((item) => item.id === nodeId);
  return createPreviewSelection(node?.sourceLines ?? []);
}

function buildStateNoteSelection(noteId) {
  const parsed = getPreviewSourceMapForType("state");
  const note = parsed?.notes.find((item) => item.id === noteId);
  if (!note) {
    return null;
  }

  const lines = new Set();
  addLineRange(lines, note.lineStart, note.lineEnd);
  return createPreviewSelection(lines);
}

function buildStateGroupSelection(groupId) {
  const parsed = getPreviewSourceMapForType("state");
  const group = parsed?.states.find((item) => item.id === groupId && item.type === "group");
  if (!group) {
    return null;
  }

  const lines = new Set(group.sourceLines ?? []);
  addLineRange(lines, group.lineStart, group.lineEnd);
  return createPreviewSelection(lines);
}

function buildStateEdgeSelection(index) {
  const parsed = getPreviewSourceMapForType("state");
  const edge = Number.isInteger(index) ? parsed?.edges[index] : null;
  return edge ? createPreviewSelection([edge.lineStart]) : null;
}

function normalizePreviewText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

function buildSequenceNoteKey(note) {
  return `${note.placement}|${[...(note.targets ?? [])].sort().join(",")}|${note.text}`;
}

function sequenceEventIncludesParticipant(event, participantId) {
  if (event.type === "message") {
    return event.from === participantId || event.to === participantId;
  }
  if (event.type === "note") {
    return event.targets?.includes(participantId);
  }
  if (event.type === "activate" || event.type === "deactivate") {
    return event.participant === participantId;
  }
  return false;
}

function createPreviewSelection(lines) {
  const normalizedLines = [...new Set([...lines].filter((line) => Number.isInteger(line) && line > 0))].sort(
    (left, right) => left - right
  );
  if (!normalizedLines.length) {
    return null;
  }

  return {
    lines: normalizedLines,
    primaryLine: normalizedLines[0]
  };
}

function addLineRange(target, lineStart, lineEnd = lineStart) {
  if (!Number.isInteger(lineStart) || !Number.isInteger(lineEnd)) {
    return;
  }

  for (let line = lineStart; line <= lineEnd; line += 1) {
    target.add(line);
  }
}

export function clearPreviewSourceSelection(options = {}) {
  app.state.previewHighlightedLines = new Set();
  app.state.previewPrimaryHighlightedLine = null;

  if (options.render !== false) {
    app.modules.editor?.renderHighlightedCode?.();
  }
}

export function applyPreviewSourceSelection(selection, options = {}) {
  app.state.previewHighlightedLines = new Set(selection.lines);
  app.state.previewPrimaryHighlightedLine =
    selection.primaryLine ?? selection.lines[0] ?? null;
  app.modules.editor?.renderHighlightedCode?.();

  if (options.scrollIntoView && app.state.previewPrimaryHighlightedLine !== null) {
    app.modules.editor?.getCodeEditor?.()?.scrollToLine(app.state.previewPrimaryHighlightedLine);
  }
}

function adjustPreviewScale(delta) {
  app.state.previewAutoFit = false;
  app.state.previewScale = Math.min(
    5,
    Math.max(0.5, Number((app.state.previewScale + delta).toFixed(2)))
  );
  applyPreviewScale();
}

function adjustComparePreviewScale(targetKey, delta) {
  if (!app.state.previewCompareState.isActive || !app.state.previewCompareState[targetKey]) {
    return;
  }

  const currentItem = app.state.previewCompareState[targetKey];
  app.state.previewCompareState = {
    ...app.state.previewCompareState,
    [targetKey]: {
      ...currentItem,
      autoFit: false,
      scale: Math.min(5, Math.max(0.5, Number((currentItem.scale + delta).toFixed(2))))
    }
  };
  applyPreviewScale();
}

export function resetPreviewScale() {
  app.state.previewAutoFit = true;
  app.state.previewScale = 1;
  applyPreviewScale({ resetViewport: true });
}

function resetComparePreviewScale(targetKey) {
  if (!app.state.previewCompareState.isActive || !app.state.previewCompareState[targetKey]) {
    return;
  }

  app.state.previewCompareState = {
    ...app.state.previewCompareState,
    [targetKey]: {
      ...app.state.previewCompareState[targetKey],
      autoFit: true,
      scale: 1
    }
  };
  applyPreviewScale({ resetViewport: true });
}

export function fitPreviewToFrame(options = {}) {
  app.state.previewAutoFit = true;
  app.state.previewScale = 1;
  applyPreviewScale(options);
}

function fitComparePreviewToFrame(options = {}) {
  if (!app.state.previewCompareState.isActive) {
    return;
  }

  app.state.previewCompareState = {
    ...app.state.previewCompareState,
    before: {
      ...app.state.previewCompareState.before,
      autoFit: true,
      scale: 1
    },
    after: {
      ...app.state.previewCompareState.after,
      autoFit: true,
      scale: 1
    }
  };
  applyPreviewScale(options);
}

function applyPreviewScale(options = {}) {
  let primarySvgElement = null;

  if (app.state.previewCompareState.isActive) {
    const hasCompareSvg = Boolean(
      app.dom.previewBefore.querySelector("svg") || app.dom.previewAfter.querySelector("svg")
    );
    if (!hasCompareSvg) {
      return;
    }
  } else {
    primarySvgElement = getPrimaryPreviewSvgElement();
    if (!primarySvgElement) {
      return;
    }
  }

  if (app.state.previewCompareState.isActive) {
    applyComparePreviewScale();
  } else {
    app.state.previewFitScale = calculatePreviewFitScale();
    const effectiveScale = app.state.previewFitScale * app.state.previewScale;
    primarySvgElement.style.width = `${Math.round(app.state.latestSvgDimensions.width * effectiveScale)}px`;
    primarySvgElement.style.height = "auto";
  }

  if (options.resetViewport) {
    app.dom.previewFrame.scrollLeft = 0;
    app.dom.previewFrame.scrollTop = 0;
  }
}

function calculatePreviewFitScale() {
  const availableWidth = Math.max(
    120,
    app.dom.previewFrame.clientWidth - getFrameHorizontalPadding()
  );
  const availableHeight = Math.max(
    120,
    app.dom.previewFrame.clientHeight - getFrameVerticalPadding()
  );

  return Math.max(
    0.05,
    Math.min(
      availableWidth / app.state.latestSvgDimensions.width,
      availableHeight / app.state.latestSvgDimensions.height
    )
  );
}

function applyComparePreviewScale() {
  applyComparePreviewScaleForItem("before", app.dom.previewBefore);
  applyComparePreviewScaleForItem("after", app.dom.previewAfter);
}

function applyComparePreviewScaleForItem(targetKey, container) {
  const svgElement = container.querySelector("svg");
  if (!svgElement) {
    return;
  }

  const itemState = app.state.previewCompareState[targetKey];
  const fitScale = calculateCompareItemFitScale(targetKey, container);
  const effectiveScale = itemState.autoFit ? fitScale : fitScale * itemState.scale;

  app.state.previewCompareState = {
    ...app.state.previewCompareState,
    [targetKey]: {
      ...itemState,
      fitScale
    }
  };
  svgElement.style.width = `${Math.round(itemState.dimensions.width * effectiveScale)}px`;
  svgElement.style.height = "auto";
}

function calculateCompareItemFitScale(targetKey, container) {
  const itemState = app.state.previewCompareState[targetKey];
  const cardBody = container.closest(".preview-compare-card-body");
  if (!itemState || !cardBody) {
    return 1;
  }

  const availableWidth = Math.max(120, cardBody.clientWidth);
  const availableHeight = Math.max(120, cardBody.clientHeight);
  return Math.max(
    0.05,
    Math.min(
      availableWidth / Math.max(1, itemState.dimensions.width),
      availableHeight / Math.max(1, itemState.dimensions.height)
    )
  );
}

function getFrameHorizontalPadding() {
  const styles = window.getComputedStyle(app.dom.previewFrame);
  return (
    Number.parseFloat(styles.paddingLeft || "0") +
    Number.parseFloat(styles.paddingRight || "0")
  );
}

function getFrameVerticalPadding() {
  const styles = window.getComputedStyle(app.dom.previewFrame);
  return (
    Number.parseFloat(styles.paddingTop || "0") +
    Number.parseFloat(styles.paddingBottom || "0")
  );
}

export function applyPreviewTheme(pptTheme) {
  app.dom.previewFrame.style.backgroundColor = `#${pptTheme.canvas.background}`;
}

export function getRasterBackgroundColor() {
  return `#${app.state.currentPptTheme.canvas.background}`;
}

export function serializeSvg() {
  return serializeSvgFromContainer(getPrimaryPreviewContainer());
}

export function serializeSvgFromContainer(container) {
  const svgElement = container?.querySelector?.("svg");
  return svgElement ? new XMLSerializer().serializeToString(svgElement) : "";
}

export function getPrimaryPreviewContainer() {
  return app.state.previewCompareState.isActive ? app.dom.previewAfter : app.dom.preview;
}

export function getPrimaryPreviewSvgElement() {
  return getPrimaryPreviewContainer().querySelector("svg");
}

export function getSvgSize(svgElement) {
  const viewBox = svgElement.viewBox?.baseVal;
  if (viewBox?.width && viewBox?.height) {
    return { width: viewBox.width, height: viewBox.height };
  }

  const width = Number.parseFloat(svgElement.getAttribute("width")) || 1200;
  const height = Number.parseFloat(svgElement.getAttribute("height")) || 800;
  return { width, height };
}

export function buildExportableSvg(svgElement, width, height, backgroundColor) {
  const clone = svgElement.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  if (backgroundColor) {
    const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute("width", String(width));
    background.setAttribute("height", String(height));
    background.setAttribute("fill", backgroundColor);
    clone.insertBefore(background, clone.firstChild);
  }

  return new XMLSerializer().serializeToString(clone);
}
