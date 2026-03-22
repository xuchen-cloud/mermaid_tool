import mermaid from "../node_modules/mermaid/dist/mermaid.esm.min.mjs";
import {
  buildPptThemeFromMermaidConfig,
  createDefaultMermaidConfig,
  normalizeMermaidConfig,
  parseMermaidConfigText,
  resolveOfficialTheme,
  stringifyMermaidConfig
} from "./mermaid-config.js";

const sampleCode = `flowchart TD
    A[Collect ideas] --> B{Need export?}
    B -->|SVG| C[Save vector output]
    B -->|PNG/JPG| D[Rasterize from SVG]
    C --> E[Share diagram]
    D --> E
`;

const codeInput = document.querySelector("#code-input");
const codeHighlight = document.querySelector("#code-highlight");
const codeEditorShell = document.querySelector(".code-editor-shell");
const projectsButton = document.querySelector("#projects-button");
const settingsButton = document.querySelector("#settings-button");
const workspaceRefreshButton = document.querySelector("#workspace-refresh");
const workspaceRootName = document.querySelector("#workspace-root-name");
const workspaceTree = document.querySelector("#workspace-tree");
const workspaceEmpty = document.querySelector("#workspace-empty");
const workspaceContextMenu = document.querySelector("#workspace-context-menu");
const contextNewFileButton = document.querySelector("#context-new-file");
const contextNewFolderButton = document.querySelector("#context-new-folder");
const contextRenameButton = document.querySelector("#context-rename");
const contextDeleteButton = document.querySelector("#context-delete");
const newDocumentButton = document.querySelector("#new-document");
const copyCodeButton = document.querySelector("#copy-code");
const preview = document.querySelector("#preview");
const previewBody = document.querySelector(".preview-body");
const previewFrame = document.querySelector("#preview-frame");
const previewEmpty = document.querySelector("#preview-empty");
const statusBadge = document.querySelector("#status-badge");
const statusText = document.querySelector("#status-text");
const cursorStatus = document.querySelector("#cursor-status");
const copyClipboardButton = document.querySelector("#copy-clipboard");
const exportButton = document.querySelector("#export-button");
const exportMenu = document.querySelector("#export-menu");
const exportPptxButton = document.querySelector("#export-pptx");
const exportSvgButton = document.querySelector("#export-svg");
const exportPngButton = document.querySelector("#export-png");
const exportJpgButton = document.querySelector("#export-jpg");
const zoomInButton = document.querySelector("#zoom-in");
const zoomOutButton = document.querySelector("#zoom-out");
const zoomFitButton = document.querySelector("#zoom-fit");
const topbarWorkspacePath = document.querySelector("#topbar-workspace-path");
const editorDocumentName = document.querySelector("#editor-document-name");
const settingsModal = document.querySelector("#settings-modal");
const settingsBackdrop = document.querySelector("#settings-backdrop");
const settingsCloseButton = document.querySelector("#settings-close");
const settingsCancelButton = document.querySelector("#settings-cancel");
const settingsSaveButton = document.querySelector("#settings-save");
const settingsThemeSelect = document.querySelector("#settings-theme-select");
const themeModeOfficialButton = document.querySelector("#theme-mode-official");
const themeModeCustomButton = document.querySelector("#theme-mode-custom");
const settingsCustomPanel = document.querySelector("#settings-custom-panel");
const settingsCustomConfig = document.querySelector("#settings-custom-config");
const settingsClipboardFormat = document.querySelector("#settings-clipboard-format");
const clipboardFormatStorageKey = "mermaid-tool.clipboard-format";
const mermaidConfigStorageKey = "mermaid-tool.mermaid-config";
const mermaidThemeModeStorageKey = "mermaid-tool.theme-mode";
const workspaceRootStorageKey = "mermaid-tool.workspace-root";
const workspaceFileStorageKey = "mermaid-tool.workspace-file";
const editorFontSizeStorageKey = "mermaid-tool.editor-font-size";

let renderTimer;
let latestSvg = "";
let latestSvgDimensions = { width: 1200, height: 800 };
let currentMermaidConfig = normalizeMermaidConfig(createDefaultMermaidConfig());
let currentPptTheme = buildPptThemeFromMermaidConfig(currentMermaidConfig);
let lastValidConfigText = stringifyMermaidConfig(createDefaultMermaidConfig());
let currentDocument = createDraftDocumentState();
let currentWorkspace = createEmptyWorkspaceState();
let previewScale = 1;
let contextMenuTarget = null;
let autoSaveTimer;
let currentThemeMode = "official";
let settingsDraftThemeMode = "official";
let previewHasFocus = false;
let previewPanMode = false;
let previewPanState = null;
let inlineRenameState = null;
let editorFontSize = loadEditorFontSize();

window.addEventListener("error", (event) => {
  console.error("window error:", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("unhandled rejection:", event.reason);
});

codeInput.value = sampleCode;
initializeSettingsState();
applyEditorFontSize();
renderDocumentState();
renderHighlightedCode();
codeInput.addEventListener("input", () => {
  markDocumentDirty();
  updateCursorStatus();
  renderHighlightedCode();
  scheduleAutoSave();
  scheduleRender();
});

codeInput.addEventListener("blur", () => {
  void autoSaveCurrentDocumentIfPossible();
});

codeInput.addEventListener("keydown", (event) => handleEditorFontSizeKeydown(event));
codeInput.addEventListener("click", () => updateCursorStatus());
codeInput.addEventListener("keyup", () => updateCursorStatus());
codeInput.addEventListener("select", () => updateCursorStatus());
codeInput.addEventListener("scroll", () => syncCodeHighlightScroll());

projectsButton.addEventListener("click", () => chooseWorkspaceDirectory());
settingsButton.addEventListener("click", () => openSettingsModal());
workspaceRefreshButton.addEventListener("click", () => refreshWorkspaceTree());
newDocumentButton.addEventListener("click", () => createWorkspaceFileAtRoot());
copyCodeButton.addEventListener("click", () => copyCodeToClipboard());
editorDocumentName.addEventListener("keydown", (event) => handleEditorDocumentNameKeydown(event));
editorDocumentName.addEventListener("blur", () => {
  void renameCurrentDocumentFromInput();
});
settingsBackdrop.addEventListener("click", () => closeSettingsModal());
settingsCloseButton.addEventListener("click", () => closeSettingsModal());
settingsCancelButton.addEventListener("click", () => closeSettingsModal());
settingsSaveButton.addEventListener("click", () => void saveSettingsModal());
themeModeOfficialButton.addEventListener("click", () => setSettingsThemeMode("official"));
themeModeCustomButton.addEventListener("click", () => setSettingsThemeMode("custom"));

copyClipboardButton.addEventListener("click", () => copyRasterToClipboard());
exportButton.addEventListener("click", () => toggleExportMenu());
exportPptxButton.addEventListener("click", async () => {
  exportMenu.hidden = true;
  await exportPptx();
});
exportSvgButton.addEventListener("click", async () => {
  exportMenu.hidden = true;
  await exportSvg();
});
exportPngButton.addEventListener("click", async () => {
  exportMenu.hidden = true;
  await exportRaster("png");
});
exportJpgButton.addEventListener("click", async () => {
  exportMenu.hidden = true;
  await exportRaster("jpeg");
});
zoomInButton.addEventListener("click", () => adjustPreviewScale(0.1));
zoomOutButton.addEventListener("click", () => adjustPreviewScale(-0.1));
zoomFitButton.addEventListener("click", () => resetPreviewScale());
previewFrame.addEventListener("focus", () => {
  previewHasFocus = true;
  updatePreviewPanCursor();
});
previewFrame.addEventListener("blur", () => {
  previewHasFocus = false;
  previewPanMode = false;
  previewPanState = null;
  updatePreviewPanCursor();
});
previewFrame.addEventListener("mousedown", (event) => handlePreviewPanStart(event));
previewFrame.addEventListener("mousemove", (event) => handlePreviewPanMove(event));
previewBody.addEventListener("mousedown", () => {
  previewFrame.focus({ preventScroll: true });
});
window.addEventListener("mouseup", () => stopPreviewPanning());
previewFrame.addEventListener("keydown", (event) => handlePreviewFrameKeydown(event));
window.addEventListener("keyup", (event) => handlePreviewFrameKeyup(event));
for (const button of [zoomInButton, zoomOutButton, zoomFitButton]) {
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    previewFrame.focus({ preventScroll: true });
  });
}
contextNewFileButton.addEventListener("click", () => createWorkspaceEntryFromContext("file"));
contextNewFolderButton.addEventListener("click", () => createWorkspaceEntryFromContext("directory"));
contextRenameButton.addEventListener("click", () => void renameWorkspaceEntryFromContext());
contextDeleteButton.addEventListener("click", () => void deleteWorkspaceEntryFromContext());
workspaceTree.addEventListener("click", (event) => handleWorkspaceTreeClick(event));
workspaceTree.addEventListener("contextmenu", (event) => handleWorkspaceTreeContextMenu(event));
document.addEventListener("click", (event) => handleGlobalClick(event));

renderDiagram(sampleCode, currentMermaidConfig);
updateCursorStatus();
void initializeWorkspaceState();

window.__mermaidTool = {
  getApiKeys: () => Object.keys(window.electronAPI || {}),
  getLatestSvg: () => latestSvg,
  debugWriteRasterFromSvg: async (format) => {
    const api = getElectronApi(["debugWriteRasterFromSvg"]);
    const svgElement = preview.querySelector("svg");

    if (!svgElement) {
      throw new Error("No rendered SVG is available for debug export.");
    }

    const { width, height } = getSvgSize(svgElement);
    const svgMarkup = buildExportableSvg(
      svgElement,
      width,
      height,
      getRasterBackgroundColor()
    );

    return api.debugWriteRasterFromSvg({
      format,
      quality: 95,
      svg: svgMarkup
    });
  },
  debugCopyRasterToClipboard: async (format) => {
    const api = getElectronApi(["copyRasterFromSvg"]);
    const svgElement = preview.querySelector("svg");

    if (!svgElement) {
      throw new Error("No rendered SVG is available for debug clipboard export.");
    }

    const { width, height } = getSvgSize(svgElement);
    const svgMarkup = buildExportableSvg(
      svgElement,
      width,
      height,
      getRasterBackgroundColor()
    );

    return api.copyRasterFromSvg({
      format,
      quality: 95,
      svg: svgMarkup
    });
  },
  debugCopyRasterToClipboardFallback: async (format) => {
    const svgElement = preview.querySelector("svg");

    if (!svgElement) {
      throw new Error("No rendered SVG is available for debug clipboard fallback export.");
    }

    const { width, height } = getSvgSize(svgElement);
    const svgMarkup = buildExportableSvg(
      svgElement,
      width,
      height,
      getRasterBackgroundColor()
    );

    await copyRasterToClipboardInRenderer(svgMarkup, format, width, height);
    return { ok: true, format };
  },
  debugWritePptx: async () => {
    const api = getElectronApi(["debugWritePptxFile"]);
    const source = getSupportedSourceForPptx();
    return api.debugWritePptxFile({ source, mermaidConfig: currentMermaidConfig });
  }
};

async function renderDiagram(source, mermaidConfig) {
  try {
    mermaid.initialize(mermaidConfig);
    const id = `mermaid-${crypto.randomUUID()}`;
    const { svg, bindFunctions } = await mermaid.render(id, source);

    preview.innerHTML = svg;
    bindFunctions?.(preview);
    const svgElement = preview.querySelector("svg");
    if (svgElement) {
      latestSvgDimensions = getSvgSize(svgElement);
    }
    latestSvg = serializeSvg();
    currentMermaidConfig = mermaidConfig;
    currentPptTheme = buildPptThemeFromMermaidConfig(mermaidConfig);
    applyPreviewTheme(currentPptTheme);
    applyPreviewScale();
    preview.classList.add("is-visible");
    previewEmpty.style.display = "none";
    setExportButtonsDisabled(false);
    updateStatus("success", "Rendered", "Diagram preview is up to date.");
  } catch (error) {
    latestSvg = "";
    latestSvgDimensions = { width: 1200, height: 800 };
    preview.innerHTML = "";
    preview.classList.remove("is-visible");
    previewEmpty.style.display = "block";
    setExportButtonsDisabled(true);
    updateStatus("error", "Error", normalizeError(error));
  }
}

async function exportSvg() {
  if (!latestSvg) {
    return;
  }

  const api = getElectronApi(["saveTextFile"]);
  const result = await api.saveTextFile({
    defaultPath: `${getCurrentExportBaseName()}.svg`,
    filters: [{ name: "SVG", extensions: ["svg"] }],
    text: latestSvg
  });

  if (!result.canceled) {
    updateStatus("success", "Saved", `SVG exported to ${result.filePath}`);
  }
}

async function exportPptx() {
  try {
    const api = getElectronApi(["savePptxFile"]);
    const source = getSupportedSourceForPptx();
    const result = await api.savePptxFile({
      defaultPath: `${getCurrentExportBaseName()}.pptx`,
      filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
      source,
      mermaidConfig: currentMermaidConfig
    });

    if (!result.canceled) {
      updateStatus("success", "Saved", `PPTX exported to ${result.filePath}`);
    }
  } catch (error) {
    updateStatus("error", "PPTX error", normalizeError(error));
  }
}

async function copyCodeToClipboard() {
  try {
    await navigator.clipboard.writeText(codeInput.value);
    updateStatus("success", "Copied", "Mermaid source copied to clipboard.");
  } catch (error) {
    updateStatus("error", "Clipboard error", normalizeError(error));
  }
}

async function copyRasterToClipboard() {
  if (!latestSvg) {
    return;
  }

  const svgElement = preview.querySelector("svg");

  if (!svgElement) {
    updateStatus("error", "Clipboard error", "No rendered SVG is available for clipboard export.");
    return;
  }

  const format = loadClipboardFormat();
  const { width, height } = getSvgSize(svgElement);
  const svgMarkup = buildExportableSvg(
    svgElement,
    width,
    height,
    getRasterBackgroundColor()
  );

  try {
    const api = getElectronApi(["copyRasterFromSvg"]);
    const result = await api.copyRasterFromSvg({
      format,
      quality: 95,
      svg: svgMarkup
    });

    if (result.ok) {
      updateStatus(
        "success",
        "Copied",
        `${format.toUpperCase()} image copied to clipboard.`
      );
    }
  } catch (error) {
    if (shouldUseRendererClipboardFallback(error)) {
      try {
        await copyRasterToClipboardInRenderer(svgMarkup, format, width, height);
        updateStatus(
          "success",
          "Copied",
          `${format.toUpperCase()} image copied to clipboard.`
        );
        console.warn("Fell back to renderer clipboard copy because main handler was unavailable.");
        return;
      } catch (fallbackError) {
        updateStatus("error", "Clipboard error", normalizeError(fallbackError));
        return;
      }
    }

    updateStatus("error", "Clipboard error", normalizeError(error));
  }
}

async function exportRaster(format) {
  if (!latestSvg) {
    return;
  }

  try {
    const api = getElectronApi(["saveRasterFromSvg"]);
    const svgElement = preview.querySelector("svg");

    if (!svgElement) {
      throw new Error("No rendered SVG is available for export.");
    }

    const { width, height } = getSvgSize(svgElement);
    const svgMarkup = buildExportableSvg(
      svgElement,
      width,
      height,
      getRasterBackgroundColor()
    );
    const extension = format === "png" ? "png" : "jpg";

    const result = await api.saveRasterFromSvg({
      defaultPath: `${getCurrentExportBaseName()}.${extension}`,
      filters: [
        {
          name: format === "png" ? "PNG" : "JPG",
          extensions: [extension]
        }
      ],
      format,
      quality: 95,
      svg: svgMarkup
    });

    if (!result.canceled) {
      updateStatus(
        "success",
        "Saved",
        `${extension.toUpperCase()} exported to ${result.filePath}`
      );
    }
  } catch (error) {
    updateStatus("error", "Export error", normalizeError(error));
  }
}

function getCurrentExportBaseName() {
  if (currentDocument?.name) {
    return getDocumentNameBase(currentDocument.name) || "diagram";
  }

  return "diagram";
}

function getSvgSize(svgElement) {
  const viewBox = svgElement.viewBox?.baseVal;

  if (viewBox?.width && viewBox?.height) {
    return { width: viewBox.width, height: viewBox.height };
  }

  const width = Number.parseFloat(svgElement.getAttribute("width")) || 1200;
  const height = Number.parseFloat(svgElement.getAttribute("height")) || 800;
  return { width, height };
}

function serializeSvg() {
  const svgElement = preview.querySelector("svg");
  return new XMLSerializer().serializeToString(svgElement);
}

function buildExportableSvg(svgElement, width, height, backgroundColor) {
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

function setExportButtonsDisabled(disabled) {
  exportButton.disabled = disabled;
  copyClipboardButton.disabled = disabled;
  exportPptxButton.disabled = disabled;
  exportSvgButton.disabled = disabled;
  exportPngButton.disabled = disabled;
  exportJpgButton.disabled = disabled;
}

function scheduleRender() {
  if (!codeInput.value.trim()) {
    latestSvg = "";
    preview.innerHTML = "";
    preview.classList.remove("is-visible");
    previewEmpty.style.display = "block";
    setExportButtonsDisabled(true);
    updateStatus("idle", "Ready", "Open or create a Mermaid file to start.");
    return;
  }

  updateStatus("rendering", "Rendering", "Updating preview...");
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(async () => {
    try {
      await renderDiagram(codeInput.value, currentMermaidConfig);
    } catch (error) {
      latestSvg = "";
      setExportButtonsDisabled(true);
      updateStatus("error", "Config error", normalizeError(error));
    }
  }, 220);
}

function updateStatus(state, badgeText, message) {
  statusBadge.className = `status status-${state}`;
  statusBadge.textContent = badgeText;
  statusText.textContent = message;
}

function updateCursorStatus() {
  const cursorIndex = codeInput.selectionStart ?? 0;
  const beforeCursor = codeInput.value.slice(0, cursorIndex);
  const lines = beforeCursor.split("\n");
  const line = lines.length;
  const column = (lines[lines.length - 1]?.length ?? 0) + 1;
  cursorStatus.textContent = `Ln ${line}, Col ${column}`;
}

function updatePreviewPanCursor() {
  previewFrame.classList.toggle("preview-frame-pan-ready", previewHasFocus && previewPanMode);
  previewFrame.classList.toggle("preview-frame-panning", Boolean(previewPanState));
}

function handlePreviewFrameKeydown(event) {
  if (event.code !== "Space") {
    return;
  }

  if (!previewHasFocus) {
    return;
  }

  event.preventDefault();
  previewPanMode = true;
  updatePreviewPanCursor();
}

function handlePreviewFrameKeyup(event) {
  if (event.code !== "Space") {
    return;
  }

  previewPanMode = false;
  stopPreviewPanning();
  updatePreviewPanCursor();
}

function handlePreviewPanStart(event) {
  previewFrame.focus({ preventScroll: true });

  if (!previewPanMode || event.button !== 0 || event.target.closest(".preview-canvas-tools")) {
    return;
  }

  event.preventDefault();
  previewPanState = {
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: previewFrame.scrollLeft,
    scrollTop: previewFrame.scrollTop
  };
  updatePreviewPanCursor();
}

function handlePreviewPanMove(event) {
  if (!previewPanState) {
    return;
  }

  event.preventDefault();
  previewFrame.scrollLeft = previewPanState.scrollLeft - (event.clientX - previewPanState.startX);
  previewFrame.scrollTop = previewPanState.scrollTop - (event.clientY - previewPanState.startY);
}

function stopPreviewPanning() {
  if (!previewPanState) {
    return;
  }

  previewPanState = null;
  updatePreviewPanCursor();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function highlightInlineMermaid(line) {
  let highlighted = escapeHtml(line);

  highlighted = highlighted.replace(
    /(\|[^|\n]+\|)/g,
    '<span class="token-pipe">|</span><span class="token-label">$1</span>'
  );
  highlighted = highlighted.replace(
    /\b(flowchart|graph|sequenceDiagram|participant|actor|alt|opt|loop|else|end|note|activate|deactivate|subgraph|style|classDef|class|linkStyle)\b/g,
    '<span class="token-keyword">$1</span>'
  );
  highlighted = highlighted.replace(
    /(-->>|->>|==>|-.->|-->|---|->)/g,
    '<span class="token-arrow">$1</span>'
  );

  return highlighted.replace(
    /<span class="token-label">\|([^|\n]+)\|<\/span>/g,
    '<span class="token-pipe">|</span><span class="token-label">$1</span><span class="token-pipe">|</span>'
  );
}

function highlightMermaidCode(source) {
  return source
    .split("\n")
    .map((line) => {
      if (/^\s*(%%|\/\/)/.test(line)) {
        return `<span class="token-comment">${escapeHtml(line)}</span>`;
      }

      return highlightInlineMermaid(line);
    })
    .join("\n");
}

function renderHighlightedCode() {
  const source = codeInput.value || "";
  const html = highlightMermaidCode(source);
  codeHighlight.innerHTML = `${html}${source.endsWith("\n") ? "\n" : ""}`;
  syncCodeHighlightScroll();
}

function loadEditorFontSize() {
  const raw = Number.parseInt(window.localStorage.getItem(editorFontSizeStorageKey) ?? "", 10);
  if (!Number.isFinite(raw)) {
    return 14;
  }

  return Math.min(24, Math.max(12, raw));
}

function applyEditorFontSize() {
  codeEditorShell?.style.setProperty("--editor-font-size", `${editorFontSize}px`);
}

function handleEditorFontSizeKeydown(event) {
  if (!(event.ctrlKey || event.metaKey)) {
    return;
  }

  if (event.key === "=" || event.key === "+") {
    event.preventDefault();
    setEditorFontSize(editorFontSize + 1);
    return;
  }

  if (event.key === "-") {
    event.preventDefault();
    setEditorFontSize(editorFontSize - 1);
    return;
  }

  if (event.key === "0") {
    event.preventDefault();
    setEditorFontSize(14);
  }
}

function setEditorFontSize(nextSize) {
  const normalizedSize = Math.min(24, Math.max(12, nextSize));
  if (normalizedSize === editorFontSize) {
    return;
  }

  editorFontSize = normalizedSize;
  window.localStorage.setItem(editorFontSizeStorageKey, String(editorFontSize));
  applyEditorFontSize();
}

function syncCodeHighlightScroll() {
  codeHighlight.scrollTop = codeInput.scrollTop;
  codeHighlight.scrollLeft = codeInput.scrollLeft;
}

function getDocumentNameBase(name) {
  if (typeof name !== "string") {
    return "";
  }

  return name.toLowerCase().endsWith(".mmd") ? name.slice(0, -4) : name;
}

function getPersistedCodeText() {
  return `${codeInput.value.replace(/\s*$/, "")}\n`;
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getElectronApi(requiredMethods) {
  const api = window.electronAPI;

  if (!api) {
    throw new Error("Electron preload API is unavailable. Restart the app.");
  }

  for (const method of requiredMethods) {
    if (typeof api[method] !== "function") {
      throw new Error(
        `Electron preload API is outdated and missing "${method}". Fully quit and restart the app.`
      );
    }
  }

  return api;
}

function getSupportedSourceForPptx() {
  if (!isPptExportableSource(codeInput.value)) {
    throw new Error("PPT export currently supports Flowchart and Sequence diagrams only.");
  }

  return codeInput.value;
}

function initializeSettingsState() {
  const { text, config } = loadMermaidConfigState();
  lastValidConfigText = text;
  currentMermaidConfig = config;
  currentPptTheme = buildPptThemeFromMermaidConfig(config);
  currentThemeMode = resolveThemeMode(text, config);
  applyPreviewTheme(currentPptTheme);
}

function createDraftDocumentState() {
  return {
    name: "scratch.mmd",
    path: null,
    kind: "draft",
    dirty: false
  };
}

function createEmptyWorkspaceState() {
  return {
    rootPath: null,
    tree: null,
    expandedPaths: new Set()
  };
}

function renderDocumentState() {
  topbarWorkspacePath.textContent = currentWorkspace.rootPath
    ? currentWorkspace.rootPath
    : "No workspace selected";
  editorDocumentName.value = getDocumentNameBase(currentDocument.name);
  editorDocumentName.disabled = !(currentDocument.kind === "mermaid-file" && currentDocument.path);
}

function setCurrentDocument(nextState) {
  currentDocument = {
    ...currentDocument,
    ...nextState
  };
  if (currentDocument.path) {
    window.localStorage.setItem(workspaceFileStorageKey, currentDocument.path);
  } else {
    window.localStorage.removeItem(workspaceFileStorageKey);
  }
  renderDocumentState();
}

function markDocumentDirty() {
  if (!currentDocument.dirty) {
    setCurrentDocument({ dirty: true });
  }
}

function basename(filePath) {
  const segments = filePath.split(/[/\\]/);
  return segments[segments.length - 1] || filePath;
}

function dirname(filePath) {
  const segments = filePath.split(/[/\\]/);
  segments.pop();
  return segments.join("/") || filePath;
}

function isWorkspaceFileSelected(filePath) {
  return currentDocument.path === filePath;
}

function collectDirectoryPaths(node, paths = new Set()) {
  if (!node || node.type !== "directory") {
    return paths;
  }

  paths.add(node.path);
  for (const child of node.children ?? []) {
    if (child.type === "directory") {
      collectDirectoryPaths(child, paths);
    }
  }

  return paths;
}

function hasMmdFiles(node) {
  if (!node || node.type !== "directory") {
    return false;
  }

  for (const child of node.children ?? []) {
    if (child.type === "file") {
      return true;
    }

    if (child.type === "directory" && hasMmdFiles(child)) {
      return true;
    }
  }

  return false;
}

function renderWorkspaceState() {
  const hasWorkspace = Boolean(currentWorkspace.rootPath);
  workspaceRootName.textContent = hasWorkspace
    ? basename(currentWorkspace.rootPath)
    : "Choose a project directory";
  newDocumentButton.disabled = !hasWorkspace;
  workspaceRefreshButton.disabled = !hasWorkspace;
  workspaceTree.innerHTML = "";
  workspaceEmpty.hidden = hasWorkspace && currentWorkspace.tree && hasMmdFiles(currentWorkspace.tree);

  if (!hasWorkspace || !currentWorkspace.tree) {
    workspaceEmpty.hidden = false;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const child of currentWorkspace.tree.children ?? []) {
    fragment.appendChild(renderWorkspaceNode(child, 0));
  }
  workspaceTree.appendChild(fragment);

  if (!workspaceTree.children.length) {
    workspaceEmpty.hidden = false;
    workspaceEmpty.textContent = "No .mmd files yet. Use New File or right-click a folder.";
  } else {
    workspaceEmpty.hidden = true;
  }
}

function renderWorkspaceNode(node, depth) {
  const group = document.createElement("div");
  group.className = "tree-group";

  const isEditing = inlineRenameState?.path === node.path;
  const row = document.createElement(isEditing ? "div" : "button");
  if (!isEditing) {
    row.type = "button";
  }
  row.dataset.path = node.path;
  row.dataset.type = node.type;
  row.className = `tree-row ${node.type === "directory" ? "tree-row-directory" : "tree-row-file"}`;
  row.style.paddingLeft = `${10 + depth * 18}px`;

  if (node.type === "file" && isWorkspaceFileSelected(node.path)) {
    row.classList.add("tree-row-active");
  }

  if (node.type === "directory") {
    const expanded = currentWorkspace.expandedPaths.has(node.path);
    const caret = document.createElement("span");
    caret.className = "tree-row-caret";
    caret.textContent = expanded ? "▾" : "▸";
    row.appendChild(caret);
  } else {
    const spacer = document.createElement("span");
    spacer.className = "tree-row-spacer";
    row.appendChild(spacer);
  }

  const icon = document.createElement("span");
  icon.className = "tree-row-icon";
  icon.textContent = node.type === "directory" ? "📁" : "📄";
  row.appendChild(icon);

  if (isEditing) {
    row.classList.add("tree-row-editing");
    const editor = document.createElement("div");
    editor.className = "tree-row-inline-editor";

    const input = document.createElement("input");
    input.className = "tree-row-inline-input";
    input.type = "text";
    input.value = inlineRenameState.value;
    input.spellcheck = false;
    input.dataset.inlineRenamePath = node.path;
    input.setAttribute("aria-label", node.type === "file" ? "Rename file" : "Rename folder");
    input.addEventListener("input", (event) => {
      inlineRenameState = {
        ...inlineRenameState,
        value: event.currentTarget.value
      };
    });
    input.addEventListener("keydown", (event) => handleInlineRenameKeydown(event));
    input.addEventListener("blur", () => {
      void saveInlineRename();
    });
    editor.appendChild(input);

    if (node.type === "file") {
      const suffix = document.createElement("span");
      suffix.className = "tree-row-inline-suffix";
      suffix.textContent = ".mmd";
      editor.appendChild(suffix);
    }

    row.appendChild(editor);
  } else {
    const label = document.createElement("span");
    label.className = "tree-row-label";
    label.textContent = node.name;
    row.appendChild(label);
  }
  group.appendChild(row);

  if (node.type === "directory" && currentWorkspace.expandedPaths.has(node.path)) {
    const children = document.createElement("div");
    children.className = "tree-children";
    for (const child of node.children ?? []) {
      children.appendChild(renderWorkspaceNode(child, depth + 1));
    }
    group.appendChild(children);
  }

  return group;
}

async function initializeWorkspaceState() {
  const storedRoot = window.localStorage.getItem(workspaceRootStorageKey);
  if (!storedRoot) {
    renderWorkspaceState();
    return;
  }

  try {
    const preferredFile = window.localStorage.getItem(workspaceFileStorageKey);
    await loadWorkspace(storedRoot, preferredFile);
  } catch (error) {
    console.warn("Failed to restore workspace:", error);
    currentWorkspace = createEmptyWorkspaceState();
    renderWorkspaceState();
  }
}

async function chooseWorkspaceDirectory() {
  try {
    const api = getElectronApi(["chooseWorkspaceDirectory"]);
    await autoSaveCurrentDocumentIfPossible();
    const result = await api.chooseWorkspaceDirectory();

    if (result.canceled) {
      return;
    }

    await applyWorkspace(result.rootPath, result.tree, null);
    updateStatus("success", "Workspace", `Opened workspace ${result.rootPath}`);
  } catch (error) {
    updateStatus("error", "Workspace error", normalizeError(error));
  }
}

async function refreshWorkspaceTree() {
  if (!currentWorkspace.rootPath) {
    return;
  }

  try {
    await loadWorkspace(currentWorkspace.rootPath, currentDocument.path);
    updateStatus("success", "Workspace", "Workspace tree refreshed.");
  } catch (error) {
    updateStatus("error", "Workspace error", normalizeError(error));
  }
}

async function loadWorkspace(rootPath, preferredFilePath) {
  const api = getElectronApi(["readWorkspaceTree"]);
  const result = await api.readWorkspaceTree({ rootPath });
  await applyWorkspace(rootPath, result.tree, preferredFilePath);
}

async function applyWorkspace(rootPath, tree, preferredFilePath) {
  currentWorkspace = {
    rootPath,
    tree,
    expandedPaths: collectDirectoryPaths(tree)
  };
  window.localStorage.setItem(workspaceRootStorageKey, rootPath);
  renderWorkspaceState();

  const targetFilePath = resolveWorkspaceSelection(tree, preferredFilePath);
  if (targetFilePath) {
    await openWorkspaceFile(targetFilePath, { skipAutosave: true });
  } else {
    codeInput.value = "";
    renderHighlightedCode();
    setCurrentDocument(createDraftDocumentState());
    updateCursorStatus();
    scheduleRender();
  }
}

function resolveWorkspaceSelection(tree, preferredFilePath) {
  if (preferredFilePath && findNodeByPath(tree, preferredFilePath)) {
    return preferredFilePath;
  }

  return findFirstWorkspaceFile(tree);
}

function findFirstWorkspaceFile(node) {
  if (!node || node.type !== "directory") {
    return null;
  }

  for (const child of node.children ?? []) {
    if (child.type === "file") {
      return child.path;
    }

    if (child.type === "directory") {
      const nestedPath = findFirstWorkspaceFile(child);
      if (nestedPath) {
        return nestedPath;
      }
    }
  }

  return null;
}

function findNodeByPath(node, targetPath) {
  if (!node) {
    return null;
  }

  if (node.path === targetPath) {
    return node;
  }

  if (node.type !== "directory") {
    return null;
  }

  for (const child of node.children ?? []) {
    const match = findNodeByPath(child, targetPath);
    if (match) {
      return match;
    }
  }

  return null;
}

function toggleDirectory(path) {
  if (currentWorkspace.expandedPaths.has(path)) {
    currentWorkspace.expandedPaths.delete(path);
  } else {
    currentWorkspace.expandedPaths.add(path);
  }
  renderWorkspaceState();
}

async function handleWorkspaceTreeClick(event) {
  const row = event.target.closest(".tree-row");
  if (!row) {
    return;
  }

  if (event.target.closest(".tree-row-inline-editor")) {
    return;
  }

  workspaceContextMenu.hidden = true;
  contextMenuTarget = null;
  exportMenu.hidden = true;

  const { path, type } = row.dataset;
  if (type === "directory") {
    toggleDirectory(path);
    return;
  }

  await openWorkspaceFile(path);
}

function handleWorkspaceTreeContextMenu(event) {
  const row = event.target.closest(".tree-row");
  if (!currentWorkspace.rootPath) {
    return;
  }

  event.preventDefault();
  exportMenu.hidden = true;
  const rowPath = row?.dataset.path;
  const rowType = row?.dataset.type;
  const canMutateTarget = Boolean(rowPath);
  contextRenameButton.hidden = !canMutateTarget;
  contextDeleteButton.hidden = !canMutateTarget;
  contextMenuTarget = {
    path: rowPath ?? currentWorkspace.rootPath,
    type: rowType ?? "directory",
    parentPath:
      rowType === "file" && rowPath
        ? dirname(rowPath)
        : rowPath ?? currentWorkspace.rootPath
  };
  workspaceContextMenu.hidden = false;
  workspaceContextMenu.style.left = `${event.clientX}px`;
  workspaceContextMenu.style.top = `${event.clientY}px`;
}

function handleGlobalClick(event) {
  if (!workspaceContextMenu.hidden && !workspaceContextMenu.contains(event.target)) {
    workspaceContextMenu.hidden = true;
    contextMenuTarget = null;
  }

  if (!exportMenu.hidden && !exportMenu.contains(event.target) && event.target !== exportButton) {
    exportMenu.hidden = true;
  }
}

async function createWorkspaceFileAtRoot() {
  if (!await ensureWorkspaceSelected()) {
    return;
  }

  contextMenuTarget = {
    path: currentWorkspace.rootPath,
    type: "directory",
    parentPath: currentWorkspace.rootPath
  };
  await createWorkspaceEntryFromContext("file");
}

async function createWorkspaceEntryFromContext(kind) {
  if (!contextMenuTarget) {
    return;
  }

  workspaceContextMenu.hidden = true;
  const targetParentPath = contextMenuTarget.parentPath;
  contextMenuTarget = null;

  try {
    const api = getElectronApi(["createWorkspaceEntry"]);
    const result = await api.createWorkspaceEntry({
      parentPath: targetParentPath,
      kind
    });

    await loadWorkspace(currentWorkspace.rootPath, result.kind === "file" ? result.path : currentDocument.path);

    if (result.kind === "file") {
      await openWorkspaceFile(result.path, { skipAutosave: true });
      updateStatus("success", "Created", `Created ${basename(result.path)}.`);
    } else {
      updateStatus("success", "Created", `Created ${basename(result.path)}.`);
    }
  } catch (error) {
    updateStatus("error", "Workspace error", normalizeError(error));
  }
}

async function renameWorkspaceEntryFromContext() {
  if (!contextMenuTarget?.path) {
    return;
  }

  workspaceContextMenu.hidden = true;
  const target = { ...contextMenuTarget };
  contextMenuTarget = null;
  const currentName = basename(target.path);
  inlineRenameState = {
    path: target.path,
    type: target.type,
    value: target.type === "file" ? getDocumentNameBase(currentName) : currentName
  };
  renderWorkspaceState();
  queueMicrotask(() => {
    const selector = `[data-inline-rename-path="${CSS.escape(target.path)}"]`;
    const input = workspaceTree.querySelector(selector);
    input?.focus();
    input?.select();
  });
}

async function deleteWorkspaceEntryFromContext() {
  if (!contextMenuTarget?.path) {
    return;
  }

  workspaceContextMenu.hidden = true;
  const target = contextMenuTarget;
  contextMenuTarget = null;
  const targetName = basename(target.path);

  try {
    const api = getElectronApi(["deleteWorkspaceEntry"]);
    await api.deleteWorkspaceEntry({
      path: target.path,
      rootPath: currentWorkspace.rootPath
    });

    const deletingCurrentFile =
      currentDocument.path === target.path ||
      currentDocument.path?.startsWith(`${target.path}${pathSeparator()}`) ||
      false;
    await loadWorkspace(
      currentWorkspace.rootPath,
      deletingCurrentFile ? null : currentDocument.path
    );
    updateStatus("success", "Archived", `Moved ${targetName} to Archive.`);
  } catch (error) {
    updateStatus("error", "Delete error", normalizeError(error));
  }
}

function pathSeparator() {
  return currentDocument.path?.includes("\\") ? "\\" : "/";
}

function handleInlineRenameKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    void saveInlineRename();
  }

  if (event.key === "Escape") {
    event.preventDefault();
    cancelInlineRename();
  }
}

function cancelInlineRename() {
  inlineRenameState = null;
  renderWorkspaceState();
}

async function saveInlineRename() {
  if (!inlineRenameState?.path) {
    return;
  }

  const target = { ...inlineRenameState };
  const nextName = getDocumentNameBase(target.value.trim());
  if (!nextName) {
    queueMicrotask(() => {
      const selector = `[data-inline-rename-path="${CSS.escape(target.path)}"]`;
      const input = workspaceTree.querySelector(selector);
      input?.focus();
      input?.select();
    });
    return;
  }

  const currentName = basename(target.path);
  const currentBaseName = target.type === "file" ? getDocumentNameBase(currentName) : currentName;
  if (nextName === currentBaseName) {
    cancelInlineRename();
    return;
  }

  try {
    if (target.type === "file" && currentDocument.path === target.path) {
      await autoSaveCurrentDocumentIfPossible();
    }

    const api = getElectronApi(["renameWorkspaceEntry"]);
    const result = await api.renameWorkspaceEntry({
      path: target.path,
      nextName
    });

    inlineRenameState = null;
    const preferredPath = currentDocument.path === target.path ? result.path : currentDocument.path;
    await loadWorkspace(currentWorkspace.rootPath, preferredPath);

    if (currentDocument.path === target.path) {
      setCurrentDocument({
        name: basename(result.path),
        path: result.path
      });
    }

    updateStatus("success", "Renamed", `Renamed ${basename(target.path)}.`);
  } catch (error) {
    cancelInlineRename();
    updateStatus("error", "Rename error", normalizeError(error));
  }
}

function handleEditorDocumentNameKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    editorDocumentName.blur();
  }

  if (event.key === "Escape") {
    event.preventDefault();
    editorDocumentName.value = getDocumentNameBase(currentDocument.name);
    editorDocumentName.blur();
  }
}

async function renameCurrentDocumentFromInput() {
  if (!(currentDocument.kind === "mermaid-file" && currentDocument.path)) {
    return;
  }

  const nextName = getDocumentNameBase(editorDocumentName.value.trim());
  if (!nextName) {
    editorDocumentName.value = getDocumentNameBase(currentDocument.name);
    return;
  }

  editorDocumentName.value = nextName;

  try {
    await autoSaveCurrentDocumentIfPossible();
    const api = getElectronApi(["renameWorkspaceEntry"]);
    const result = await api.renameWorkspaceEntry({
      path: currentDocument.path,
      nextName
    });

    setCurrentDocument({
      name: basename(result.path),
      path: result.path
    });
    await loadWorkspace(currentWorkspace.rootPath, result.path);
    updateStatus("success", "Renamed", `Renamed file to ${basename(result.path)}.`);
  } catch (error) {
    editorDocumentName.value = getDocumentNameBase(currentDocument.name);
    updateStatus("error", "Rename error", normalizeError(error));
  }
}

async function ensureWorkspaceSelected() {
  if (currentWorkspace.rootPath) {
    return true;
  }

  await chooseWorkspaceDirectory();
  return Boolean(currentWorkspace.rootPath);
}

function scheduleAutoSave() {
  window.clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(() => {
    void autoSaveCurrentDocumentIfPossible();
  }, 260);
}

async function autoSaveCurrentDocumentIfPossible() {
  window.clearTimeout(autoSaveTimer);

  if (currentDocument.kind === "mermaid-file" && currentDocument.path && currentDocument.dirty) {
    const api = getElectronApi(["writeTextFile"]);
    const targetPath = currentDocument.path;
    const text = getPersistedCodeText();
    await api.writeTextFile({
      filePath: targetPath,
      text
    });

    if (currentDocument.path === targetPath && getPersistedCodeText() === text) {
      setCurrentDocument({ dirty: false });
    }
  }
}

async function openWorkspaceFile(filePath, options = {}) {
  try {
    if (!options.skipAutosave) {
      await autoSaveCurrentDocumentIfPossible();
    }

    const api = getElectronApi(["readTextFile"]);
    const result = await api.readTextFile({ filePath });
    codeInput.value = result.text;
    renderHighlightedCode();
    updateCursorStatus();
    setCurrentDocument({
      name: basename(result.filePath),
      path: result.filePath,
      kind: "mermaid-file",
      dirty: false
    });
    scheduleRender();
    renderWorkspaceState();
  } catch (error) {
    updateStatus("error", "File error", normalizeError(error));
  }
}

function loadMermaidConfigState() {
  const fallbackConfig = createDefaultMermaidConfig();
  const stored = window.localStorage.getItem(mermaidConfigStorageKey);

  if (!stored) {
    return {
      text: stringifyMermaidConfig(fallbackConfig),
      config: normalizeMermaidConfig(fallbackConfig)
    };
  }

  try {
    const parsed = parseMermaidConfigText(stored);
    const normalized = normalizeMermaidConfig(parsed);
    return {
      text: stringifyMermaidConfig(parsed),
      config: normalized
    };
  } catch {
    return {
      text: stringifyMermaidConfig(fallbackConfig),
      config: normalizeMermaidConfig(fallbackConfig)
    };
  }
}

function resolveThemeMode(configText, config) {
  const storedMode = window.localStorage.getItem(mermaidThemeModeStorageKey);
  if (storedMode === "custom" || storedMode === "official") {
    return storedMode;
  }

  const officialTheme = resolveOfficialTheme(config.theme);
  const defaultText = stringifyMermaidConfig(createDefaultMermaidConfig(officialTheme));
  return configText.trim() === defaultText.trim() ? "official" : "custom";
}

function openSettingsModal() {
  workspaceContextMenu.hidden = true;
  contextMenuTarget = null;
  exportMenu.hidden = true;
  settingsDraftThemeMode = currentThemeMode;
  settingsThemeSelect.value = resolveOfficialTheme(currentMermaidConfig.theme);
  settingsCustomConfig.value = lastValidConfigText;
  settingsClipboardFormat.value = loadClipboardFormat();
  setSettingsThemeMode(settingsDraftThemeMode);
  settingsModal.hidden = false;
}

function closeSettingsModal() {
  settingsModal.hidden = true;
}

function setSettingsThemeMode(mode) {
  settingsDraftThemeMode = mode === "custom" ? "custom" : "official";
  settingsCustomPanel.hidden = settingsDraftThemeMode !== "custom";
  themeModeOfficialButton.classList.toggle(
    "settings-mode-button-active",
    settingsDraftThemeMode === "official"
  );
  themeModeCustomButton.classList.toggle(
    "settings-mode-button-active",
    settingsDraftThemeMode === "custom"
  );
}

async function saveSettingsModal() {
  try {
    let nextConfig;
    let nextText;

    if (settingsDraftThemeMode === "custom") {
      const parsed = parseMermaidConfigText(settingsCustomConfig.value);
      nextConfig = normalizeMermaidConfig(parsed);
      nextText = stringifyMermaidConfig(parsed);
    } else {
      const theme = resolveOfficialTheme(settingsThemeSelect.value);
      const defaultConfig = createDefaultMermaidConfig(theme);
      nextConfig = normalizeMermaidConfig(defaultConfig);
      nextText = stringifyMermaidConfig(defaultConfig);
    }

    currentThemeMode = settingsDraftThemeMode;
    currentMermaidConfig = nextConfig;
    currentPptTheme = buildPptThemeFromMermaidConfig(nextConfig);
    lastValidConfigText = nextText;
    window.localStorage.setItem(mermaidConfigStorageKey, nextText);
    window.localStorage.setItem(mermaidThemeModeStorageKey, currentThemeMode);
    saveClipboardFormat(settingsClipboardFormat.value);
    applyPreviewTheme(currentPptTheme);
    scheduleRender();
    closeSettingsModal();
    updateStatus("success", "Settings saved", "Theme and clipboard preferences updated.");
  } catch (error) {
    updateStatus("error", "Settings error", normalizeError(error));
  }
}

function toggleExportMenu() {
  workspaceContextMenu.hidden = true;
  contextMenuTarget = null;
  exportMenu.hidden = !exportMenu.hidden;
}

function adjustPreviewScale(delta) {
  previewScale = Math.min(2, Math.max(0.4, Number((previewScale + delta).toFixed(2))));
  applyPreviewScale();
}

function resetPreviewScale() {
  previewScale = 1;
  applyPreviewScale();
}

function applyPreviewScale() {
  const svgElement = preview.querySelector("svg");

  if (!svgElement) {
    return;
  }

  svgElement.style.width = `${Math.round(latestSvgDimensions.width * previewScale)}px`;
  svgElement.style.height = "auto";
}

function applyPreviewTheme(pptTheme) {
  const background = `#${pptTheme.canvas.background}`;
  previewFrame.style.backgroundColor = background;
}

function getRasterBackgroundColor() {
  return `#${currentPptTheme.canvas.background}`;
}

function loadClipboardFormat() {
  const saved = window.localStorage.getItem(clipboardFormatStorageKey);
  return saved === "jpeg" ? "jpeg" : "png";
}

function saveClipboardFormat(format) {
  window.localStorage.setItem(
    clipboardFormatStorageKey,
    format === "jpeg" ? "jpeg" : "png"
  );
}

function isFlowchartSource(source) {
  return /^\s*(flowchart|graph)\b/i.test(source);
}

function isSequenceSource(source) {
  return /^\s*sequenceDiagram\b/i.test(source);
}

function isPptExportableSource(source) {
  return isFlowchartSource(source) || isSequenceSource(source);
}

function shouldUseRendererClipboardFallback(error) {
  const message = normalizeError(error);

  return (
    message.includes('No handler registered for "copy-raster-from-svg"') ||
    message.includes("No handler registered for 'copy-raster-from-svg'") ||
    message.includes('missing "copyRasterFromSvg"')
  );
}

async function copyRasterToClipboardInRenderer(svgMarkup, format, width, height) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard image writing is unavailable in this app session. Fully quit and restart the app.");
  }

  const blob = await rasterizeSvgToBlob(svgMarkup, format, width, height);
  await navigator.clipboard.write([
    new ClipboardItem({
      [blob.type]: blob
    })
  ]);
}

async function rasterizeSvgToBlob(svgMarkup, format, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * 2);
  canvas.height = Math.ceil(height * 2);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }

  context.scale(2, 2);

  if (format === "jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }

  const image = await loadSvgImage(svgMarkup);
  context.drawImage(image, 0, 0, width, height);

  const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
  return canvasToBlob(canvas, mimeType, 0.95);
}

function loadSvgImage(svgMarkup) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to rasterize SVG for clipboard copy."));
    image.src = url;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas export returned an empty blob."));
        return;
      }

      resolve(blob);
    }, mimeType, quality);
  });
}
