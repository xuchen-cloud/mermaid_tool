import mermaid from "../node_modules/mermaid/dist/mermaid.esm.min.mjs";
import {
  buildPptThemeFromMermaidConfig,
  createDefaultMermaidConfig,
  normalizeMermaidConfig,
  parseMermaidConfigText,
  resolveOfficialTheme,
  stringifyMermaidConfig
} from "./mermaid-config.js";
import { highlightMermaidCode } from "./mermaid-highlight.js";
import { getAvailableDesktopApiKeys, getDesktopApi } from "./platform/desktop-api.js";
import { layoutFlowchart } from "./ppt/flowchart/layout.js";
import { buildDiagramPptxBytes } from "./ppt/export-pptx.js";
import { parseFlowchartSource } from "./ppt/flowchart/parse.js";
import { layoutSequence } from "./ppt/sequence/layout.js";
import { parseSequenceSource } from "./ppt/sequence/parse.js";

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
const topbarTitle = document.querySelector("#topbar-title");
const projectsButton = document.querySelector("#projects-button");
const settingsButton = document.querySelector("#settings-button");
const workspaceMain = document.querySelector(".workspace-main");
const workspaceKicker = document.querySelector("#workspace-kicker");
const workspaceRefreshButton = document.querySelector("#workspace-refresh");
const workspaceRail = document.querySelector("#workspace-rail");
const workspaceSortSelect = document.querySelector("#workspace-sort");
const workspaceTree = document.querySelector("#workspace-tree");
const workspaceEmpty = document.querySelector("#workspace-empty");
const workspaceContextMenu = document.querySelector("#workspace-context-menu");
const contextNewFileButton = document.querySelector("#context-new-file");
const contextNewFolderButton = document.querySelector("#context-new-folder");
const contextRenameButton = document.querySelector("#context-rename");
const contextDeleteButton = document.querySelector("#context-delete");
const newDocumentButton = document.querySelector("#new-document");
const copyCodeButton = document.querySelector("#copy-code");
const paneDivider = document.querySelector("#pane-divider");
const editorEyebrow = document.querySelector("#editor-eyebrow");
const preview = document.querySelector("#preview");
const previewBody = document.querySelector(".preview-body");
const previewFrame = document.querySelector("#preview-frame");
const previewEmpty = document.querySelector("#preview-empty");
const previewEyebrow = document.querySelector("#preview-eyebrow");
const statusBadge = document.querySelector("#status-badge");
const statusText = document.querySelector("#status-text");
const encodingStatus = document.querySelector("#encoding-status");
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
const settingsEyebrow = document.querySelector("#settings-eyebrow");
const settingsTitle = document.querySelector("#settings-title");
const settingsLanguageTitle = document.querySelector("#settings-language-title");
const settingsLanguageLabel = document.querySelector("#settings-language-label");
const settingsLanguageSelect = document.querySelector("#settings-language-select");
const settingsThemeTitle = document.querySelector("#settings-theme-title");
const settingsOfficialThemeField = document.querySelector("#settings-official-theme-field");
const settingsThemeLabel = document.querySelector("#settings-theme-label");
const settingsThemeSelect = document.querySelector("#settings-theme-select");
const themeModeOfficialButton = document.querySelector("#theme-mode-official");
const themeModeCustomButton = document.querySelector("#theme-mode-custom");
const settingsCustomPanel = document.querySelector("#settings-custom-panel");
const settingsCustomConfigLabel = document.querySelector("#settings-custom-config-label");
const settingsCustomConfig = document.querySelector("#settings-custom-config");
const settingsClipboardTitle = document.querySelector("#settings-clipboard-title");
const settingsClipboardLabel = document.querySelector("#settings-clipboard-label");
const settingsClipboardFormat = document.querySelector("#settings-clipboard-format");
const clipboardFormatStorageKey = "mermaid-tool.clipboard-format";
const mermaidConfigStorageKey = "mermaid-tool.mermaid-config";
const mermaidThemeModeStorageKey = "mermaid-tool.theme-mode";
const uiLanguageStorageKey = "mermaid-tool.ui-language";
const workspaceRootStorageKey = "mermaid-tool.workspace-root";
const workspaceFileStorageKey = "mermaid-tool.workspace-file";
const workspaceSortModeStorageKey = "mermaid-tool.workspace-sort-mode";
const editorFontSizeStorageKey = "mermaid-tool.editor-font-size";
const workspaceSidebarCollapsedStorageKey = "mermaid-tool.workspace-sidebar-collapsed";
const editorPaneWidthStorageKey = "mermaid-tool.editor-pane-width";

let renderTimer;
let latestSvg = "";
let latestSvgDimensions = { width: 1200, height: 800 };
let currentMermaidConfig = normalizeMermaidConfig(createDefaultMermaidConfig());
let currentPptTheme = buildPptThemeFromMermaidConfig(currentMermaidConfig);
let lastValidConfigText = stringifyMermaidConfig(createDefaultMermaidConfig());
let currentDocument = createDraftDocumentState();
let currentWorkspace = createEmptyWorkspaceState();
let previewScale = 1;
let previewFitScale = 1;
let previewAutoFit = true;
let contextMenuTarget = null;
let autoSaveTimer;
let currentThemeMode = "official";
let currentUiLanguage = loadUiLanguage();
let settingsDraftThemeMode = "official";
let settingsDraftUiLanguage = currentUiLanguage;
let previewIsHovered = false;
let previewSpacePressed = false;
let previewPanMode = false;
let previewPanState = null;
let previewSourceMap = null;
let previewHighlightedLines = new Set();
let previewPrimaryHighlightedLine = null;
let inlineRenameState = null;
let editorFontSize = loadEditorFontSize();
let workspaceSidebarCollapsed = loadWorkspaceSidebarCollapsed();
let editorPaneWidth = loadEditorPaneWidth();
let paneResizeState = null;
let workspaceDragState = null;
let workspaceDropTarget = null;
let editorDocumentNameMeasureContext = null;
let currentStatusDescriptor = {
  type: "key",
  state: "idle",
  badgeKey: "status.readyBadge",
  messageKey: "status.idleMessage",
  vars: {}
};

const previewWheelZoomStep = 0.02;
const editorIndentUnit = "  ";
const uiMessages = {
  en: {
    "app.title": "Mermaid Tool",
    "nav.projects": "Projects",
    "workspace.noneSelected": "No workspace selected",
    "workspace.title": "Workspace",
    "workspace.sortAria": "Sort workspace files",
    "workspace.sort.name": "Name",
    "workspace.sort.updated": "Updated",
    "workspace.sort.created": "Created",
    "workspace.refreshAria": "Refresh workspace",
    "workspace.newFile": "New File",
    "workspace.treeAria": "Workspace tree",
    "workspace.empty.choose": "Choose a project directory to browse `.mmd` files.",
    "workspace.empty.noFiles": "No .mmd files yet. Use New File or right-click a folder.",
    "workspace.context.newFile": "New file",
    "workspace.context.newFolder": "New folder",
    "workspace.context.rename": "Rename",
    "workspace.context.delete": "Delete",
    "workspace.toggle.expand": "Expand workspace",
    "workspace.toggle.collapse": "Collapse workspace",
    "workspace.sort.description.name": "name",
    "workspace.sort.description.updated": "updated time",
    "workspace.sort.description.created": "created time",
    "editor.title": "Editor",
    "editor.fileNameAria": "Current file name",
    "editor.copyCode": "Copy Code",
    "preview.resizeAria": "Resize editor and preview panels",
    "preview.title": "Diagram Preview",
    "preview.copyImage": "Copy Image",
    "preview.export": "Export",
    "preview.empty": "Your Mermaid diagram will appear here.",
    "preview.zoomInAria": "Zoom in",
    "preview.zoomOutAria": "Zoom out",
    "preview.zoomFitAria": "Fit to frame",
    "status.encoding": "UTF-8",
    "status.readyBadge": "Ready",
    "status.renderingBadge": "Rendering",
    "status.renderedBadge": "Rendered",
    "status.savedBadge": "Saved",
    "status.copiedBadge": "Copied",
    "status.workspaceBadge": "Workspace",
    "status.createdBadge": "Created",
    "status.movedBadge": "Moved",
    "status.archivedBadge": "Archived",
    "status.renamedBadge": "Renamed",
    "status.settingsSavedBadge": "Settings saved",
    "status.errorBadge": "Error",
    "status.clipboardErrorBadge": "Clipboard error",
    "status.exportErrorBadge": "Export error",
    "status.pptxErrorBadge": "PPTX error",
    "status.configErrorBadge": "Config error",
    "status.workspaceErrorBadge": "Workspace error",
    "status.moveErrorBadge": "Move error",
    "status.deleteErrorBadge": "Delete error",
    "status.renameErrorBadge": "Rename error",
    "status.fileErrorBadge": "File error",
    "status.settingsErrorBadge": "Settings error",
    "status.idleMessage": "Edit Mermaid code to render the diagram.",
    "status.startMessage": "Open or create a Mermaid file to start.",
    "status.renderingMessage": "Updating preview...",
    "status.renderedMessage": "Diagram preview is up to date.",
    "status.svgSaved": "SVG exported to {filePath}",
    "status.pptxSaved": "PPTX exported to {filePath}",
    "status.rasterSaved": "{format} exported to {filePath}",
    "status.codeCopied": "Mermaid source copied to clipboard.",
    "status.imageCopied": "{format} image copied to clipboard.",
    "status.workspaceOpened": "Opened workspace {path}",
    "status.workspaceRefreshed": "Workspace tree refreshed.",
    "status.workspaceSorted": "Sorted by {sortMode}.",
    "status.workspaceMoved": "Moved {name}.",
    "status.workspaceCreated": "Created {name}.",
    "status.workspaceArchived": "Moved {name} to Archive.",
    "status.workspaceRenamed": "Renamed {name}.",
    "status.workspaceFileRenamed": "Renamed file to {name}.",
    "status.settingsSaved": "Theme, language, and clipboard preferences updated.",
    "settings.title": "Workspace Preferences",
    "settings.label": "Settings",
    "settings.closeAria": "Close settings",
    "settings.language.title": "Interface Language",
    "settings.language.label": "Display language",
    "settings.language.en": "English",
    "settings.language.zh-CN": "Simplified Chinese",
    "settings.theme.title": "Editor Theme",
    "settings.theme.official": "Official",
    "settings.theme.custom": "Custom",
    "settings.theme.label": "Official Mermaid theme",
    "settings.customConfig.label": "Custom Mermaid config JSON",
    "settings.customConfig.aria": "Custom Mermaid config JSON",
    "settings.clipboard.title": "Clipboard",
    "settings.clipboard.label": "Default image copy format",
    "settings.cancel": "Cancel",
    "settings.save": "Save",
    "cursor.position": "Ln {line}, Col {column}",
    "rename.fileAria": "Rename file",
    "rename.folderAria": "Rename folder",
    "error.noRenderedSvgDebugExport": "No rendered SVG is available for debug export.",
    "error.noRenderedSvgDebugClipboard": "No rendered SVG is available for debug clipboard export.",
    "error.noRenderedSvgDebugClipboardFallback": "No rendered SVG is available for debug clipboard fallback export.",
    "error.noRenderedSvgClipboard": "No rendered SVG is available for clipboard export.",
    "error.noRenderedSvgExport": "No rendered SVG is available for export.",
    "error.electronApiUnavailable": "Electron preload API is unavailable. Restart the app.",
    "error.electronApiOutdated": "Electron preload API is outdated and missing \"{method}\". Fully quit and restart the app.",
    "error.pptUnsupported": "PPT export currently supports Flowchart and Sequence diagrams only.",
    "error.clipboardWriteUnavailable": "Clipboard image writing is unavailable in this app session. Fully quit and restart the app.",
    "error.canvasContextUnavailable": "Canvas 2D context is unavailable.",
    "error.rasterizeFailed": "Failed to rasterize SVG for clipboard copy.",
    "error.canvasBlobEmpty": "Canvas export returned an empty blob."
  },
  "zh-CN": {
    "app.title": "Mermaid Tool",
    "nav.projects": "项目",
    "workspace.noneSelected": "未选择工作区",
    "workspace.title": "工作区",
    "workspace.sortAria": "排序工作区文件",
    "workspace.sort.name": "名称",
    "workspace.sort.updated": "更新时间",
    "workspace.sort.created": "创建时间",
    "workspace.refreshAria": "刷新工作区",
    "workspace.newFile": "新建文件",
    "workspace.treeAria": "工作区文件树",
    "workspace.empty.choose": "选择一个项目目录以浏览 `.mmd` 文件。",
    "workspace.empty.noFiles": "当前还没有 .mmd 文件。可以新建文件，或在文件夹上右键操作。",
    "workspace.context.newFile": "新建文件",
    "workspace.context.newFolder": "新建文件夹",
    "workspace.context.rename": "重命名",
    "workspace.context.delete": "删除",
    "workspace.toggle.expand": "展开工作区",
    "workspace.toggle.collapse": "收起工作区",
    "workspace.sort.description.name": "名称",
    "workspace.sort.description.updated": "更新时间",
    "workspace.sort.description.created": "创建时间",
    "editor.title": "编辑器",
    "editor.fileNameAria": "当前文件名",
    "editor.copyCode": "复制代码",
    "preview.resizeAria": "调整编辑器和预览面板宽度",
    "preview.title": "图形预览",
    "preview.copyImage": "复制图片",
    "preview.export": "导出",
    "preview.empty": "你的 Mermaid 图将在这里显示。",
    "preview.zoomInAria": "放大",
    "preview.zoomOutAria": "缩小",
    "preview.zoomFitAria": "适应窗口",
    "status.encoding": "UTF-8",
    "status.readyBadge": "就绪",
    "status.renderingBadge": "渲染中",
    "status.renderedBadge": "已渲染",
    "status.savedBadge": "已保存",
    "status.copiedBadge": "已复制",
    "status.workspaceBadge": "工作区",
    "status.createdBadge": "已创建",
    "status.movedBadge": "已移动",
    "status.archivedBadge": "已归档",
    "status.renamedBadge": "已重命名",
    "status.settingsSavedBadge": "设置已保存",
    "status.errorBadge": "错误",
    "status.clipboardErrorBadge": "剪贴板错误",
    "status.exportErrorBadge": "导出错误",
    "status.pptxErrorBadge": "PPTX 导出错误",
    "status.configErrorBadge": "配置错误",
    "status.workspaceErrorBadge": "工作区错误",
    "status.moveErrorBadge": "移动错误",
    "status.deleteErrorBadge": "删除错误",
    "status.renameErrorBadge": "重命名错误",
    "status.fileErrorBadge": "文件错误",
    "status.settingsErrorBadge": "设置错误",
    "status.idleMessage": "编辑 Mermaid 代码以渲染图形。",
    "status.startMessage": "打开或新建一个 Mermaid 文件开始使用。",
    "status.renderingMessage": "正在更新预览...",
    "status.renderedMessage": "图形预览已是最新状态。",
    "status.svgSaved": "SVG 已导出到 {filePath}",
    "status.pptxSaved": "PPTX 已导出到 {filePath}",
    "status.rasterSaved": "{format} 已导出到 {filePath}",
    "status.codeCopied": "Mermaid 源码已复制到剪贴板。",
    "status.imageCopied": "{format} 图片已复制到剪贴板。",
    "status.workspaceOpened": "已打开工作区 {path}",
    "status.workspaceRefreshed": "工作区文件树已刷新。",
    "status.workspaceSorted": "已按 {sortMode} 排序。",
    "status.workspaceMoved": "已移动 {name}。",
    "status.workspaceCreated": "已创建 {name}。",
    "status.workspaceArchived": "{name} 已移入 Archive。",
    "status.workspaceRenamed": "已重命名 {name}。",
    "status.workspaceFileRenamed": "文件已重命名为 {name}。",
    "status.settingsSaved": "主题、语言和剪贴板偏好已更新。",
    "settings.title": "工作区偏好设置",
    "settings.label": "设置",
    "settings.closeAria": "关闭设置",
    "settings.language.title": "界面语言",
    "settings.language.label": "显示语言",
    "settings.language.en": "English",
    "settings.language.zh-CN": "简体中文",
    "settings.theme.title": "编辑器主题",
    "settings.theme.official": "官方主题",
    "settings.theme.custom": "自定义",
    "settings.theme.label": "官方 Mermaid 主题",
    "settings.customConfig.label": "自定义 Mermaid 配置 JSON",
    "settings.customConfig.aria": "自定义 Mermaid 配置 JSON",
    "settings.clipboard.title": "剪贴板",
    "settings.clipboard.label": "默认复制图片格式",
    "settings.cancel": "取消",
    "settings.save": "保存",
    "cursor.position": "第 {line} 行，第 {column} 列",
    "rename.fileAria": "重命名文件",
    "rename.folderAria": "重命名文件夹",
    "error.noRenderedSvgDebugExport": "当前没有可用于调试导出的 SVG。",
    "error.noRenderedSvgDebugClipboard": "当前没有可用于调试复制的 SVG。",
    "error.noRenderedSvgDebugClipboardFallback": "当前没有可用于调试兜底复制的 SVG。",
    "error.noRenderedSvgClipboard": "当前没有可用于复制到剪贴板的 SVG。",
    "error.noRenderedSvgExport": "当前没有可用于导出的 SVG。",
    "error.electronApiUnavailable": "Electron preload API 不可用。请重启应用。",
    "error.electronApiOutdated": "Electron preload API 版本过旧，缺少 “{method}”。请完全退出后重新启动应用。",
    "error.pptUnsupported": "PPT 导出目前仅支持 Flowchart 和 Sequence 图。",
    "error.clipboardWriteUnavailable": "当前会话不支持写入图片到剪贴板。请完全退出后重新启动应用。",
    "error.canvasContextUnavailable": "Canvas 2D 上下文不可用。",
    "error.rasterizeFailed": "SVG 栅格化失败，无法复制到剪贴板。",
    "error.canvasBlobEmpty": "Canvas 导出返回了空的 Blob。"
  }
};

function normalizeUiLanguage(value) {
  return value === "zh-CN" ? "zh-CN" : "en";
}

function loadUiLanguage() {
  const saved = window.localStorage.getItem(uiLanguageStorageKey);
  if (saved === "en" || saved === "zh-CN") {
    return saved;
  }

  return /^zh\b/i.test(navigator.language ?? "") ? "zh-CN" : "en";
}

function t(key, vars = {}) {
  const template =
    uiMessages[currentUiLanguage]?.[key] ??
    uiMessages.en[key] ??
    key;

  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}

window.addEventListener("error", (event) => {
  console.error("window error:", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("unhandled rejection:", event.reason);
});

codeInput.value = sampleCode;
initializeSettingsState();
applyUiLanguage();
applyEditorFontSize();
applyWorkspaceSidebarState();
applyEditorPaneWidth();
renderDocumentState();
renderHighlightedCode();
codeInput.addEventListener("input", () => {
  clearPreviewSourceSelection({ render: false });
  markDocumentDirty();
  updateCursorStatus();
  renderHighlightedCode();
  scheduleAutoSave();
  scheduleRender();
});

codeInput.addEventListener("blur", () => {
  void autoSaveCurrentDocumentIfPossible();
});

codeInput.addEventListener("keydown", (event) => handleEditorKeydown(event));
codeInput.addEventListener("click", () => updateCursorStatus());
codeInput.addEventListener("keyup", () => updateCursorStatus());
codeInput.addEventListener("select", () => updateCursorStatus());
codeInput.addEventListener("scroll", () => syncCodeHighlightScroll());

projectsButton.addEventListener("click", () => chooseWorkspaceDirectory());
settingsButton.addEventListener("click", () => openSettingsModal());
workspaceRefreshButton.addEventListener("click", () => refreshWorkspaceTree());
workspaceRail.addEventListener("click", () => toggleWorkspaceSidebar());
workspaceSortSelect.addEventListener("change", (event) => {
  void handleWorkspaceSortChange(event);
});
newDocumentButton.addEventListener("click", () => createWorkspaceFileAtRoot());
copyCodeButton.addEventListener("click", () => copyCodeToClipboard());
paneDivider.addEventListener("mousedown", (event) => handlePaneResizeStart(event));
editorDocumentName.addEventListener("keydown", (event) => handleEditorDocumentNameKeydown(event));
editorDocumentName.addEventListener("input", () => updateEditorDocumentNameWidth());
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
previewFrame.addEventListener("mouseenter", () => {
  previewIsHovered = true;
  syncPreviewPanMode();
  updatePreviewPanCursor();
});
previewFrame.addEventListener("mouseleave", () => {
  previewIsHovered = false;
  syncPreviewPanMode();
  updatePreviewPanCursor();
});
previewFrame.addEventListener("mousedown", (event) => handlePreviewPanStart(event));
previewFrame.addEventListener("mousemove", (event) => handlePreviewPanMove(event));
previewFrame.addEventListener("click", (event) => handlePreviewSelectionClick(event));
previewBody.addEventListener("mousedown", () => {
  previewFrame.focus({ preventScroll: true });
});
previewFrame.addEventListener("wheel", (event) => handlePreviewWheel(event), { passive: false });
window.addEventListener("mouseup", () => stopPreviewPanning());
window.addEventListener("keydown", (event) => handlePreviewFrameKeydown(event));
window.addEventListener("keyup", (event) => handlePreviewFrameKeyup(event));
window.addEventListener("mousemove", (event) => handlePaneResizeMove(event));
window.addEventListener("mouseup", () => stopPaneResize());
window.addEventListener("resize", () => {
  if (preview.classList.contains("is-visible")) {
    applyPreviewScale();
  }
});
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
workspaceTree.addEventListener("keydown", (event) => {
  void handleWorkspaceTreeKeydown(event);
});
workspaceTree.addEventListener("contextmenu", (event) => handleWorkspaceTreeContextMenu(event));
workspaceTree.addEventListener("dragstart", (event) => handleWorkspaceDragStart(event));
workspaceTree.addEventListener("dragover", (event) => handleWorkspaceDragOver(event));
workspaceTree.addEventListener("drop", (event) => {
  void handleWorkspaceDrop(event);
});
workspaceTree.addEventListener("dragend", () => clearWorkspaceDragState());
workspaceTree.addEventListener("dragleave", (event) => handleWorkspaceDragLeave(event));
workspaceEmpty.addEventListener("dragover", (event) => handleWorkspaceDragOver(event));
workspaceEmpty.addEventListener("drop", (event) => {
  void handleWorkspaceDrop(event);
});
workspaceEmpty.addEventListener("dragleave", (event) => handleWorkspaceDragLeave(event));
document.addEventListener("click", (event) => handleGlobalClick(event));

renderDiagram(sampleCode, currentMermaidConfig);
updateCursorStatus();
void initializeWorkspaceState();

window.__mermaidTool = {
  getApiKeys: () => getAvailableDesktopApiKeys(),
  getLatestSvg: () => latestSvg,
  debugWriteRasterFromSvg: async (format) => {
    const api = getDesktopApi(["debugWriteRasterFromSvg"]);
    const svgElement = preview.querySelector("svg");

    if (!svgElement) {
      throw new Error(t("error.noRenderedSvgDebugExport"));
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
    const api = getDesktopApi(["copyRasterFromSvg"]);
    const svgElement = preview.querySelector("svg");

    if (!svgElement) {
      throw new Error(t("error.noRenderedSvgDebugClipboard"));
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
      throw new Error(t("error.noRenderedSvgDebugClipboardFallback"));
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
    const api = getDesktopApi(["debugWritePptxFile"]);
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
    previewSourceMap = buildPreviewSourceMap(source);
    annotatePreviewSourceMap(previewSourceMap);
    currentMermaidConfig = mermaidConfig;
    currentPptTheme = buildPptThemeFromMermaidConfig(mermaidConfig);
    applyPreviewTheme(currentPptTheme);
    preview.classList.add("is-visible");
    previewEmpty.style.display = "none";
    fitPreviewToFrame({ resetViewport: true });
    setExportButtonsDisabled(false);
    updateStatusByKey("success", "status.renderedBadge", "status.renderedMessage");
  } catch (error) {
    latestSvg = "";
    latestSvgDimensions = { width: 1200, height: 800 };
    previewSourceMap = null;
    preview.innerHTML = "";
    preview.classList.remove("is-visible");
    previewEmpty.style.display = "block";
    setExportButtonsDisabled(true);
    updateStatus("error", t("status.errorBadge"), normalizeError(error));
  }
}

async function exportSvg() {
  if (!latestSvg) {
    return;
  }

  const api = getDesktopApi(["saveTextFile"]);
  const result = await api.saveTextFile({
    defaultPath: `${getCurrentExportBaseName()}.svg`,
    filters: [{ name: "SVG", extensions: ["svg"] }],
    text: latestSvg
  });

  if (!result.canceled) {
    updateStatusByKey("success", "status.savedBadge", "status.svgSaved", {
      filePath: result.filePath
    });
  }
}

async function exportPptx() {
  try {
    const api = getDesktopApi(["saveBinaryFile"]);
    const bytes = await buildDiagramPptxBytes(buildCurrentPptDiagram());
    const result = await api.saveBinaryFile({
      defaultPath: `${getCurrentExportBaseName()}.pptx`,
      filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
      buffer: bytes.buffer
    });

    if (!result.canceled) {
      updateStatusByKey("success", "status.savedBadge", "status.pptxSaved", {
        filePath: result.filePath
      });
    }
  } catch (error) {
    updateStatus("error", t("status.pptxErrorBadge"), normalizeError(error));
  }
}

async function copyCodeToClipboard() {
  try {
    await navigator.clipboard.writeText(codeInput.value);
    updateStatusByKey("success", "status.copiedBadge", "status.codeCopied");
  } catch (error) {
    updateStatus("error", t("status.clipboardErrorBadge"), normalizeError(error));
  }
}

async function copyRasterToClipboard() {
  if (!latestSvg) {
    return;
  }

  const svgElement = preview.querySelector("svg");

  if (!svgElement) {
    updateStatus("error", t("status.clipboardErrorBadge"), t("error.noRenderedSvgClipboard"));
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
    await copyRasterToClipboardInRenderer(svgMarkup, format, width, height);
    updateStatus(
      "success",
      t("status.copiedBadge"),
      t("status.imageCopied", { format: format.toUpperCase() })
    );
  } catch (error) {
    updateStatus("error", t("status.clipboardErrorBadge"), normalizeError(error));
  }
}

async function exportRaster(format) {
  if (!latestSvg) {
    return;
  }

  try {
    const api = getDesktopApi(["saveBinaryFile"]);
    const svgElement = preview.querySelector("svg");

    if (!svgElement) {
      throw new Error(t("error.noRenderedSvgExport"));
    }

    const { width, height } = getSvgSize(svgElement);
    const svgMarkup = buildExportableSvg(
      svgElement,
      width,
      height,
      getRasterBackgroundColor()
    );
    const extension = format === "png" ? "png" : "jpg";

    const blob = await rasterizeSvgToBlob(svgMarkup, format, width, height);
    const bytes = await blob.arrayBuffer();
    const result = await api.saveBinaryFile({
      defaultPath: `${getCurrentExportBaseName()}.${extension}`,
      filters: [
        {
          name: format === "png" ? "PNG" : "JPG",
          extensions: [extension]
        }
      ],
      buffer: bytes
    });

    if (!result.canceled) {
      updateStatus(
        "success",
        t("status.savedBadge"),
        t("status.rasterSaved", {
          format: extension.toUpperCase(),
          filePath: result.filePath
        })
      );
    }
  } catch (error) {
    updateStatus("error", t("status.exportErrorBadge"), normalizeError(error));
  }
}

function getCurrentExportBaseName() {
  if (currentDocument?.name) {
    return getDocumentNameBase(currentDocument.name) || "diagram";
  }

  return "diagram";
}

function buildCurrentPptDiagram() {
  const source = getSupportedSourceForPptx();
  const pptTheme = currentPptTheme;

  if (isSequenceSource(source)) {
    const parsed = parseSequenceSource(source);
    return layoutSequence({
      ...parsed,
      source
    }, pptTheme.sequence);
  }

  const parsed = parseFlowchartSource(source);
  return layoutFlowchart({
    ...parsed,
    source
  }, pptTheme.flowchart);
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
    updateStatusByKey("idle", "status.readyBadge", "status.startMessage");
    return;
  }

  updateStatusByKey("rendering", "status.renderingBadge", "status.renderingMessage");
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(async () => {
    try {
      await renderDiagram(codeInput.value, currentMermaidConfig);
    } catch (error) {
      latestSvg = "";
      setExportButtonsDisabled(true);
      updateStatus("error", t("status.configErrorBadge"), normalizeError(error));
    }
  }, 220);
}

function updateStatusByKey(state, badgeKey, messageKey, vars = {}) {
  currentStatusDescriptor = {
    type: "key",
    state,
    badgeKey,
    messageKey,
    vars
  };
  renderCurrentStatus();
}

function updateStatus(state, badgeText, message) {
  currentStatusDescriptor = {
    type: "literal",
    state,
    badgeText,
    message
  };
  renderCurrentStatus();
}

function renderCurrentStatus() {
  statusBadge.className = `status status-${currentStatusDescriptor.state}`;

  if (currentStatusDescriptor.type === "key") {
    statusBadge.textContent = t(currentStatusDescriptor.badgeKey, currentStatusDescriptor.vars);
    statusText.textContent = t(currentStatusDescriptor.messageKey, currentStatusDescriptor.vars);
    return;
  }

  statusBadge.textContent = currentStatusDescriptor.badgeText;
  statusText.textContent = currentStatusDescriptor.message;
}

function updateCursorStatus() {
  const cursorIndex = codeInput.selectionStart ?? 0;
  const beforeCursor = codeInput.value.slice(0, cursorIndex);
  const lines = beforeCursor.split("\n");
  const line = lines.length;
  const column = (lines[lines.length - 1]?.length ?? 0) + 1;
  cursorStatus.textContent = t("cursor.position", { line, column });
}

function updatePreviewPanCursor() {
  previewFrame.classList.toggle("preview-frame-pan-ready", previewIsHovered && previewPanMode);
  previewFrame.classList.toggle("preview-frame-panning", Boolean(previewPanState));
}

function handlePreviewFrameKeydown(event) {
  if (event.code !== "Space") {
    return;
  }

  if (isEditableElement(event.target)) {
    return;
  }

  previewSpacePressed = true;
  if (!previewIsHovered) {
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

  previewSpacePressed = false;
  previewPanMode = false;
  stopPreviewPanning();
  updatePreviewPanCursor();
}

function syncPreviewPanMode() {
  previewPanMode = previewIsHovered && previewSpacePressed && !isEditableElement(document.activeElement);
}

function isEditableElement(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
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

function handlePreviewWheel(event) {
  if (!previewIsHovered || !isPreviewWheelZoomGesture(event)) {
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
  if (!(event.target instanceof Element) || previewPanState) {
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
  if (!previewSourceMap) {
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
      return buildSequenceMessageSelection(
        Number.parseInt(annotatedElement.dataset.sourceIndex ?? "", 10)
      );
    case "sequence-note":
      return buildSequenceNoteSelection(
        Number.parseInt(annotatedElement.dataset.sourceIndex ?? "", 10)
      );
    default:
      return null;
  }
}

function buildPreviewSourceMap(source) {
  try {
    if (isFlowchartSource(source)) {
      return {
        type: "flowchart",
        parsed: parseFlowchartSource(source)
      };
    }

    if (isSequenceSource(source)) {
      return {
        type: "sequence",
        parsed: parseSequenceSource(source)
      };
    }
  } catch (error) {
    console.warn("Preview source mapping unavailable:", error);
  }

  return null;
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
  }
}

function annotateFlowchartPreviewSourceMap(parsed) {
  for (const nodeElement of preview.querySelectorAll("g.node[id]")) {
    const nodeId = resolveFlowchartNodeKey(nodeElement, parsed);
    if (!nodeId) {
      continue;
    }

    annotatePreviewElement(nodeElement, {
      kind: "flowchart-node",
      key: nodeId
    });

    const labelElement = nodeElement.querySelector(".nodeLabel, .label");
    if (labelElement) {
      annotatePreviewElement(labelElement, {
        kind: "flowchart-node",
        key: nodeId
      });
    }
  }

  for (const edgePath of preview.querySelectorAll("path.flowchart-link")) {
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

  for (const edgeLabel of preview.querySelectorAll(".edgeLabel")) {
    const edgeId = edgeLabel.querySelector(".label[data-id]")?.getAttribute("data-id");
    if (!edgeId) {
      continue;
    }

    const edgePath = preview.querySelector(`path.flowchart-link#${CSS.escape(edgeId)}`);
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
  for (const namedElement of preview.querySelectorAll("[name]")) {
    const participantId = resolveSequenceParticipantKey(namedElement.getAttribute("name"), parsed);
    if (!participantId) {
      continue;
    }

    annotatePreviewElement(namedElement, {
      kind: "sequence-participant",
      key: participantId
    });

    if (namedElement.parentElement) {
      annotatePreviewElement(namedElement.parentElement, {
        kind: "sequence-participant",
        key: participantId
      });
    }
  }

  const messageEvents = parsed.events.filter((event) => event.type === "message");
  const messageLines = Array.from(preview.querySelectorAll(".messageLine0, .messageLine1"));
  const messageTexts = Array.from(preview.querySelectorAll(".messageText"));

  for (const [index] of messageEvents.entries()) {
    annotatePreviewIndexedElement(messageLines[index], "sequence-message", index);
    annotatePreviewIndexedElement(messageTexts[index], "sequence-message", index);
  }

  const noteEvents = parsed.events.filter((event) => event.type === "note");
  const noteRects = Array.from(preview.querySelectorAll("rect.note"));
  const noteTexts = Array.from(preview.querySelectorAll(".noteText"));

  for (const [index] of noteEvents.entries()) {
    annotatePreviewIndexedElement(noteRects[index], "sequence-note", index);
    annotatePreviewIndexedElement(noteTexts[index], "sequence-note", index);
    if (noteRects[index]?.parentElement) {
      annotatePreviewIndexedElement(noteRects[index].parentElement, "sequence-note", index);
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

  const rawIdCandidates = [
    nodeElement.getAttribute("data-id"),
    nodeElement.getAttribute("id")
  ]
    .map((value) => value?.trim())
    .filter(Boolean);

  for (const candidate of rawIdCandidates) {
    const directMatch = parsed.nodes.find((node) => node.id === candidate);
    if (directMatch) {
      return directMatch.id;
    }

    const suffixMatch = parsed.nodes.find((node) => candidate.endsWith(`-${node.id}`) || candidate.includes(`-${node.id}-`));
    if (suffixMatch) {
      return suffixMatch.id;
    }
  }

  const labelText = normalizeFlowchartNodeLabel(
    nodeElement.querySelector(".nodeLabel, .label")?.textContent ?? ""
  );
  if (!labelText) {
    return null;
  }

  const labelMatches = parsed.nodes.filter((node) => normalizeFlowchartNodeLabel(node.text) === labelText);
  return labelMatches.length === 1 ? labelMatches[0].id : null;
}

function normalizeFlowchartNodeLabel(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
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

  const participant = parsed.participants.find((item) => item.id === rawValue || item.text === rawValue);
  return participant?.id ?? null;
}

function buildFlowchartNodeSelection(nodeId) {
  const parsed = previewSourceMap?.type === "flowchart" ? previewSourceMap.parsed : null;
  if (!parsed || !nodeId) {
    return null;
  }

  const node = parsed.nodes.find((item) => item.id === nodeId);
  return createPreviewSelection(node?.sourceLines ?? []);
}

function buildFlowchartEdgeSelection(from, to) {
  const parsed = previewSourceMap?.type === "flowchart" ? previewSourceMap.parsed : null;
  if (!parsed || !from || !to) {
    return null;
  }

  const lines = new Set();
  for (const edge of parsed.edges) {
    if (edge.from !== from || edge.to !== to) {
      continue;
    }

    addLineRange(lines, edge.lineStart, edge.lineEnd);
  }

  return createPreviewSelection(lines);
}

function buildSequenceParticipantSelection(participantId) {
  const parsed = previewSourceMap?.type === "sequence" ? previewSourceMap.parsed : null;
  if (!parsed || !participantId) {
    return null;
  }

  const participant = parsed.participants.find((item) => item.id === participantId);
  const lines = new Set(participant?.sourceLines ?? []);

  for (const event of parsed.events) {
    if (!sequenceEventIncludesParticipant(event, participantId)) {
      continue;
    }

    addLineRange(lines, event.lineStart, event.lineEnd);
  }

  return createPreviewSelection(lines);
}

function buildSequenceMessageSelection(index) {
  const parsed = previewSourceMap?.type === "sequence" ? previewSourceMap.parsed : null;
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
    if (
      message.from === target.from &&
      message.to === target.to &&
      message.text === target.text
    ) {
      addLineRange(lines, message.lineStart, message.lineEnd);
    }
  }

  return createPreviewSelection(lines);
}

function buildSequenceNoteSelection(index) {
  const parsed = previewSourceMap?.type === "sequence" ? previewSourceMap.parsed : null;
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
    if (buildSequenceNoteKey(note) !== targetKey) {
      continue;
    }

    addLineRange(lines, note.lineStart, note.lineEnd);
  }

  return createPreviewSelection(lines);
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
  const normalizedLines = [...new Set([...lines].filter((line) => Number.isInteger(line) && line > 0))]
    .sort((left, right) => left - right);

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

function clearPreviewSourceSelection(options = {}) {
  previewHighlightedLines = new Set();
  previewPrimaryHighlightedLine = null;

  if (options.render !== false) {
    renderHighlightedCode();
  }
}

function applyPreviewSourceSelection(selection, options = {}) {
  previewHighlightedLines = new Set(selection.lines);
  previewPrimaryHighlightedLine = selection.primaryLine ?? selection.lines[0] ?? null;
  renderHighlightedCode();

  if (options.scrollIntoView && previewPrimaryHighlightedLine !== null) {
    scrollEditorToHighlightedLine(previewPrimaryHighlightedLine);
  }
}

function scrollEditorToHighlightedLine(lineNumber) {
  const lineHeight = Number.parseFloat(window.getComputedStyle(codeInput).lineHeight || "22");
  const targetTop = Math.max(0, (lineNumber - 1) * lineHeight - codeInput.clientHeight * 0.35);
  codeInput.scrollTop = targetTop;
  syncCodeHighlightScroll();
}

function renderHighlightedCode() {
  const source = codeInput.value || "";
  const highlightedLines = highlightMermaidCode(source).split("\n");
  const sourceLines = source.split("\n");

  codeHighlight.innerHTML = sourceLines
    .map((_, index) => renderHighlightedLine(index + 1, highlightedLines[index] ?? ""))
    .join("");
  syncCodeHighlightScroll();
}

function renderHighlightedLine(lineNumber, html) {
  const classes = ["code-line"];

  if (previewHighlightedLines.has(lineNumber)) {
    classes.push("code-line-highlighted");
  }

  if (previewPrimaryHighlightedLine === lineNumber) {
    classes.push("code-line-highlighted-primary");
  }

  return `<span class="${classes.join(" ")}">${html || "&#8203;"}</span>`;
}

function loadEditorFontSize() {
  const raw = Number.parseInt(window.localStorage.getItem(editorFontSizeStorageKey) ?? "", 10);
  if (!Number.isFinite(raw)) {
    return 14;
  }

  return Math.min(24, Math.max(12, raw));
}

function loadWorkspaceSidebarCollapsed() {
  return window.localStorage.getItem(workspaceSidebarCollapsedStorageKey) === "true";
}

function loadEditorPaneWidth() {
  const raw = Number.parseInt(window.localStorage.getItem(editorPaneWidthStorageKey) ?? "", 10);
  if (!Number.isFinite(raw)) {
    return 520;
  }

  return Math.min(960, Math.max(360, raw));
}

function loadWorkspaceSortMode() {
  const saved = window.localStorage.getItem(workspaceSortModeStorageKey);
  return ["updated", "created"].includes(saved) ? saved : "name";
}

function applyUiLanguage() {
  document.documentElement.lang = currentUiLanguage;
  document.documentElement.dataset.uiLanguage = currentUiLanguage;
  document.title = t("app.title");
  topbarTitle.textContent = t("app.title");
  projectsButton.textContent = t("nav.projects");
  settingsButton.setAttribute("aria-label", t("settings.label"));
  workspaceKicker.textContent = t("workspace.title");
  workspaceSortSelect.setAttribute("aria-label", t("workspace.sortAria"));

  for (const option of workspaceSortSelect.options) {
    option.textContent = t(`workspace.sort.${option.value}`);
  }

  workspaceRefreshButton.setAttribute("aria-label", t("workspace.refreshAria"));
  newDocumentButton.textContent = t("workspace.newFile");
  workspaceTree.setAttribute("aria-label", t("workspace.treeAria"));
  contextNewFileButton.textContent = t("workspace.context.newFile");
  contextNewFolderButton.textContent = t("workspace.context.newFolder");
  contextRenameButton.textContent = t("workspace.context.rename");
  contextDeleteButton.textContent = t("workspace.context.delete");
  editorEyebrow.textContent = t("editor.title");
  editorDocumentName.setAttribute("aria-label", t("editor.fileNameAria"));
  copyCodeButton.textContent = t("editor.copyCode");
  paneDivider.setAttribute("aria-label", t("preview.resizeAria"));
  previewEyebrow.textContent = t("preview.title");
  copyClipboardButton.textContent = t("preview.copyImage");
  exportButton.textContent = t("preview.export");
  previewEmpty.textContent = t("preview.empty");
  zoomInButton.setAttribute("aria-label", t("preview.zoomInAria"));
  zoomOutButton.setAttribute("aria-label", t("preview.zoomOutAria"));
  zoomFitButton.setAttribute("aria-label", t("preview.zoomFitAria"));
  encodingStatus.textContent = t("status.encoding");
  settingsEyebrow.textContent = t("settings.label");
  settingsTitle.textContent = t("settings.title");
  settingsCloseButton.setAttribute("aria-label", t("settings.closeAria"));
  settingsLanguageTitle.textContent = t("settings.language.title");
  settingsLanguageLabel.textContent = t("settings.language.label");
  settingsLanguageSelect.options[0].textContent = t("settings.language.en");
  settingsLanguageSelect.options[1].textContent = t("settings.language.zh-CN");
  settingsThemeTitle.textContent = t("settings.theme.title");
  themeModeOfficialButton.textContent = t("settings.theme.official");
  themeModeCustomButton.textContent = t("settings.theme.custom");
  settingsThemeLabel.textContent = t("settings.theme.label");
  settingsCustomConfigLabel.textContent = t("settings.customConfig.label");
  settingsCustomConfig.setAttribute("aria-label", t("settings.customConfig.aria"));
  settingsClipboardTitle.textContent = t("settings.clipboard.title");
  settingsClipboardLabel.textContent = t("settings.clipboard.label");
  settingsCancelButton.textContent = t("settings.cancel");
  settingsSaveButton.textContent = t("settings.save");

  applyWorkspaceSidebarState();
  renderDocumentState();
  renderWorkspaceState();
  updateCursorStatus();
  renderCurrentStatus();
}

function applyEditorFontSize() {
  codeEditorShell?.style.setProperty("--editor-font-size", `${editorFontSize}px`);
}

function applyWorkspaceSidebarState() {
  workspaceMain.classList.toggle("workspace-sidebar-collapsed", workspaceSidebarCollapsed);
  workspaceRail.dataset.state = workspaceSidebarCollapsed ? "collapsed" : "expanded";
  workspaceRail.setAttribute("aria-expanded", String(!workspaceSidebarCollapsed));
  workspaceRail.setAttribute(
    "aria-label",
    workspaceSidebarCollapsed ? t("workspace.toggle.expand") : t("workspace.toggle.collapse")
  );
}

function applyEditorPaneWidth() {
  workspaceMain.style.setProperty("--editor-pane-width", `${editorPaneWidth}px`);
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

function handleEditorKeydown(event) {
  handleEditorFontSizeKeydown(event);
  if (event.defaultPrevented) {
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  event.preventDefault();

  if (event.shiftKey) {
    outdentEditorSelection();
    return;
  }

  indentEditorSelection();
}

function indentEditorSelection() {
  const value = codeInput.value;
  const selectionStart = codeInput.selectionStart ?? 0;
  const selectionEnd = codeInput.selectionEnd ?? selectionStart;

  if (selectionStart === selectionEnd) {
    const nextValue = `${value.slice(0, selectionStart)}${editorIndentUnit}${value.slice(selectionEnd)}`;
    applyEditorTextEdit(
      nextValue,
      selectionStart + editorIndentUnit.length,
      selectionStart + editorIndentUnit.length
    );
    return;
  }

  const range = getEditorSelectedLineRange(value, selectionStart, selectionEnd);
  const lines = value.slice(range.lineStart, range.lineEnd).split("\n");
  const nextBlock = lines.map((line) => `${editorIndentUnit}${line}`).join("\n");
  const nextValue = `${value.slice(0, range.lineStart)}${nextBlock}${value.slice(range.lineEnd)}`;
  const nextSelectionStart = selectionStart + editorIndentUnit.length;
  const nextSelectionEnd = selectionEnd + editorIndentUnit.length * lines.length;

  applyEditorTextEdit(nextValue, nextSelectionStart, nextSelectionEnd);
}

function outdentEditorSelection() {
  const value = codeInput.value;
  const selectionStart = codeInput.selectionStart ?? 0;
  const selectionEnd = codeInput.selectionEnd ?? selectionStart;
  const range = getEditorSelectedLineRange(value, selectionStart, selectionEnd);
  const lines = value.slice(range.lineStart, range.lineEnd).split("\n");

  let removedBeforeSelectionStart = 0;
  let removedBeforeSelectionEnd = 0;
  let currentLineStart = range.lineStart;

  const nextLines = lines.map((line, index) => {
    const removed = getLeadingIndentRemovalLength(line);

    if (index === 0) {
      removedBeforeSelectionStart = Math.min(removed, selectionStart - currentLineStart);
    }

    const lineSelectionEndOffset = Math.max(
      0,
      Math.min(line.length, selectionEnd - currentLineStart)
    );
    removedBeforeSelectionEnd += Math.min(removed, lineSelectionEndOffset);

    currentLineStart += line.length + 1;
    return line.slice(removed);
  });

  const nextBlock = nextLines.join("\n");
  const nextValue = `${value.slice(0, range.lineStart)}${nextBlock}${value.slice(range.lineEnd)}`;
  const nextSelectionStart = Math.max(range.lineStart, selectionStart - removedBeforeSelectionStart);
  const nextSelectionEnd = Math.max(nextSelectionStart, selectionEnd - removedBeforeSelectionEnd);

  if (nextValue === value) {
    return;
  }

  applyEditorTextEdit(nextValue, nextSelectionStart, nextSelectionEnd);
}

function getEditorSelectedLineRange(value, selectionStart, selectionEnd) {
  const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart) - 1) + 1;
  const effectiveEnd =
    selectionEnd > selectionStart && value[selectionEnd - 1] === "\n"
      ? selectionEnd - 1
      : selectionEnd;
  const lineEndIndex = value.indexOf("\n", Math.max(lineStart, effectiveEnd));

  return {
    lineStart,
    lineEnd: lineEndIndex === -1 ? value.length : lineEndIndex
  };
}

function getLeadingIndentRemovalLength(line) {
  if (line.startsWith(editorIndentUnit)) {
    return editorIndentUnit.length;
  }

  if (line.startsWith("\t")) {
    return 1;
  }

  const leadingSpaces = line.match(/^ +/)?.[0].length ?? 0;
  return Math.min(editorIndentUnit.length, leadingSpaces);
}

function applyEditorTextEdit(nextValue, nextSelectionStart, nextSelectionEnd) {
  codeInput.value = nextValue;
  codeInput.setSelectionRange(nextSelectionStart, nextSelectionEnd);
  clearPreviewSourceSelection({ render: false });
  markDocumentDirty();
  updateCursorStatus();
  renderHighlightedCode();
  scheduleAutoSave();
  scheduleRender();
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

function toggleWorkspaceSidebar() {
  workspaceSidebarCollapsed = !workspaceSidebarCollapsed;
  window.localStorage.setItem(
    workspaceSidebarCollapsedStorageKey,
    String(workspaceSidebarCollapsed)
  );
  applyWorkspaceSidebarState();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      renderHighlightedCode();
      syncCodeHighlightScroll();
      fitPreviewToFrame({ resetViewport: true });
    });
  });
}

function handlePaneResizeStart(event) {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  paneResizeState = {
    startX: event.clientX,
    startWidth: editorPaneWidth
  };
  workspaceMain.classList.add("workspace-main-resizing");
}

function handlePaneResizeMove(event) {
  if (!paneResizeState) {
    return;
  }

  const bounds = workspaceMain.getBoundingClientRect();
  const sidebarWidth = workspaceSidebarCollapsed ? 56 : 272;
  const dividerWidth = 10;
  const minEditorWidth = 360;
  const minPreviewWidth = 320;
  const maxEditorWidth = Math.max(
    minEditorWidth,
    Math.floor(bounds.width - sidebarWidth - dividerWidth - minPreviewWidth)
  );
  const nextWidth = paneResizeState.startWidth + (event.clientX - paneResizeState.startX);
  editorPaneWidth = Math.min(maxEditorWidth, Math.max(minEditorWidth, Math.round(nextWidth)));
  applyEditorPaneWidth();
  fitPreviewToFrame();
}

function stopPaneResize() {
  if (!paneResizeState) {
    return;
  }

  paneResizeState = null;
  workspaceMain.classList.remove("workspace-main-resizing");
  window.localStorage.setItem(editorPaneWidthStorageKey, String(editorPaneWidth));
  fitPreviewToFrame({ resetViewport: true });
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
  try {
    return getDesktopApi(requiredMethods);
  } catch (error) {
    const message = String(error?.message ?? error);
    if (message.includes("missing")) {
      throw new Error(t("error.electronApiOutdated", { method: requiredMethods[0] ?? "unknown" }));
    }

    throw new Error(t("error.electronApiUnavailable"));
  }
}

function getSupportedSourceForPptx() {
  if (!isPptExportableSource(codeInput.value)) {
    throw new Error(t("error.pptUnsupported"));
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
    expandedPaths: new Set(),
    sortMode: loadWorkspaceSortMode()
  };
}

function renderDocumentState() {
  topbarWorkspacePath.textContent = currentWorkspace.rootPath
    ? currentWorkspace.rootPath
    : t("workspace.noneSelected");
  editorDocumentName.value = getDocumentNameBase(currentDocument.name);
  editorDocumentName.disabled = !(currentDocument.kind === "mermaid-file" && currentDocument.path);
  updateEditorDocumentNameWidth();
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

function updateEditorDocumentNameWidth() {
  const value = editorDocumentName.value || "";
  const styles = window.getComputedStyle(editorDocumentName);
  if (!editorDocumentNameMeasureContext) {
    editorDocumentNameMeasureContext = document.createElement("canvas").getContext("2d");
  }

  const font = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
  if (editorDocumentNameMeasureContext) {
    editorDocumentNameMeasureContext.font = font;
  }
  const measuredWidth = editorDocumentNameMeasureContext
    ? editorDocumentNameMeasureContext.measureText(value || " ").width
    : value.length * 8;

  const horizontalPadding =
    Number.parseFloat(styles.paddingLeft || "0") +
    Number.parseFloat(styles.paddingRight || "0") +
    4;
  const nextWidth = Math.min(360, Math.max(20, Math.ceil(measuredWidth + horizontalPadding)));
  editorDocumentName.style.width = `${nextWidth}px`;
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
  newDocumentButton.disabled = !hasWorkspace;
  workspaceRefreshButton.disabled = !hasWorkspace;
  workspaceSortSelect.disabled = !hasWorkspace;
  workspaceSortSelect.value = currentWorkspace.sortMode;
  workspaceTree.innerHTML = "";
  workspaceTree.classList.toggle("workspace-tree-drop-root", workspaceDropTarget?.mode === "root");
  workspaceEmpty.classList.toggle("workspace-tree-drop-root", workspaceDropTarget?.mode === "root");
  workspaceEmpty.hidden = hasWorkspace && currentWorkspace.tree && hasMmdFiles(currentWorkspace.tree);

  if (!hasWorkspace || !currentWorkspace.tree) {
    workspaceEmpty.hidden = false;
    workspaceEmpty.textContent = t("workspace.empty.choose");
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const child of currentWorkspace.tree.children ?? []) {
    fragment.appendChild(renderWorkspaceNode(child, 0));
  }
  workspaceTree.appendChild(fragment);

  if (!workspaceTree.children.length) {
    workspaceEmpty.hidden = false;
    workspaceEmpty.textContent = t("workspace.empty.noFiles");
  } else {
    workspaceEmpty.hidden = true;
  }
}

function renderWorkspaceNode(node, depth) {
  const group = document.createElement("div");
  group.className = "tree-group";

  const isEditing = inlineRenameState?.path === node.path;
  const row = document.createElement("div");
  row.dataset.path = node.path;
  row.dataset.type = node.type;
  row.className = `tree-row ${node.type === "directory" ? "tree-row-directory" : "tree-row-file"}`;
  row.style.paddingLeft = `${10 + depth * 18}px`;
  row.setAttribute("role", "button");
  row.tabIndex = 0;
  row.draggable = !isEditing;

  if (node.type === "file" && isWorkspaceFileSelected(node.path)) {
    row.classList.add("tree-row-active");
  }

  if (
    (workspaceDropTarget?.mode === "inside" && workspaceDropTarget.path === node.path) ||
    (workspaceDropTarget?.mode === "sibling" && workspaceDropTarget.anchorPath === node.path)
  ) {
    row.classList.add("tree-row-drop-target");
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
    input.setAttribute("aria-label", node.type === "file" ? t("rename.fileAria") : t("rename.folderAria"));
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
    const api = getDesktopApi(["chooseWorkspaceDirectory"]);
    await autoSaveCurrentDocumentIfPossible();
    const result = await api.chooseWorkspaceDirectory({ sortMode: currentWorkspace.sortMode });

    if (result.canceled) {
      return;
    }

    await applyWorkspace(result.rootPath, result.tree, null);
    updateStatusByKey("success", "status.workspaceBadge", "status.workspaceOpened", {
      path: result.rootPath
    });
  } catch (error) {
    updateStatus("error", t("status.workspaceErrorBadge"), normalizeError(error));
  }
}

async function refreshWorkspaceTree() {
  if (!currentWorkspace.rootPath) {
    return;
  }

  try {
    await loadWorkspace(currentWorkspace.rootPath, currentDocument.path);
    updateStatusByKey("success", "status.workspaceBadge", "status.workspaceRefreshed");
  } catch (error) {
    updateStatus("error", t("status.workspaceErrorBadge"), normalizeError(error));
  }
}

async function handleWorkspaceSortChange(event) {
  const nextSortMode = normalizeWorkspaceSortModeValue(event.currentTarget.value);
  if (nextSortMode === currentWorkspace.sortMode) {
    return;
  }

  currentWorkspace.sortMode = nextSortMode;
  window.localStorage.setItem(workspaceSortModeStorageKey, nextSortMode);

  if (!currentWorkspace.rootPath) {
    renderWorkspaceState();
    return;
  }

  try {
    await loadWorkspace(currentWorkspace.rootPath, currentDocument.path);
    updateStatusByKey("success", "status.workspaceBadge", "status.workspaceSorted", {
      sortMode: describeWorkspaceSortMode(nextSortMode)
    });
  } catch (error) {
    updateStatus("error", t("status.workspaceErrorBadge"), normalizeError(error));
  }
}

function normalizeWorkspaceSortModeValue(sortMode) {
  return ["updated", "created"].includes(sortMode) ? sortMode : "name";
}

function describeWorkspaceSortMode(sortMode) {
  if (sortMode === "updated") {
    return t("workspace.sort.description.updated");
  }

  if (sortMode === "created") {
    return t("workspace.sort.description.created");
  }

  return t("workspace.sort.description.name");
}

async function loadWorkspace(rootPath, preferredFilePath) {
  const api = getDesktopApi(["readWorkspaceTree"]);
  const result = await api.readWorkspaceTree({
    rootPath,
    sortMode: currentWorkspace.sortMode
  });
  await applyWorkspace(rootPath, result.tree, preferredFilePath);
}

async function applyWorkspace(rootPath, tree, preferredFilePath) {
  currentWorkspace = {
    rootPath,
    tree,
    expandedPaths: collectDirectoryPaths(tree),
    sortMode: currentWorkspace.sortMode
  };
  window.localStorage.setItem(workspaceRootStorageKey, rootPath);
  renderWorkspaceState();

  const targetFilePath = resolveWorkspaceSelection(tree, preferredFilePath);
  if (targetFilePath) {
    await openWorkspaceFile(targetFilePath, { skipAutosave: true });
  } else {
    codeInput.value = "";
    clearPreviewSourceSelection({ render: false });
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

async function handleWorkspaceTreeKeydown(event) {
  if (!(event.key === "Enter" || event.key === " ")) {
    return;
  }

  const row = event.target.closest(".tree-row");
  if (!row) {
    return;
  }

  if (event.target.closest(".tree-row-inline-editor")) {
    return;
  }

  event.preventDefault();

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

function handleWorkspaceDragStart(event) {
  const row = event.target.closest(".tree-row");
  if (!row || inlineRenameState) {
    event.preventDefault();
    return;
  }

  workspaceDragState = {
    path: row.dataset.path,
    type: row.dataset.type
  };
  workspaceDropTarget = null;

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", row.dataset.path);
  }
}

function handleWorkspaceDragOver(event) {
  if (!workspaceDragState || !currentWorkspace.rootPath) {
    return;
  }

  const nextTarget = resolveWorkspaceDropTarget(event);
  if (!nextTarget || !canDropWorkspaceEntry(workspaceDragState.path, nextTarget.path)) {
    setWorkspaceDropTarget(null);
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  setWorkspaceDropTarget(nextTarget);
}

function handleWorkspaceDragLeave(event) {
  const currentTarget = event.currentTarget;
  if (currentTarget?.contains(event.relatedTarget)) {
    return;
  }

  if (workspaceDropTarget?.mode === "root" || currentTarget === workspaceTree) {
    setWorkspaceDropTarget(null);
  }
}

async function handleWorkspaceDrop(event) {
  if (!workspaceDragState || !currentWorkspace.rootPath) {
    return;
  }

  const nextTarget = resolveWorkspaceDropTarget(event);
  if (!nextTarget || !canDropWorkspaceEntry(workspaceDragState.path, nextTarget.path)) {
    clearWorkspaceDragState();
    return;
  }

  event.preventDefault();
  const dragState = workspaceDragState;
  clearWorkspaceDragState();

  try {
    await moveWorkspaceEntryToTarget(dragState.path, nextTarget.path);
  } catch (error) {
    updateStatus("error", t("status.moveErrorBadge"), normalizeError(error));
  }
}

function clearWorkspaceDragState() {
  workspaceDragState = null;
  setWorkspaceDropTarget(null);
}

function setWorkspaceDropTarget(nextTarget) {
  const previousKey = workspaceDropTarget
    ? `${workspaceDropTarget.mode}:${workspaceDropTarget.path}:${workspaceDropTarget.anchorPath ?? ""}`
    : "";
  const nextKey = nextTarget
    ? `${nextTarget.mode}:${nextTarget.path}:${nextTarget.anchorPath ?? ""}`
    : "";
  if (previousKey === nextKey) {
    return;
  }

  workspaceDropTarget = nextTarget;
  renderWorkspaceState();
}

function resolveWorkspaceDropTarget(event) {
  const row = event.target.closest(".tree-row");
  if (row?.dataset.type === "directory") {
    return {
      mode: "inside",
      path: row.dataset.path
    };
  }

  if (row) {
    return {
      mode: "sibling",
      path: dirname(row.dataset.path),
      anchorPath: row.dataset.path
    };
  }

  if (event.currentTarget === workspaceTree || event.currentTarget === workspaceEmpty) {
    return {
      mode: "root",
      path: currentWorkspace.rootPath
    };
  }

  return null;
}

function canDropWorkspaceEntry(sourcePath, targetParentPath) {
  if (!sourcePath || !targetParentPath) {
    return false;
  }

  if (sourcePath === targetParentPath) {
    return false;
  }

  if (dirname(sourcePath) === targetParentPath) {
    return false;
  }

  return !isSameOrDescendantPath(targetParentPath, sourcePath);
}

async function moveWorkspaceEntryToTarget(sourcePath, targetParentPath) {
  const affectsCurrentDocument = isSameOrDescendantPath(currentDocument.path, sourcePath);
  if (affectsCurrentDocument) {
    await autoSaveCurrentDocumentIfPossible();
  }

  const api = getDesktopApi(["moveWorkspaceEntry"]);
  const result = await api.moveWorkspaceEntry({
    path: sourcePath,
    targetParentPath,
    rootPath: currentWorkspace.rootPath
  });

  const preferredPath = remapMovedPath(currentDocument.path, sourcePath, result.path) ?? currentDocument.path;
  await loadWorkspace(currentWorkspace.rootPath, preferredPath);
  updateStatusByKey("success", "status.movedBadge", "status.workspaceMoved", {
    name: basename(sourcePath)
  });
}

function remapMovedPath(originalPath, sourcePath, targetPath) {
  if (!originalPath) {
    return null;
  }

  if (originalPath === sourcePath) {
    return targetPath;
  }

  if (!isSameOrDescendantPath(originalPath, sourcePath)) {
    return originalPath;
  }

  return `${targetPath}${originalPath.slice(sourcePath.length)}`;
}

function isSameOrDescendantPath(candidatePath, targetPath) {
  if (!candidatePath || !targetPath) {
    return false;
  }

  return (
    candidatePath === targetPath ||
    candidatePath.startsWith(`${targetPath}/`) ||
    candidatePath.startsWith(`${targetPath}\\`)
  );
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
    const api = getDesktopApi(["createWorkspaceEntry"]);
    const result = await api.createWorkspaceEntry({
      parentPath: targetParentPath,
      kind
    });

    await loadWorkspace(currentWorkspace.rootPath, result.kind === "file" ? result.path : currentDocument.path);

    if (result.kind === "file") {
      await openWorkspaceFile(result.path, { skipAutosave: true });
      updateStatusByKey("success", "status.createdBadge", "status.workspaceCreated", {
        name: basename(result.path)
      });
    } else {
      updateStatusByKey("success", "status.createdBadge", "status.workspaceCreated", {
        name: basename(result.path)
      });
    }
  } catch (error) {
    updateStatus("error", t("status.workspaceErrorBadge"), normalizeError(error));
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
    const api = getDesktopApi(["deleteWorkspaceEntry"]);
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
    updateStatusByKey("success", "status.archivedBadge", "status.workspaceArchived", {
      name: targetName
    });
  } catch (error) {
    updateStatus("error", t("status.deleteErrorBadge"), normalizeError(error));
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

    const api = getDesktopApi(["renameWorkspaceEntry"]);
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

    updateStatusByKey("success", "status.renamedBadge", "status.workspaceRenamed", {
      name: basename(target.path)
    });
  } catch (error) {
    cancelInlineRename();
    updateStatus("error", t("status.renameErrorBadge"), normalizeError(error));
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
    const api = getDesktopApi(["renameWorkspaceEntry"]);
    const result = await api.renameWorkspaceEntry({
      path: currentDocument.path,
      nextName
    });

    setCurrentDocument({
      name: basename(result.path),
      path: result.path
    });
    await loadWorkspace(currentWorkspace.rootPath, result.path);
    updateStatusByKey("success", "status.renamedBadge", "status.workspaceFileRenamed", {
      name: basename(result.path)
    });
  } catch (error) {
    editorDocumentName.value = getDocumentNameBase(currentDocument.name);
    updateStatus("error", t("status.renameErrorBadge"), normalizeError(error));
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
    const api = getDesktopApi(["writeTextFile"]);
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

    const api = getDesktopApi(["readTextFile"]);
    const result = await api.readTextFile({ filePath });
    codeInput.value = result.text;
    clearPreviewSourceSelection({ render: false });
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
    updateStatus("error", t("status.fileErrorBadge"), normalizeError(error));
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
  settingsDraftUiLanguage = currentUiLanguage;
  settingsThemeSelect.value = resolveOfficialTheme(currentMermaidConfig.theme);
  settingsCustomConfig.value = lastValidConfigText;
  settingsClipboardFormat.value = loadClipboardFormat();
  settingsLanguageSelect.value = settingsDraftUiLanguage;
  setSettingsThemeMode(settingsDraftThemeMode);
  settingsModal.hidden = false;
}

function closeSettingsModal() {
  settingsModal.hidden = true;
}

function setSettingsThemeMode(mode) {
  settingsDraftThemeMode = mode === "custom" ? "custom" : "official";
  settingsOfficialThemeField.hidden = settingsDraftThemeMode === "custom";
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
    currentUiLanguage = normalizeUiLanguage(settingsLanguageSelect.value);
    settingsDraftUiLanguage = currentUiLanguage;
    currentMermaidConfig = nextConfig;
    currentPptTheme = buildPptThemeFromMermaidConfig(nextConfig);
    lastValidConfigText = nextText;
    window.localStorage.setItem(mermaidConfigStorageKey, nextText);
    window.localStorage.setItem(mermaidThemeModeStorageKey, currentThemeMode);
    window.localStorage.setItem(uiLanguageStorageKey, currentUiLanguage);
    saveClipboardFormat(settingsClipboardFormat.value);
    applyUiLanguage();
    applyPreviewTheme(currentPptTheme);
    scheduleRender();
    closeSettingsModal();
    updateStatusByKey("success", "status.settingsSavedBadge", "status.settingsSaved");
  } catch (error) {
    updateStatus("error", t("status.settingsErrorBadge"), normalizeError(error));
  }
}

function toggleExportMenu() {
  workspaceContextMenu.hidden = true;
  contextMenuTarget = null;
  exportMenu.hidden = !exportMenu.hidden;
}

function adjustPreviewScale(delta) {
  previewAutoFit = false;
  previewScale = Math.min(5, Math.max(0.5, Number((previewScale + delta).toFixed(2))));
  applyPreviewScale();
}

function resetPreviewScale() {
  previewAutoFit = true;
  previewScale = 1;
  applyPreviewScale({ resetViewport: true });
}

function fitPreviewToFrame(options = {}) {
  previewAutoFit = true;
  previewScale = 1;
  applyPreviewScale(options);
}

function applyPreviewScale(options = {}) {
  const svgElement = preview.querySelector("svg");

  if (!svgElement) {
    return;
  }

  previewFitScale = calculatePreviewFitScale();
  svgElement.style.width = `${Math.round(latestSvgDimensions.width * previewFitScale * previewScale)}px`;
  svgElement.style.height = "auto";

  if (options.resetViewport) {
    previewFrame.scrollLeft = 0;
    previewFrame.scrollTop = 0;
  }
}

function calculatePreviewFitScale() {
  const availableWidth = Math.max(120, previewFrame.clientWidth - getFrameHorizontalPadding());
  const availableHeight = Math.max(120, previewFrame.clientHeight - getFrameVerticalPadding());

  return Math.max(
    0.05,
    Math.min(
      availableWidth / latestSvgDimensions.width,
      availableHeight / latestSvgDimensions.height
    )
  );
}

function getFrameHorizontalPadding() {
  const styles = window.getComputedStyle(previewFrame);
  return (
    Number.parseFloat(styles.paddingLeft || "0") +
    Number.parseFloat(styles.paddingRight || "0")
  );
}

function getFrameVerticalPadding() {
  const styles = window.getComputedStyle(previewFrame);
  return (
    Number.parseFloat(styles.paddingTop || "0") +
    Number.parseFloat(styles.paddingBottom || "0")
  );
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
    throw new Error(t("error.clipboardWriteUnavailable"));
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
    throw new Error(t("error.canvasContextUnavailable"));
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
    image.onerror = () => reject(new Error(t("error.rasterizeFailed")));
    image.src = url;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(t("error.canvasBlobEmpty")));
        return;
      }

      resolve(blob);
    }, mimeType, quality);
  });
}
