import { createCodeEditorAdapter } from "../editor/cm-editor.js";
import { createDrawioHost } from "../drawio/drawio-host.js";
import { buildUnifiedDiffModel } from "../ai-utils.js";
import { app } from "./context.js";
import {
  editorIndentUnit,
  sampleCode,
  editorFontSizeStorageKey,
  editorPaneWidthStorageKey
} from "./constants.js";
import {
  getCurrentDocumentTitle,
  getDocumentNameBase,
  getDocumentSuffixForKind,
  getDesktopApiOrThrow,
  isDrawioDocumentKind,
  isMermaidDocumentKind,
  normalizeError,
  renderDocumentState,
  setCurrentDocument,
  t,
  updateStatus,
  updateStatusByKey
} from "./common.js";

let codeEditor = null;

function syncCachedEditorSelection(selection) {
  const { codeInput } = app.dom;
  try {
    codeInput.setSelectionRange(selection.start ?? 0, selection.end ?? selection.start ?? 0);
  } catch {
    codeInput.selectionStart = selection.start ?? 0;
    codeInput.selectionEnd = selection.end ?? selection.start ?? 0;
  }

  updateCursorStatus();
}

function handleEditorValueChange(nextValue) {
  app.dom.codeInput.value = nextValue;
  app.modules.preview?.clearPreviewSourceSelection({ render: false });
  updateCursorStatus();

  if (app.state.aiInlineState.isOpen) {
    app.modules.ai?.handleAiInlineEditorInput?.();
    return;
  }

  markDocumentDirty();
  renderHighlightedCode();
  app.modules.ai?.renderAiActionButton?.();
  scheduleAutoSave();
  app.modules.preview?.scheduleRender?.();
}

function initializeEditorAdapter() {
  codeEditor = createCodeEditorAdapter(app.dom.codeEditorHost, {
    initialValue: app.dom.codeInput.value,
    fontSize: app.state.editorFontSize,
    onChange: (nextValue) => handleEditorValueChange(nextValue),
    onSelectionChange: (selection) => syncCachedEditorSelection(selection),
    onBlur: () => {
      void autoSaveCurrentDocumentIfPossible();
    },
    onKeydown: (event) => handleEditorKeydown(event)
  });
}

export function initializeEditorModule() {
  app.dom.codeInput.value = sampleCode;
  initializeEditorAdapter();
  applyEditorFontSize();
  applyEditorPaneWidth();
  updateEditorDocumentNameWidth();

  app.dom.editorDocumentName.addEventListener("input", () => updateEditorDocumentNameWidth());
  app.dom.paneDivider.addEventListener("mousedown", (event) => handlePaneResizeStart(event));
  app.dom.editorDocumentName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      app.dom.editorDocumentName.blur();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      app.dom.editorDocumentName.value = getDocumentNameBase(app.state.currentDocument.name);
      app.dom.editorDocumentName.blur();
    }
  });

  window.addEventListener("mousemove", (event) => handlePaneResizeMove(event));
  window.addEventListener("mouseup", () => stopPaneResize());

  app.modules.editor = {
    getCodeEditor: () => codeEditor,
    getActiveEditorSource,
    getVisibleMermaidSource,
    getCommittedEditorSource,
    getEditorSelectionRange,
    setEditorSelectionRange,
    setEditorValue,
    focusEditor,
    renderHighlightedCode,
    updateCursorStatus,
    renderDocumentMode,
    updateEditorDocumentNameWidth,
    autoSaveCurrentDocumentIfPossible,
    scheduleAutoSave,
    ensureDrawioEditor,
    replaceEditorCode,
    applyEditorFontSize,
    applyEditorPaneWidth
  };
}

export function updateCursorStatus() {
  if (!codeEditor) {
    updateCursorStatusForElement(app.dom.codeInput);
    return;
  }

  const selection = codeEditor.getSelection();
  const cursorIndex = selection.end ?? selection.start ?? 0;
  const beforeCursor = getActiveEditorSource().slice(0, cursorIndex);
  const lines = beforeCursor.split("\n");
  const line = lines.length;
  const column = (lines[lines.length - 1]?.length ?? 0) + 1;
  app.dom.cursorStatus.textContent = t("cursor.position", { line, column });
}

function updateCursorStatusForElement(inputElement) {
  const cursorIndex = inputElement.selectionStart ?? 0;
  const beforeCursor = inputElement.value.slice(0, cursorIndex);
  const lines = beforeCursor.split("\n");
  const line = lines.length;
  const column = (lines[lines.length - 1]?.length ?? 0) + 1;
  app.dom.cursorStatus.textContent = t("cursor.position", { line, column });
}

export function renderHighlightedCode() {
  if (!codeEditor) {
    return;
  }

  let diffModel = null;

  if (app.state.aiInlineState.isOpen && app.state.aiInlineState.mode === "modify") {
    diffModel = buildUnifiedDiffModel(
      app.state.aiInlineState.sourceCode,
      getActiveEditorSource()
    );
  }

  codeEditor.setDecorations({
    diffModel,
    highlightedLines: [...app.state.previewHighlightedLines],
    primaryHighlightedLine: app.state.previewPrimaryHighlightedLine
  });
}

export function getVisibleMermaidSource() {
  return isMermaidDocumentKind(app.state.currentDocument.kind) ? getActiveEditorSource() : "";
}

export function getCommittedEditorSource() {
  return app.state.aiInlineState.isOpen ? app.state.aiInlineState.sourceCode : getVisibleMermaidSource();
}

export function getActiveEditorSource() {
  return codeEditor?.getValue() ?? app.dom.codeInput.value ?? "";
}

export function getEditorSelectionRange() {
  if (!codeEditor) {
    return {
      start: app.dom.codeInput.selectionStart ?? 0,
      end: app.dom.codeInput.selectionEnd ?? app.dom.codeInput.selectionStart ?? 0
    };
  }

  return codeEditor.getSelection();
}

export function setEditorSelectionRange(start, end = start) {
  if (codeEditor) {
    codeEditor.setSelection(start, end);
    return;
  }

  app.dom.codeInput.setSelectionRange(start, end);
}

export function setEditorValue(nextValue, options = {}) {
  const normalizedValue = String(nextValue ?? "");
  app.dom.codeInput.value = normalizedValue;

  if (codeEditor) {
    codeEditor.setValue(normalizedValue, options);
  } else if (options.selection) {
    app.dom.codeInput.setSelectionRange(options.selection.start ?? 0, options.selection.end ?? 0);
  }
}

export function focusEditor(options = {}) {
  if (codeEditor) {
    codeEditor.focus(options);
    return;
  }

  app.dom.codeInput.focus(options);
}

export function applyEditorFontSize() {
  codeEditor?.setFontSize(app.state.editorFontSize);
}

export function applyEditorPaneWidth() {
  app.dom.workspaceMain.style.setProperty("--editor-pane-width", `${app.state.editorPaneWidth}px`);
}

function handleEditorKeydown(event) {
  if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  event.preventDefault();
  if (event.shiftKey) {
    outdentEditorSelection();
  } else {
    indentEditorSelection();
  }
}

function indentEditorSelection() {
  const value = getActiveEditorSource();
  const selection = getEditorSelectionRange();
  const selectionStart = selection.start ?? 0;
  const selectionEnd = selection.end ?? selectionStart;

  if (selectionStart === selectionEnd) {
    const nextValue = `${value.slice(0, selectionStart)}${editorIndentUnit}${value.slice(selectionEnd)}`;
    setEditorValue(nextValue, {
      selection: {
        start: selectionStart + editorIndentUnit.length,
        end: selectionStart + editorIndentUnit.length
      }
    });
    handleEditorValueChange(nextValue);
    return;
  }

  const range = getEditorSelectedLineRange(value, selectionStart, selectionEnd);
  const lines = range.text.split("\n");
  const nextText = lines.map((line) => `${editorIndentUnit}${line}`).join("\n");
  const nextValue = `${value.slice(0, range.lineStart)}${nextText}${value.slice(range.lineEnd)}`;
  const nextSelectionStart = selectionStart + editorIndentUnit.length;
  const nextSelectionEnd = selectionEnd + editorIndentUnit.length * lines.length;

  setEditorValue(nextValue, {
    selection: {
      start: nextSelectionStart,
      end: nextSelectionEnd
    }
  });
  handleEditorValueChange(nextValue);
}

function outdentEditorSelection() {
  const value = getActiveEditorSource();
  const selection = getEditorSelectionRange();
  const selectionStart = selection.start ?? 0;
  const selectionEnd = selection.end ?? selectionStart;
  const range = getEditorSelectedLineRange(value, selectionStart, selectionEnd);
  const lines = range.text.split("\n");

  let removedBeforeSelectionStart = 0;
  let removedBeforeSelectionEnd = 0;
  const nextLines = lines.map((line, index) => {
    if (!line.startsWith(editorIndentUnit) && !line.startsWith("\t")) {
      return line;
    }

    const removed = line.startsWith(editorIndentUnit) ? editorIndentUnit.length : 1;
    if (index === 0) {
      removedBeforeSelectionStart = Math.min(removed, selectionStart - range.lineStart);
    }

    const currentLineStart = range.lineStart + lines.slice(0, index).join("\n").length + index;
    const removedForSelectionEnd = Math.min(
      removed,
      Math.min(line.length, selectionEnd - currentLineStart)
    );
    removedBeforeSelectionEnd += Math.max(0, removedForSelectionEnd);

    return line.slice(removed);
  });

  const nextText = nextLines.join("\n");
  const nextValue = `${value.slice(0, range.lineStart)}${nextText}${value.slice(range.lineEnd)}`;
  const nextSelectionStart = Math.max(range.lineStart, selectionStart - removedBeforeSelectionStart);
  const nextSelectionEnd = Math.max(nextSelectionStart, selectionEnd - removedBeforeSelectionEnd);

  setEditorValue(nextValue, {
    selection: {
      start: nextSelectionStart,
      end: nextSelectionEnd
    }
  });
  handleEditorValueChange(nextValue);
}

function getEditorSelectedLineRange(value, selectionStart, selectionEnd) {
  const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart) - 1) + 1;
  const endReference =
    selectionEnd > selectionStart && value[selectionEnd - 1] === "\n"
      ? selectionEnd - 1
      : selectionEnd;
  const lineEndIndex = value.indexOf("\n", endReference);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

  return {
    lineStart,
    lineEnd,
    text: value.slice(lineStart, lineEnd)
  };
}

function handlePaneResizeStart(event) {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  const bounds = app.dom.workspaceMain.getBoundingClientRect();
  app.state.paneResizeState = {
    startX: event.clientX,
    startWidth: app.state.editorPaneWidth,
    bounds
  };
  app.dom.workspaceMain.classList.add("workspace-main-resizing");
}

function handlePaneResizeMove(event) {
  if (!app.state.paneResizeState) {
    return;
  }

  const minEditorWidth = 320;
  const bounds = app.dom.workspaceMain.getBoundingClientRect();
  const sidebarWidth = app.state.workspaceSidebarCollapsed ? 56 : 272;
  const maxEditorWidth = Math.max(
    minEditorWidth,
    bounds.width - sidebarWidth - 360
  );
  const nextWidth = app.state.paneResizeState.startWidth + (event.clientX - app.state.paneResizeState.startX);
  app.state.editorPaneWidth = Math.min(maxEditorWidth, Math.max(minEditorWidth, Math.round(nextWidth)));
  applyEditorPaneWidth();
  app.modules.preview?.fitPreviewToFrame?.();
}

function stopPaneResize() {
  if (!app.state.paneResizeState) {
    return;
  }

  app.state.paneResizeState = null;
  app.dom.workspaceMain.classList.remove("workspace-main-resizing");
  window.localStorage.setItem(editorPaneWidthStorageKey, String(app.state.editorPaneWidth));
  app.modules.preview?.fitPreviewToFrame?.({ resetViewport: true });
}

export function updateEditorDocumentNameWidth() {
  const value = app.dom.editorDocumentName.value || "";
  const styles = window.getComputedStyle(app.dom.editorDocumentName);
  if (!app.state.editorDocumentNameMeasureContext) {
    app.state.editorDocumentNameMeasureContext = document.createElement("canvas").getContext("2d");
  }

  const font = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
  if (app.state.editorDocumentNameMeasureContext) {
    app.state.editorDocumentNameMeasureContext.font = font;
  }
  const measuredWidth = app.state.editorDocumentNameMeasureContext
    ? app.state.editorDocumentNameMeasureContext.measureText(value || " ").width
    : value.length * 8;

  const horizontalPadding =
    Number.parseFloat(styles.paddingLeft || "0") +
    Number.parseFloat(styles.paddingRight || "0") +
    4;
  const nextWidth = Math.min(360, Math.max(20, Math.ceil(measuredWidth + horizontalPadding)));
  app.dom.editorDocumentName.style.width = `${nextWidth}px`;
}

function markDocumentDirty() {
  if (!app.state.currentDocument.dirty) {
    setCurrentDocument({ dirty: true });
  }
}

export function renderDocumentMode() {
  const drawioMode = isDrawioDocumentKind(app.state.currentDocument.kind);
  app.dom.workspaceMain.classList.toggle("workspace-main-drawio", drawioMode);
  app.dom.codeEditorShell.hidden = drawioMode;
  app.dom.drawioShell.hidden = !drawioMode;
  app.dom.previewBody.parentElement.hidden = drawioMode;
  app.dom.copyCodeButton.hidden = drawioMode;
  app.dom.copyClipboardButton.hidden = drawioMode;
  app.dom.exportButton.hidden = drawioMode;

  if (drawioMode) {
    ensureDrawioEditor();
    app.modules.preview?.resetPreviewSurface?.();
    app.modules.preview?.clearPreviewSourceSelection?.({ render: false });
  } else {
    app.state.drawioEditor?.hide();
  }

  app.dom.editorDocumentSuffix.textContent = getDocumentSuffixForKind(app.state.currentDocument.kind);
}

export function ensureDrawioEditor() {
  if (app.state.drawioEditor || !app.dom.drawioHost) {
    return app.state.drawioEditor;
  }

  app.state.drawioEditor = createDrawioHost({
    mountNode: app.dom.drawioHost,
    onSave: ({ filePath, xml }) => persistDrawioXml(filePath, xml),
    onLoaded: () => {
      if (isDrawioDocumentKind(app.state.currentDocument.kind)) {
        updateStatusByKey("idle", "status.readyBadge", "status.drawioReady");
      }
    },
    onError: (error) => {
      updateStatus("error", t("status.fileErrorBadge"), normalizeError(error));
    }
  });

  return app.state.drawioEditor;
}

export async function persistDrawioXml(filePath, xml) {
  const api = getDesktopApiOrThrow(["writeTextFile"]);
  await api.writeTextFile({
    filePath,
    text: String(xml ?? "")
  });

  if (app.state.currentDocument.path === filePath && isDrawioDocumentKind(app.state.currentDocument.kind)) {
    setCurrentDocument({ dirty: false });
    updateStatusByKey("success", "status.savedBadge", "status.drawioSaved");
  }
}

export function scheduleAutoSave() {
  if (app.state.aiInlineState.isOpen || !isMermaidDocumentKind(app.state.currentDocument.kind)) {
    return;
  }

  window.clearTimeout(app.state.timers.autoSave);
  app.state.timers.autoSave = window.setTimeout(() => {
    void autoSaveCurrentDocumentIfPossible();
  }, 260);
}

export async function autoSaveCurrentDocumentIfPossible() {
  window.clearTimeout(app.state.timers.autoSave);

  if (app.state.aiInlineState.isOpen) {
    return;
  }

  if (isDrawioDocumentKind(app.state.currentDocument.kind)) {
    await app.state.drawioEditor?.flush();
    return;
  }

  if (isMermaidDocumentKind(app.state.currentDocument.kind) && app.state.currentDocument.path && app.state.currentDocument.dirty) {
    const api = getDesktopApiOrThrow(["writeTextFile"]);
    const targetPath = app.state.currentDocument.path;
    const text = `${getCommittedEditorSource().replace(/\s*$/, "")}\n`;
    await api.writeTextFile({
      filePath: targetPath,
      text
    });

    if (app.state.currentDocument.path === targetPath && `${getCommittedEditorSource().replace(/\s*$/, "")}\n` === text) {
      setCurrentDocument({ dirty: false });
    }
  }
}

export function replaceEditorCode(nextCode) {
  if (!isMermaidDocumentKind(app.state.currentDocument.kind)) {
    return;
  }

  setEditorValue(`${String(nextCode ?? "").replace(/\s*$/u, "")}\n`, { silent: true });
  app.modules.preview?.clearPreviewSourceSelection?.({ render: false });
  markDocumentDirty();
  renderHighlightedCode();
  updateCursorStatus();
  app.modules.ai?.renderAiActionButton?.();
  app.modules.preview?.scheduleRender?.();
}

export function saveEditorFontSize(fontSize) {
  app.state.editorFontSize = fontSize;
  window.localStorage.setItem(editorFontSizeStorageKey, String(fontSize));
  applyEditorFontSize();
}
