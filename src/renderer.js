import mermaid from "../node_modules/mermaid/dist/mermaid.esm.min.mjs";
import {
  buildPptThemeFromMermaidConfig,
  createDefaultMermaidConfig,
  normalizeMermaidConfig,
  parseMermaidConfigText,
  resolveOfficialTheme,
  stringifyMermaidConfig
} from "./mermaid-config.js";
import {
  getAvailableDesktopApiKeys,
  getDesktopApi,
  isTauriEnvironment,
  listenToTauriEvent
} from "./platform/desktop-api.js";
import {
  buildAiRequestPayload,
  buildLineDiffSummary,
  buildUnifiedDiffModel,
  hasMeaningfulDiagram,
  normalizeAiBaseUrl,
  resolveAiActionMode,
  sanitizeAiMermaidText,
  validateAiSettingsDraft
} from "./ai-utils.js";
import { createCodeEditorAdapter } from "./editor/cm-editor.js";
import { layoutClassDiagram } from "./ppt/class/layout.js";
import { parseClassSource } from "./ppt/class/parse.js";
import { layoutFlowchart } from "./ppt/flowchart/layout.js";
import { buildDiagramPptxBytes } from "./ppt/export-pptx.js";
import { layoutErDiagram } from "./ppt/er/layout.js";
import { parseErSource } from "./ppt/er/parse.js";
import { parseFlowchartSource } from "./ppt/flowchart/parse.js";
import { layoutJourney } from "./ppt/journey/layout.js";
import { parseJourneySource } from "./ppt/journey/parse.js";
import { getVisiblePieSections, layoutPie } from "./ppt/pie/layout.js";
import { parsePieSource } from "./ppt/pie/parse.js";
import { layoutStateDiagram } from "./ppt/state/layout.js";
import { parseStateSource } from "./ppt/state/parse.js";
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
const codeEditorHost = document.querySelector("#code-editor-host");
const codeEditorShell = document.querySelector("#editor-code-shell");
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
const settingsTablist = document.querySelector("#settings-tablist");
const settingsTabGeneral = document.querySelector("#settings-tab-general");
const settingsTabAi = document.querySelector("#settings-tab-ai");
const settingsContent = document.querySelector("#settings-content");
const settingsPanelGeneral = document.querySelector("#settings-panel-general");
const settingsPanelAi = document.querySelector("#settings-panel-ai");
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
const settingsAiTitle = document.querySelector("#settings-ai-title");
const settingsAiPromptsTitle = document.querySelector("#settings-ai-prompts-title");
const settingsAiEnabledLabel = document.querySelector("#settings-ai-enabled-label");
const settingsAiEnabled = document.querySelector("#settings-ai-enabled");
const settingsAiBaseUrlLabel = document.querySelector("#settings-ai-base-url-label");
const settingsAiBaseUrl = document.querySelector("#settings-ai-base-url");
const settingsAiModelLabel = document.querySelector("#settings-ai-model-label");
const settingsAiModel = document.querySelector("#settings-ai-model");
const settingsAiTokenLabel = document.querySelector("#settings-ai-token-label");
const settingsAiToken = document.querySelector("#settings-ai-token");
const settingsAiSystemPromptLabel = document.querySelector("#settings-ai-system-prompt-label");
const settingsAiSystemPrompt = document.querySelector("#settings-ai-system-prompt");
const settingsAiUserPromptLabel = document.querySelector("#settings-ai-user-prompt-label");
const settingsAiUserPrompt = document.querySelector("#settings-ai-user-prompt");
const settingsAiPromptNote = document.querySelector("#settings-ai-prompt-note");
const settingsAiTokenStatus = document.querySelector("#settings-ai-token-status");
const settingsAiTestButton = document.querySelector("#settings-ai-test");
const settingsAiClearToken = document.querySelector("#settings-ai-clear-token");
const settingsAiTestStatus = document.querySelector("#settings-ai-test-status");
const aiButton = document.querySelector("#ai-button");
const aiInlinePanel = document.querySelector("#ai-inline-panel");
const aiInlineKicker = document.querySelector("#ai-inline-kicker");
const aiInlineTitle = document.querySelector("#ai-inline-title");
const aiInlineModePill = document.querySelector("#ai-inline-mode-pill");
const aiInlinePromptLabel = document.querySelector("#ai-inline-prompt-label");
const aiInlinePromptInput = document.querySelector("#ai-inline-prompt-input");
const aiInlineGenerateButton = document.querySelector("#ai-inline-generate");
const aiInlineStatusChip = document.querySelector("#ai-inline-status-chip");
const aiInlineStatusText = document.querySelector("#ai-inline-status-text");
const aiInlineError = document.querySelector("#ai-inline-error");
const aiInlineFooter = document.querySelector(".ai-inline-footer");
const aiInlineAdjustButton = document.querySelector("#ai-inline-adjust");
const aiInlineRejectButton = document.querySelector("#ai-inline-reject");
const aiInlineAcceptButton = document.querySelector("#ai-inline-accept");
const aiModal = document.querySelector("#ai-modal");
const aiBackdrop = document.querySelector("#ai-backdrop");
const aiCloseButton = document.querySelector("#ai-close");
const aiEyebrow = document.querySelector("#ai-eyebrow");
const aiTitle = document.querySelector("#ai-title");
const aiModeNewButton = document.querySelector("#ai-mode-new");
const aiModeMergeButton = document.querySelector("#ai-mode-merge");
const aiContextNote = document.querySelector("#ai-context-note");
const aiPromptLabel = document.querySelector("#ai-prompt-label");
const aiPromptInput = document.querySelector("#ai-prompt-input");
const aiGenerateButton = document.querySelector("#ai-generate");
const aiStatusChip = document.querySelector("#ai-status-chip");
const aiStatusText = document.querySelector("#ai-status-text");
const aiResultSection = document.querySelector("#ai-result-section");
const aiResultKicker = document.querySelector("#ai-result-kicker");
const aiResultTitle = document.querySelector("#ai-result-title");
const aiResultSummary = document.querySelector("#ai-result-summary");
const aiCodePanelTitle = document.querySelector("#ai-code-panel-title");
const aiModelPill = document.querySelector("#ai-model-pill");
const aiResultCode = document.querySelector("#ai-result-code");
const aiDiffPanel = document.querySelector("#ai-diff-panel");
const aiDiffPanelTitle = document.querySelector("#ai-diff-panel-title");
const aiDiffSummary = document.querySelector("#ai-diff-summary");
const aiDiffBeforeLabel = document.querySelector("#ai-diff-before-label");
const aiDiffBefore = document.querySelector("#ai-diff-before");
const aiDiffAfterLabel = document.querySelector("#ai-diff-after-label");
const aiDiffAfter = document.querySelector("#ai-diff-after");
const aiErrorMessage = document.querySelector("#ai-error-message");
const aiCancelButton = document.querySelector("#ai-cancel");
const aiCopyButton = document.querySelector("#ai-copy");
const aiApplyButton = document.querySelector("#ai-apply");
const exportMenuItems = [exportPptxButton, exportSvgButton, exportPngButton, exportJpgButton];
const workspaceContextMenuItems = [
  contextNewFileButton,
  contextNewFolderButton,
  contextRenameButton,
  contextDeleteButton
];
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
const maskedSavedTokenValue = "saved-token-mask";

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
let settingsActiveTab = "general";
let aiSettingsState = createDefaultAiSettingsState();
let settingsDraftAi = createDefaultAiSettingsState();
let settingsAiTestState = {
  running: false,
  tone: "idle",
  message: ""
};
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
let workspaceSuppressClickUntil = 0;
let menuDismissGuardUntil = 0;
let editorDocumentNameMeasureContext = null;
let codeEditor = null;
let clipboardRasterCache = {
  key: "",
  blob: null,
  bytes: null
};
let currentStatusDescriptor = {
  type: "key",
  state: "idle",
  badgeKey: "status.readyBadge",
  messageKey: "status.idleMessage",
  vars: {}
};
let settingsModalCloseTimer = null;
let aiModalCloseTimer = null;
let aiRequestSequence = 0;
let aiDialogState = createDefaultAiDialogState();
let aiInlineState = createDefaultAiInlineState();
let aiInlineValidationTimer = null;
let aiInlineValidationSequence = 0;
let aiStreamListenerPromise = null;
const aiStreamEventName = "ai://generate-chunk";

const previewWheelZoomStep = 0.02;
const editorIndentUnit = "  ";
const defaultAiSystemPromptTemplate = `You generate Mermaid code for desktop diagram authoring.
Return Mermaid source code only.
Do not use markdown fences.
Do not add explanations.
Prefer flowchart TD unless the user clearly describes actors, messages, or lifelines that fit sequenceDiagram.
For flowchart nodes, do not use HTML tags like <br/> in labels. If a label contains parentheses or dense punctuation, use a quoted label such as A["Start (details)"].
Use ASCII node ids and keep labels human-readable.
If existing Mermaid is provided, preserve unchanged structure where possible and return the full updated Mermaid document.`;
const defaultAiUserPromptTemplate = `User request:
{{prompt}}

{{mode_instruction}}

{{current_diagram_section}}{{repair_section}}`;
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
    "status.testSuccessBadge": "Connection ok",
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
    "status.settingsSaved": "Theme, language, clipboard, and AI preferences updated.",
    "settings.title": "Workspace Preferences",
    "settings.label": "Settings",
    "settings.closeAria": "Close settings",
    "settings.tabs.aria": "Settings sections",
    "settings.tabs.general": "General",
    "settings.tabs.ai": "AI Settings",
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
    "settings.ai.title": "AI+",
    "settings.ai.connectionTitle": "Connection",
    "settings.ai.promptsTitle": "Prompt Templates",
    "settings.ai.enabled": "Enable AI+",
    "settings.ai.baseUrl": "API Base URL",
    "settings.ai.model": "Model",
    "settings.ai.token": "API Token",
    "settings.ai.systemPrompt": "System Prompt Template",
    "settings.ai.userPrompt": "User Prompt Template",
    "settings.ai.promptNote":
      "Supported placeholders: {{prompt}}, {{mode_instruction}}, {{current_diagram_section}}, {{repair_section}}",
    "settings.ai.clearToken": "Clear token",
    "settings.ai.clearTokenUndo": "Keep token",
    "settings.ai.tokenSaved": "Token saved securely.",
    "settings.ai.tokenWillReplace": "A new token will replace the saved token.",
    "settings.ai.tokenWillClear": "The saved token will be cleared on save.",
    "settings.ai.tokenMissing": "No token saved.",
    "settings.ai.test": "Test connection",
    "settings.ai.testRunning": "Testing...",
    "settings.ai.testSuccess": "Connection test passed for {host}.",
    "settings.cancel": "Cancel",
    "settings.save": "Save",
    "ai.label": "AI+",
    "ai.button.new": "AI Generate",
    "ai.button.modify": "AI Modify",
    "ai.closeAria": "Close AI+",
    "ai.title": "Generate Mermaid from text",
    "ai.mode.new": "New Diagram",
    "ai.mode.merge": "Update Current",
    "ai.context.new": "Describe the flow you want and AI+ will draft fresh Mermaid code.",
    "ai.context.merge": "Describe the change you want and AI+ will merge it into the current diagram.",
    "ai.prompt.label": "Prompt",
    "ai.prompt.placeholder": "Describe the process, decisions, and labels you want in the diagram.",
    "ai.generate": "Generate",
    "ai.regenerate": "Regenerate",
    "ai.status.idle": "Idle",
    "ai.status.idleMessage": "Waiting for your prompt.",
    "ai.status.generating": "Generating",
    "ai.status.generatingMessage": "Streaming Mermaid into the editor...",
    "ai.status.repairing": "Repairing",
    "ai.status.repairingMessage": "The first draft failed validation. Repairing and streaming the updated Mermaid draft...",
    "ai.status.valid": "Validated",
    "ai.status.validMessage": "Generated Mermaid passed local validation.",
    "ai.status.invalid": "Needs Fix",
    "ai.status.invalidMessage": "AI+ returned Mermaid that still failed local validation.",
    "ai.status.applied": "Applied",
    "ai.status.appliedMessage": "AI+ Mermaid has replaced the editor content.",
    "ai.result": "Result",
    "ai.result.title": "Generated Mermaid",
    "ai.result.code": "Generated code",
    "ai.result.diffTitle": "Diff vs current",
    "ai.result.validSummary": "Validated Mermaid code.",
    "ai.result.repairedSummary": "Validated Mermaid code after one automatic repair pass.",
    "ai.result.invalidSummary": "AI+ returned Mermaid code, but local validation still failed.",
    "ai.inline.title.new": "Generate Mermaid Draft",
    "ai.inline.title.modify": "Modify Current Mermaid",
    "ai.inline.mode.new": "New",
    "ai.inline.mode.modify": "Modify",
    "ai.inline.adjust": "Adjust",
    "ai.inline.editorTitle": "Proposed Mermaid",
    "ai.inline.diffTitle": "Unified Diff",
    "ai.inline.diffEmpty": "No changes yet.",
    "ai.inline.reject": "Discard",
    "ai.inline.accept": "Accept",
    "ai.inline.discardConfirm": "Discard the current AI draft and restore the previous editor content?",
    "ai.result.model": "model",
    "ai.diff.before": "Current",
    "ai.diff.after": "Proposed",
    "ai.diff.none": "No textual diff.",
    "ai.diff.summary": "{added} added, {removed} removed",
    "ai.error.emptyPrompt": "Enter a prompt before generating Mermaid.",
    "ai.error.settingsIncomplete": "Enable AI+ and finish the API settings before generating.",
    "ai.error.testIncomplete": "Base URL, model, and token are required before testing.",
    "ai.error.mergeUnavailable": "There is no current diagram to merge into.",
    "ai.error.copyUnavailable": "No generated Mermaid is available to copy.",
    "ai.error.applyUnavailable": "The current AI+ result cannot be applied.",
    "ai.copy": "Copy",
    "ai.apply": "Apply",
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
    "error.pptUnsupported": "PPT export currently supports Flowchart, Sequence, Pie, Journey, Class, ER, and State diagrams only.",
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
    "status.testSuccessBadge": "连接正常",
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
    "status.settingsSaved": "主题、语言、剪贴板和 AI 偏好已更新。",
    "settings.title": "工作区偏好设置",
    "settings.label": "设置",
    "settings.closeAria": "关闭设置",
    "settings.tabs.aria": "设置分组",
    "settings.tabs.general": "基础设置",
    "settings.tabs.ai": "AI 设置",
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
    "settings.ai.title": "AI+",
    "settings.ai.connectionTitle": "连接配置",
    "settings.ai.promptsTitle": "Prompt 模板",
    "settings.ai.enabled": "启用 AI+",
    "settings.ai.baseUrl": "API Base URL",
    "settings.ai.model": "模型",
    "settings.ai.token": "API Token",
    "settings.ai.systemPrompt": "系统 Prompt 模板",
    "settings.ai.userPrompt": "用户 Prompt 模板",
    "settings.ai.promptNote":
      "支持占位符：{{prompt}}、{{mode_instruction}}、{{current_diagram_section}}、{{repair_section}}",
    "settings.ai.clearToken": "清除 token",
    "settings.ai.clearTokenUndo": "保留 token",
    "settings.ai.tokenSaved": "Token 已安全保存。",
    "settings.ai.tokenWillReplace": "保存后将用新的 token 替换已保存的 token。",
    "settings.ai.tokenWillClear": "保存后将清除已保存的 token。",
    "settings.ai.tokenMissing": "当前没有已保存的 token。",
    "settings.ai.test": "测试连接",
    "settings.ai.testRunning": "测试中...",
    "settings.ai.testSuccess": "{host} 连接测试通过。",
    "settings.cancel": "取消",
    "settings.save": "保存",
    "ai.label": "AI+",
    "ai.button.new": "AI 新建",
    "ai.button.modify": "AI 修改",
    "ai.closeAria": "关闭 AI+",
    "ai.title": "通过文本生成 Mermaid",
    "ai.mode.new": "新建图",
    "ai.mode.merge": "更新当前图",
    "ai.context.new": "描述你想要的流程，AI+ 会生成一份新的 Mermaid 代码。",
    "ai.context.merge": "描述你想做的改动，AI+ 会在当前图基础上做合并更新。",
    "ai.prompt.label": "提示词",
    "ai.prompt.placeholder": "描述你想要的流程、分支判断和节点文案。",
    "ai.generate": "生成",
    "ai.regenerate": "重新生成",
    "ai.status.idle": "空闲",
    "ai.status.idleMessage": "等待输入提示词。",
    "ai.status.generating": "生成中",
    "ai.status.generatingMessage": "正在把 Mermaid 代码持续写入编辑器...",
    "ai.status.repairing": "修复中",
    "ai.status.repairingMessage": "第一次结果校验失败，正在请求 AI+ 自动修复，并持续写入编辑器。",
    "ai.status.valid": "已校验",
    "ai.status.validMessage": "生成的 Mermaid 已通过本地校验。",
    "ai.status.invalid": "待修复",
    "ai.status.invalidMessage": "AI+ 返回了 Mermaid，但本地校验仍未通过。",
    "ai.status.applied": "已应用",
    "ai.status.appliedMessage": "AI+ 结果已替换当前编辑器内容。",
    "ai.result": "结果",
    "ai.result.title": "生成的 Mermaid",
    "ai.result.code": "生成代码",
    "ai.result.diffTitle": "与当前图的差异",
    "ai.result.validSummary": "这份 Mermaid 已通过本地校验。",
    "ai.result.repairedSummary": "这份 Mermaid 在一次自动修复后通过了本地校验。",
    "ai.result.invalidSummary": "AI+ 已返回 Mermaid 代码，但本地校验仍失败。",
    "ai.inline.title.new": "生成 Mermaid 草稿",
    "ai.inline.title.modify": "修改当前 Mermaid",
    "ai.inline.mode.new": "新建",
    "ai.inline.mode.modify": "修改",
    "ai.inline.adjust": "调整",
    "ai.inline.editorTitle": "候选 Mermaid",
    "ai.inline.diffTitle": "统一 Diff",
    "ai.inline.diffEmpty": "当前还没有改动。",
    "ai.inline.reject": "放弃",
    "ai.inline.accept": "接受",
    "ai.inline.discardConfirm": "要放弃当前 AI 草稿并恢复到修改前的编辑器内容吗？",
    "ai.result.model": "模型",
    "ai.diff.before": "当前",
    "ai.diff.after": "建议",
    "ai.diff.none": "没有文本差异。",
    "ai.diff.summary": "新增 {added} 行，删除 {removed} 行",
    "ai.error.emptyPrompt": "请先输入提示词，再生成 Mermaid。",
    "ai.error.settingsIncomplete": "请先启用 AI+ 并完成 API 配置，再开始生成。",
    "ai.error.testIncomplete": "测试前需要填写 Base URL、模型和 token。",
    "ai.error.mergeUnavailable": "当前没有可合并更新的图。",
    "ai.error.copyUnavailable": "当前没有可复制的 AI+ 结果。",
    "ai.error.applyUnavailable": "当前 AI+ 结果不能直接应用。",
    "ai.copy": "复制",
    "ai.apply": "应用",
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
    "error.pptUnsupported": "PPT 导出目前仅支持 Flowchart、Sequence、Pie、Journey、Class、ER 和 State 图。",
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

function initializeEditorAdapter() {
  codeEditor = createCodeEditorAdapter(codeEditorHost, {
    initialValue: codeInput.value,
    fontSize: editorFontSize,
    onChange: (nextValue) => handleEditorValueChange(nextValue),
    onSelectionChange: (selection) => syncCachedEditorSelection(selection),
    onBlur: () => {
      void autoSaveCurrentDocumentIfPossible();
    },
    onKeydown: (event) => handleEditorKeydown(event)
  });
}

function handleEditorValueChange(nextValue) {
  codeInput.value = nextValue;
  clearPreviewSourceSelection({ render: false });
  updateCursorStatus();

  if (aiInlineState.isOpen) {
    handleAiInlineEditorInput();
    return;
  }

  markDocumentDirty();
  renderHighlightedCode();
  renderAiActionButton();
  scheduleAutoSave();
  scheduleRender();
}

function syncCachedEditorSelection(selection) {
  try {
    codeInput.setSelectionRange(selection.start ?? 0, selection.end ?? selection.start ?? 0);
  } catch {
    codeInput.selectionStart = selection.start ?? 0;
    codeInput.selectionEnd = selection.end ?? selection.start ?? 0;
  }

  updateCursorStatus();
}

codeInput.value = sampleCode;
initializeEditorAdapter();
initializeSettingsState();
applyUiLanguage();
applyEditorFontSize();
applyWorkspaceSidebarState();
applyEditorPaneWidth();
renderDocumentState();
renderHighlightedCode();
renderAiSettingsUi();
renderAiDialogState();
void initializeAiSettingsState();
void ensureAiStreamListener();

projectsButton.addEventListener("click", () => void chooseWorkspaceDirectory());
settingsButton.addEventListener("click", () => void openSettingsModal());
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
settingsTabGeneral.addEventListener("click", () => setSettingsActiveTab("general"));
settingsTabAi.addEventListener("click", () => setSettingsActiveTab("ai"));
settingsTabGeneral.addEventListener("keydown", (event) => handleSettingsTabKeydown(event));
settingsTabAi.addEventListener("keydown", (event) => handleSettingsTabKeydown(event));
themeModeOfficialButton.addEventListener("click", () => setSettingsThemeMode("official"));
themeModeCustomButton.addEventListener("click", () => setSettingsThemeMode("custom"));
settingsAiEnabled.addEventListener("change", () => handleSettingsAiDraftInput());
settingsAiBaseUrl.addEventListener("input", () => handleSettingsAiDraftInput());
settingsAiModel.addEventListener("input", () => handleSettingsAiDraftInput());
settingsAiSystemPrompt.addEventListener("input", () => handleSettingsAiDraftInput());
settingsAiUserPrompt.addEventListener("input", () => handleSettingsAiDraftInput());
settingsAiClearToken.addEventListener("click", () => toggleSettingsAiClearToken());
settingsAiToken.addEventListener("input", () => handleSettingsAiTokenInput());
settingsAiToken.addEventListener("focus", () => handleSettingsAiTokenFocus());
settingsAiToken.addEventListener("blur", () => handleSettingsAiTokenBlur());
settingsAiTestButton.addEventListener("click", () => void testAiConnection());
aiButton.addEventListener("click", () => openAiInlineWorkbench());
aiInlineAdjustButton.addEventListener("click", () => reopenAiInlinePrompt());
aiInlineRejectButton.addEventListener("click", () => void rejectAiInlineWorkbench());
aiInlineAcceptButton.addEventListener("click", () => void acceptAiInlineWorkbench());
aiInlineGenerateButton.addEventListener("click", () => void generateAiInlineProposal());
aiInlinePromptInput.addEventListener("input", () => handleAiInlinePromptInput());
aiBackdrop.addEventListener("click", () => closeAiModal());
aiCloseButton.addEventListener("click", () => closeAiModal());
aiCancelButton.addEventListener("click", () => closeAiModal());
aiModeNewButton.addEventListener("click", () => setAiDialogMode("new"));
aiModeMergeButton.addEventListener("click", () => setAiDialogMode("merge"));
aiGenerateButton.addEventListener("click", () => void generateAiMermaidCode());
aiCopyButton.addEventListener("click", () => void copyAiResultToClipboard());
aiApplyButton.addEventListener("click", () => void applyAiResultToEditor());

copyClipboardButton.addEventListener("click", () => copyRasterToClipboard());
exportButton.addEventListener("click", () => toggleExportMenu());
exportMenu.addEventListener("keydown", (event) => handleMenuKeydown(event, exportMenu, exportMenuItems, () => {
  setExportMenuOpen(false);
  exportButton.focus({ preventScroll: true });
}));
workspaceContextMenu.addEventListener("keydown", (event) => handleMenuKeydown(event, workspaceContextMenu, workspaceContextMenuItems, () => {
  closeWorkspaceContextMenu();
  getSelectedOrFirstTreeRow()?.focus({ preventScroll: true });
}));
exportPptxButton.addEventListener("click", async () => {
  setExportMenuOpen(false);
  await exportPptx();
});
exportSvgButton.addEventListener("click", async () => {
  setExportMenuOpen(false);
  await exportSvg();
});
exportPngButton.addEventListener("click", async () => {
  setExportMenuOpen(false);
  await exportRaster("png");
});
exportJpgButton.addEventListener("click", async () => {
  setExportMenuOpen(false);
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
window.addEventListener("keydown", (event) => handleGlobalKeydown(event));
window.addEventListener("keyup", (event) => handlePreviewFrameKeyup(event));
window.addEventListener("mousemove", (event) => handlePaneResizeMove(event));
window.addEventListener("mouseup", () => stopPaneResize());
window.addEventListener("mousemove", (event) => handleWorkspacePointerMove(event));
window.addEventListener("mouseup", (event) => {
  void handleWorkspacePointerUp(event);
});
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
document.addEventListener("pointerdown", (event) => handleGlobalPointerDown(event), true);

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
    await navigator.clipboard.writeText(getVisibleMermaidSource());
    updateStatusByKey("success", "status.copiedBadge", "status.codeCopied");
  } catch (error) {
    updateStatus("error", t("status.clipboardErrorBadge"), normalizeError(error));
  }
}

function getVisibleMermaidSource() {
  return getActiveEditorSource();
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
    if (isTauriEnvironment()) {
      await copyRasterToClipboardViaDesktop(svgMarkup, width, height);
    } else {
      await copyRasterToClipboardInRenderer(svgMarkup, format, width, height);
    }
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

  if (isStateSource(source)) {
    return layoutStateDiagram(parseStateSource(source), pptTheme);
  }

  if (isErSource(source)) {
    return layoutErDiagram(parseErSource(source), pptTheme.flowchart);
  }

  if (isClassSource(source)) {
    return layoutClassDiagram(parseClassSource(source), pptTheme.flowchart);
  }

  if (isJourneySource(source)) {
    return layoutJourney(parseJourneySource(source), pptTheme);
  }

  if (isPieSource(source)) {
    return layoutPie(parsePieSource(source), pptTheme);
  }

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
  const source = getPreviewRenderSource();
  if (!source.trim()) {
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
      await renderDiagram(source, currentMermaidConfig);
    } catch (error) {
      latestSvg = "";
      setExportButtonsDisabled(true);
      updateStatus("error", t("status.configErrorBadge"), normalizeError(error));
    }
  }, 220);
}

function getPreviewRenderSource() {
  return getActiveEditorSource();
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
  } else {
    statusBadge.textContent = currentStatusDescriptor.badgeText;
    statusText.textContent = currentStatusDescriptor.message;
  }

  playStatusFeedback();
}

function updateCursorStatus() {
  if (!codeEditor) {
    updateCursorStatusForElement(codeInput);
    return;
  }

  const selection = codeEditor.getSelection();
  const cursorIndex = selection.end ?? selection.start ?? 0;
  const beforeCursor = getActiveEditorSource().slice(0, cursorIndex);
  const lines = beforeCursor.split("\n");
  const line = lines.length;
  const column = (lines[lines.length - 1]?.length ?? 0) + 1;
  cursorStatus.textContent = t("cursor.position", { line, column });
}

function updateCursorStatusForElement(inputElement) {
  const cursorIndex = inputElement.selectionStart ?? 0;
  const beforeCursor = inputElement.value.slice(0, cursorIndex);
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
  if (
    (event.key === "=" || event.key === "+" || event.key === "-" || event.key === "0") &&
    previewBody.contains(event.target)
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
  if (!(event.target instanceof Element) || previewPanState || aiInlineState.isOpen) {
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

function buildPreviewSourceMap(source) {
  try {
    if (isStateSource(source)) {
      return {
        type: "state",
        parsed: parseStateSource(source)
      };
    }

    if (isClassSource(source)) {
      return {
        type: "class",
        parsed: parseClassSource(source)
      };
    }

    if (isErSource(source)) {
      return {
        type: "er",
        parsed: parseErSource(source)
      };
    }

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

    if (isPieSource(source)) {
      return {
        type: "pie",
        parsed: parsePieSource(source)
      };
    }

    if (isJourneySource(source)) {
      return {
        type: "journey",
        parsed: parseJourneySource(source)
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

function annotatePiePreviewSourceMap(parsed) {
  const visibleSections = getVisiblePieSections(parsed);
  const slicePaths = Array.from(preview.querySelectorAll("path.pieCircle"));
  const sliceTexts = Array.from(preview.querySelectorAll("text.slice"));
  const legends = Array.from(preview.querySelectorAll("g.legend"));

  for (const [index, section] of visibleSections.entries()) {
    annotatePreviewElement(slicePaths[index], {
      kind: "pie-section",
      key: section.id
    });
    annotatePreviewElement(sliceTexts[index], {
      kind: "pie-section",
      key: section.id
    });
  }

  for (const [index, section] of parsed.sections.entries()) {
    annotatePreviewElement(legends[index], {
      kind: "pie-section",
      key: section.id
    });
  }
}

function annotateJourneyPreviewSourceMap(parsed) {
  const sections = Array.from(preview.querySelectorAll("rect.journey-section"));
  const tasks = Array.from(preview.querySelectorAll("rect.task"));

  for (const [index, section] of parsed.sections.entries()) {
    const element = sections[index];
    annotatePreviewElement(element, {
      kind: "journey-section",
      key: section.id
    });
    annotatePreviewElement(element?.parentElement, {
      kind: "journey-section",
      key: section.id
    });
  }

  for (const [index, task] of parsed.tasks.entries()) {
    const element = tasks[index];
    annotatePreviewElement(element, {
      kind: "journey-task",
      key: task.id
    });
    annotatePreviewElement(element?.parentElement, {
      kind: "journey-task",
      key: task.id
    });
  }
}

function annotateClassPreviewSourceMap(parsed) {
  const nodeElements = Array.from(preview.querySelectorAll("g.node, g.classGroup"));

  for (const element of nodeElements) {
    const nodeId = resolveClassNodeKey(element, parsed);
    if (!nodeId) {
      continue;
    }

    annotatePreviewElement(element, {
      kind: "class-node",
      key: nodeId
    });

    const labelElement = element.querySelector(".label, .nodeLabel, foreignObject, text");
    annotatePreviewElement(labelElement, {
      kind: "class-node",
      key: nodeId
    });
  }

  const relationPaths = Array.from(preview.querySelectorAll("path.relation"));
  const relationLabels = Array.from(preview.querySelectorAll(".edgeLabel"));

  for (const [index, path] of relationPaths.entries()) {
    annotatePreviewIndexedElement(path, "class-edge", index);
  }

  for (const [index, label] of relationLabels.entries()) {
    annotatePreviewIndexedElement(label, "class-edge", index);
  }
}

function annotateErPreviewSourceMap(parsed) {
  const nodeElements = Array.from(preview.querySelectorAll("g.node"));

  for (const element of nodeElements) {
    const nodeId = resolveErNodeKey(element, parsed);
    if (!nodeId) {
      continue;
    }

    annotatePreviewElement(element, {
      kind: "er-node",
      key: nodeId
    });

    const labelElement = element.querySelector(".entityBox, foreignObject, text");
    annotatePreviewElement(labelElement, {
      kind: "er-node",
      key: nodeId
    });
  }

  const relationPaths = Array.from(preview.querySelectorAll("path.relationshipLine"));
  const relationLabels = Array.from(preview.querySelectorAll(".edgeLabel"));

  for (const [index, path] of relationPaths.entries()) {
    annotatePreviewIndexedElement(path, "er-edge", index);
  }

  for (const [index, label] of relationLabels.entries()) {
    annotatePreviewIndexedElement(label, "er-edge", index);
  }
}

function annotateStatePreviewSourceMap(parsed) {
  const groupElements = Array.from(preview.querySelectorAll("g.cluster"));
  const noteElements = Array.from(preview.querySelectorAll("g.node.statediagram-note"));
  const stateElements = Array.from(
    preview.querySelectorAll("g.node.statediagram-state, g.node")
  ).filter((element) => !element.classList.contains("statediagram-note"));
  const stateNodes = parsed.states.filter((node) => node.type !== "group");
  const groups = parsed.states.filter((node) => node.type === "group");

  for (const [index, element] of stateElements.entries()) {
    const node = stateNodes[index];
    if (!node) {
      continue;
    }

    annotatePreviewElement(element, {
      kind: "state-node",
      key: node.id
    });
  }

  for (const [index, element] of noteElements.entries()) {
    const note = parsed.notes[index];
    if (!note) {
      continue;
    }

    annotatePreviewElement(element, {
      kind: "state-note",
      key: note.id
    });
  }

  for (const [index, element] of groupElements.entries()) {
    const group = groups[index];
    if (!group) {
      continue;
    }

    annotatePreviewElement(element, {
      kind: "state-group",
      key: group.id
    });
  }

  const edgePaths = Array.from(preview.querySelectorAll("path.transition"));
  const edgeLabels = Array.from(preview.querySelectorAll(".edgeLabel"));

  for (const [index, element] of edgePaths.entries()) {
    if (!parsed.edges[index]) {
      continue;
    }
    annotatePreviewIndexedElement(element, "state-edge", index);
  }

  for (const [index, element] of edgeLabels.entries()) {
    if (!parsed.edges[index]) {
      continue;
    }
    annotatePreviewIndexedElement(element, "state-edge", index);
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

function buildPieSectionSelection(sectionId) {
  const parsed = previewSourceMap?.type === "pie" ? previewSourceMap.parsed : null;
  if (!parsed || !sectionId) {
    return null;
  }

  const section = parsed.sections.find((item) => item.id === sectionId);
  if (!section) {
    return null;
  }

  return createPreviewSelection([section.lineStart]);
}

function buildJourneySectionSelection(sectionId) {
  const parsed = previewSourceMap?.type === "journey" ? previewSourceMap.parsed : null;
  if (!parsed || !sectionId) {
    return null;
  }

  const section = parsed.sections.find((item) => item.id === sectionId);
  if (!section) {
    return null;
  }

  const lines = new Set(section.sourceLines ?? []);
  for (const task of parsed.tasks) {
    if (task.sectionId !== sectionId) {
      continue;
    }
    addLineRange(lines, task.lineStart, task.lineEnd);
  }

  return createPreviewSelection(lines);
}

function buildJourneyTaskSelection(taskId) {
  const parsed = previewSourceMap?.type === "journey" ? previewSourceMap.parsed : null;
  if (!parsed || !taskId) {
    return null;
  }

  const task = parsed.tasks.find((item) => item.id === taskId);
  if (!task) {
    return null;
  }

  return createPreviewSelection([task.lineStart]);
}

function buildClassNodeSelection(nodeId) {
  const parsed = previewSourceMap?.type === "class" ? previewSourceMap.parsed : null;
  if (!parsed || !nodeId) {
    return null;
  }

  const node = parsed.nodes.find((item) => item.id === nodeId);
  return createPreviewSelection(node?.sourceLines ?? []);
}

function buildClassEdgeSelection(index) {
  const parsed = previewSourceMap?.type === "class" ? previewSourceMap.parsed : null;
  if (!parsed || !Number.isInteger(index)) {
    return null;
  }

  const edge = parsed.edges[index];
  if (!edge) {
    return null;
  }

  return createPreviewSelection([edge.lineStart]);
}

function buildErNodeSelection(nodeId) {
  const parsed = previewSourceMap?.type === "er" ? previewSourceMap.parsed : null;
  if (!parsed || !nodeId) {
    return null;
  }

  const node = parsed.nodes.find((item) => item.id === nodeId);
  return createPreviewSelection(node?.sourceLines ?? []);
}

function buildErEdgeSelection(index) {
  const parsed = previewSourceMap?.type === "er" ? previewSourceMap.parsed : null;
  if (!parsed || !Number.isInteger(index)) {
    return null;
  }

  const edge = parsed.edges[index];
  if (!edge) {
    return null;
  }

  return createPreviewSelection([edge.lineStart]);
}

function buildStateNodeSelection(nodeId) {
  const parsed = previewSourceMap?.type === "state" ? previewSourceMap.parsed : null;
  if (!parsed || !nodeId) {
    return null;
  }

  const node = parsed.states.find((item) => item.id === nodeId);
  return createPreviewSelection(node?.sourceLines ?? []);
}

function buildStateNoteSelection(noteId) {
  const parsed = previewSourceMap?.type === "state" ? previewSourceMap.parsed : null;
  if (!parsed || !noteId) {
    return null;
  }

  const note = parsed.notes.find((item) => item.id === noteId);
  if (!note) {
    return null;
  }

  const lines = new Set();
  addLineRange(lines, note.lineStart, note.lineEnd);
  return createPreviewSelection(lines);
}

function buildStateGroupSelection(groupId) {
  const parsed = previewSourceMap?.type === "state" ? previewSourceMap.parsed : null;
  if (!parsed || !groupId) {
    return null;
  }

  const group = parsed.states.find((item) => item.id === groupId && item.type === "group");
  if (!group) {
    return null;
  }

  const lines = new Set(group.sourceLines ?? []);
  addLineRange(lines, group.lineStart, group.lineEnd);
  return createPreviewSelection(lines);
}

function buildStateEdgeSelection(index) {
  const parsed = previewSourceMap?.type === "state" ? previewSourceMap.parsed : null;
  if (!parsed || !Number.isInteger(index)) {
    return null;
  }

  const edge = parsed.edges[index];
  if (!edge) {
    return null;
  }

  return createPreviewSelection([edge.lineStart]);
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
  codeEditor?.scrollToLine(lineNumber);
}

function renderHighlightedCode() {
  if (!codeEditor) {
    return;
  }

  let diffModel = null;

  if (aiInlineState.isOpen && aiInlineState.mode === "modify") {
    diffModel = buildUnifiedDiffModel(aiInlineState.sourceCode, getActiveEditorSource());
  }

  codeEditor.setDecorations({
    diffModel,
    highlightedLines: [...previewHighlightedLines],
    primaryHighlightedLine: previewPrimaryHighlightedLine
  });
}

function getCommittedEditorSource() {
  return aiInlineState.isOpen ? aiInlineState.sourceCode : getActiveEditorSource();
}

function getActiveEditorSource() {
  return codeEditor?.getValue() ?? codeInput.value ?? "";
}

function getEditorSelectionRange() {
  if (!codeEditor) {
    return {
      start: codeInput.selectionStart ?? 0,
      end: codeInput.selectionEnd ?? codeInput.selectionStart ?? 0
    };
  }

  return codeEditor.getSelection();
}

function setEditorSelectionRange(start, end = start) {
  if (codeEditor) {
    codeEditor.setSelection(start, end);
    return;
  }

  codeInput.setSelectionRange(start, end);
}

function setEditorValue(nextValue, options = {}) {
  const normalizedValue = String(nextValue ?? "");
  codeInput.value = normalizedValue;

  if (codeEditor) {
    codeEditor.setValue(normalizedValue, options);
  } else if (options.selection) {
    codeInput.setSelectionRange(options.selection.start ?? 0, options.selection.end ?? 0);
  }
}

function focusEditor(options = {}) {
  if (codeEditor) {
    codeEditor.focus(options);
    return;
  }

  codeInput.focus(options);
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
  workspaceTree.setAttribute("aria-multiselectable", "false");
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
  settingsTablist.setAttribute("aria-label", t("settings.tabs.aria"));
  settingsTabGeneral.textContent = t("settings.tabs.general");
  settingsTabAi.textContent = t("settings.tabs.ai");
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
  settingsAiTitle.textContent = t("settings.ai.connectionTitle");
  settingsAiPromptsTitle.textContent = t("settings.ai.promptsTitle");
  settingsAiEnabledLabel.textContent = t("settings.ai.enabled");
  settingsAiBaseUrlLabel.textContent = t("settings.ai.baseUrl");
  settingsAiModelLabel.textContent = t("settings.ai.model");
  settingsAiTokenLabel.textContent = t("settings.ai.token");
  settingsAiSystemPromptLabel.textContent = t("settings.ai.systemPrompt");
  settingsAiUserPromptLabel.textContent = t("settings.ai.userPrompt");
  settingsAiPromptNote.textContent = t("settings.ai.promptNote");
  settingsCancelButton.textContent = t("settings.cancel");
  settingsSaveButton.textContent = t("settings.save");
  aiInlineKicker.textContent = t("ai.label");
  aiInlinePromptLabel.textContent = t("ai.prompt.label");
  aiInlinePromptInput.setAttribute("placeholder", t("ai.prompt.placeholder"));
  aiInlineAdjustButton.textContent = t("ai.inline.adjust");
  aiInlineRejectButton.textContent = t("ai.inline.reject");
  aiInlineAcceptButton.textContent = t("ai.inline.accept");
  aiButton.textContent = t(getAiActionMode() === "new" ? "ai.button.new" : "ai.button.modify");
  aiEyebrow.textContent = t("ai.label");
  aiTitle.textContent = t("ai.title");
  aiCloseButton.setAttribute("aria-label", t("ai.closeAria"));
  aiModeNewButton.textContent = t("ai.mode.new");
  aiModeMergeButton.textContent = t("ai.mode.merge");
  aiPromptLabel.textContent = t("ai.prompt.label");
  aiPromptInput.setAttribute("placeholder", t("ai.prompt.placeholder"));
  aiResultKicker.textContent = t("ai.result");
  aiResultTitle.textContent = t("ai.result.title");
  aiCodePanelTitle.textContent = t("ai.result.code");
  aiDiffPanelTitle.textContent = t("ai.result.diffTitle");
  aiDiffBeforeLabel.textContent = t("ai.diff.before");
  aiDiffAfterLabel.textContent = t("ai.diff.after");
  aiCancelButton.textContent = t("settings.cancel");
  aiCopyButton.textContent = t("ai.copy");
  aiApplyButton.textContent = t("ai.apply");

  applyWorkspaceSidebarState();
  renderDocumentState();
  renderWorkspaceState();
  updateCursorStatus();
  renderCurrentStatus();
  renderAiSettingsUi();
  renderAiInlineState();
  renderAiDialogState();
}

function applyEditorFontSize() {
  codeEditorShell?.style.setProperty("--editor-font-size", `${editorFontSize}px`);
  codeEditor?.setFontSize(editorFontSize);
}

function applyWorkspaceSidebarState() {
  workspaceMain.classList.toggle("workspace-sidebar-collapsed", workspaceSidebarCollapsed);
  workspaceRail.dataset.state = workspaceSidebarCollapsed ? "collapsed" : "expanded";
  workspaceRail.setAttribute("aria-expanded", String(!workspaceSidebarCollapsed));
  workspaceRail.setAttribute(
    "aria-label",
    workspaceSidebarCollapsed ? t("workspace.toggle.expand") : t("workspace.toggle.collapse")
  );
  if (!workspaceSidebarCollapsed) {
    retriggerAnimation(document.querySelector(".workspace-sidebar"), "workspace-sidebar-enter");
  }
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

  if (aiInlineState.isGenerating) {
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
  const value = getActiveEditorSource();
  const selection = getEditorSelectionRange();
  const selectionStart = selection.start ?? 0;
  const selectionEnd = selection.end ?? selectionStart;

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
  const value = getActiveEditorSource();
  const selection = getEditorSelectionRange();
  const selectionStart = selection.start ?? 0;
  const selectionEnd = selection.end ?? selectionStart;
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
  setEditorValue(nextValue, {
    selection: {
      start: nextSelectionStart,
      end: nextSelectionEnd
    }
  });
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
  // No-op after migrating the editor surface to CodeMirror.
}

function getDocumentNameBase(name) {
  if (typeof name !== "string") {
    return "";
  }

  return name.toLowerCase().endsWith(".mmd") ? name.slice(0, -4) : name;
}

function getPersistedCodeText() {
  return `${getCommittedEditorSource().replace(/\s*$/, "")}\n`;
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function reportAppError(context, error) {
  console.error(`[app-error] ${context}`, error);
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
  const source = getVisibleMermaidSource();

  if (!isPptExportableSource(source)) {
    throw new Error(t("error.pptUnsupported"));
  }

  return source;
}

function initializeSettingsState() {
  const { text, config } = loadMermaidConfigState();
  lastValidConfigText = text;
  currentMermaidConfig = config;
  currentPptTheme = buildPptThemeFromMermaidConfig(config);
  currentThemeMode = resolveThemeMode(text, config);
  applyPreviewTheme(currentPptTheme);
}

function createDefaultAiSettingsState() {
  return {
    enabled: false,
    baseUrl: "",
    model: "",
    systemPromptTemplate: defaultAiSystemPromptTemplate,
    userPromptTemplate: defaultAiUserPromptTemplate,
    token: "",
    tokenConfigured: false,
    clearToken: false,
    runtimeSupported: isTauriEnvironment(),
    loaded: false,
    loadError: ""
  };
}

function createDefaultAiDialogState() {
  return {
    mode: "new",
    isGenerating: false,
    isValid: false,
    repaired: false,
    hasResult: false,
    resultCode: "",
    model: "",
    error: "",
    diff: buildLineDiffSummary("", ""),
    statusKey: "ai.status.idle",
    statusMessageKey: "ai.status.idleMessage",
    requestToken: 0
  };
}

function createDefaultAiInlineState() {
  return {
    isOpen: false,
    mode: "new",
    sourceCode: "",
    prompt: "",
    proposalCode: "",
    hasProposal: false,
    hasUnacceptedChanges: false,
    panelCollapsed: false,
    isGenerating: false,
    isValid: false,
    repaired: false,
    model: "",
    error: "",
    diff: buildLineDiffSummary("", ""),
    statusKey: "ai.status.idle",
    statusMessageKey: "ai.status.idleMessage",
    requestToken: 0
  };
}

async function ensureAiStreamListener() {
  if (!isTauriEnvironment()) {
    return null;
  }

  if (!aiStreamListenerPromise) {
    aiStreamListenerPromise = listenToTauriEvent(aiStreamEventName, (event) => {
      handleAiStreamChunkEvent(event?.payload);
    }).catch((error) => {
      aiStreamListenerPromise = null;
      reportAppError("ai.inline.stream.listen", error);
      return null;
    });
  }

  return aiStreamListenerPromise;
}

function handleAiStreamChunkEvent(payload) {
  const requestToken = Number(payload?.requestToken);
  const chunk = String(payload?.chunk ?? "");

  if (!chunk) {
    return;
  }

  if (
    !aiInlineState.isOpen ||
    !aiInlineState.isGenerating ||
    !Number.isInteger(requestToken) ||
    requestToken !== aiInlineState.requestToken
  ) {
    return;
  }

  const nextDraft = `${aiInlineState.proposalCode}${chunk}`;
  setActiveEditorDraft(nextDraft, { validate: false, render: false });
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
  if (currentWorkspace.rootPath) {
    topbarWorkspacePath.textContent = basename(currentWorkspace.rootPath);
    topbarWorkspacePath.title = currentWorkspace.rootPath;
  } else {
    topbarWorkspacePath.textContent = t("workspace.noneSelected");
    topbarWorkspacePath.title = "";
  }
  editorDocumentName.value = getDocumentNameBase(currentDocument.name);
  editorDocumentName.disabled =
    aiInlineState.isOpen || !(currentDocument.kind === "mermaid-file" && currentDocument.path);
  updateEditorDocumentNameWidth();
  renderAiActionButton();
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

  syncWorkspaceDropTargetClasses();
}

function renderWorkspaceNode(node, depth) {
  const group = document.createElement("div");
  group.className = "tree-group";
  group.dataset.path = node.path;
  group.dataset.type = node.type;

  const isEditing = inlineRenameState?.path === node.path;
  const row = document.createElement("div");
  row.dataset.path = node.path;
  row.dataset.type = node.type;
  row.dataset.depth = String(depth);
  row.className = `tree-row ${node.type === "directory" ? "tree-row-directory" : "tree-row-file"}`;
  row.style.paddingLeft = `${10 + depth * 18}px`;
  row.setAttribute("role", "treeitem");
  row.setAttribute("aria-level", String(depth + 1));
  row.tabIndex = 0;
  if (!isEditing) {
    row.addEventListener("mousedown", (event) => handleWorkspacePointerDown(event));
  }

  if (node.type === "file" && isWorkspaceFileSelected(node.path)) {
    row.classList.add("tree-row-active");
    row.setAttribute("aria-selected", "true");
  } else if (node.type === "file") {
    row.setAttribute("aria-selected", "false");
  }

  if (workspaceDropTarget?.mode === "inside" && workspaceDropTarget.path === node.path) {
    row.classList.add("tree-row-drop-target");
  }

  if (node.type === "directory") {
    const expanded = currentWorkspace.expandedPaths.has(node.path);
    row.setAttribute("aria-expanded", String(expanded));
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
    children.setAttribute("role", "group");
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
    if (!(await rejectAiInlineWorkbench())) {
      return;
    }

    const api = getDesktopApi(["chooseWorkspaceDirectory"]);
    await autoSaveCurrentDocumentIfPossible();
    const result = await api.chooseWorkspaceDirectory({ sortMode: currentWorkspace.sortMode });

    if (result.canceled) {
      return;
    }

    const applied = await applyWorkspace(result.rootPath, result.tree, null);
    if (!applied) {
      return;
    }

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
    const reloaded = await loadWorkspace(currentWorkspace.rootPath, currentDocument.path);
    if (!reloaded) {
      return;
    }

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
    const reloaded = await loadWorkspace(currentWorkspace.rootPath, currentDocument.path);
    if (!reloaded) {
      return;
    }

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
  return applyWorkspace(rootPath, result.tree, preferredFilePath);
}

async function applyWorkspace(rootPath, tree, preferredFilePath) {
  if (!(await rejectAiInlineWorkbench({ focusButton: false }))) {
    return false;
  }

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
    return openWorkspaceFile(targetFilePath, { skipAutosave: true });
  } else {
    setEditorValue("", { silent: true });
    clearPreviewSourceSelection({ render: false });
    renderHighlightedCode();
    setCurrentDocument(createDraftDocumentState());
    updateCursorStatus();
    scheduleRender();
    return true;
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
  if (
    performance.now() < workspaceSuppressClickUntil ||
    performance.now() < menuDismissGuardUntil
  ) {
    return;
  }

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
  const row = event.target.closest(".tree-row");
  if (!row) {
    return;
  }

  if (event.target.closest(".tree-row-inline-editor")) {
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    focusAdjacentTreeRow(row, 1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    focusAdjacentTreeRow(row, -1);
    return;
  }

  const { path, type } = row.dataset;
  if (event.key === "ArrowRight" && type === "directory") {
    event.preventDefault();
    if (!currentWorkspace.expandedPaths.has(path)) {
      toggleDirectory(path);
    } else {
      focusFirstChildTreeRow(row);
    }
    return;
  }

  if (event.key === "ArrowLeft" && type === "directory") {
    event.preventDefault();
    if (currentWorkspace.expandedPaths.has(path)) {
      toggleDirectory(path);
    } else {
      focusParentTreeRow(row);
    }
    return;
  }

  if (!(event.key === "Enter" || event.key === " ")) {
    return;
  }

  event.preventDefault();

  closeWorkspaceContextMenu();
  setExportMenuOpen(false);

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
  event.stopPropagation();
  setExportMenuOpen(false);
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
  menuDismissGuardUntil = performance.now() + 600;
  workspaceSuppressClickUntil = performance.now() + 600;
  workspaceContextMenu.hidden = false;
  workspaceContextMenu.style.left = `${event.clientX}px`;
  workspaceContextMenu.style.top = `${event.clientY}px`;
  retriggerAnimation(workspaceContextMenu, "menu-animate-in", { removeAfterMs: 0 });
  queueMicrotask(() => {
    getVisibleMenuItems(workspaceContextMenuItems)[0]?.focus({ preventScroll: true });
  });
}

function handleWorkspacePointerDown(event) {
  if (event.button !== 0 || inlineRenameState) {
    return;
  }

  const row = event.currentTarget.closest(".tree-row");
  if (!row) {
    return;
  }

  event.preventDefault();

  workspaceDragState = {
    path: row.dataset.path,
    type: row.dataset.type,
    startX: event.clientX,
    startY: event.clientY,
    active: false
  };
  setWorkspaceDropTarget(null);
}

function handleWorkspacePointerMove(event) {
  if (!workspaceDragState || !currentWorkspace.rootPath) {
    return;
  }

  const deltaX = event.clientX - workspaceDragState.startX;
  const deltaY = event.clientY - workspaceDragState.startY;
  if (!workspaceDragState.active) {
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < 6) {
      return;
    }

    workspaceDragState.active = true;
    workspaceSuppressClickUntil = performance.now() + 300;
    syncWorkspaceDragSourceClasses();
    workspaceMain.classList.add("workspace-drag-active");
  } else {
    event.preventDefault();
  }

  const nextTarget = resolveWorkspaceDropTargetFromPoint(event.clientX, event.clientY);
  if (!nextTarget || !canDropWorkspaceEntry(workspaceDragState.path, nextTarget.path)) {
    setWorkspaceDropTarget(null);
    return;
  }

  setWorkspaceDropTarget(nextTarget);
}

async function handleWorkspacePointerUp(event) {
  if (!workspaceDragState) {
    return;
  }

  const dragState = workspaceDragState;
  const nextTarget = dragState.active
    ? resolveWorkspaceDropTargetFromPoint(event.clientX, event.clientY)
    : null;
  clearWorkspaceDragState();

  if (!dragState.active) {
    return;
  }

  if (!nextTarget || !canDropWorkspaceEntry(dragState.path, nextTarget.path)) {
    return;
  }

  try {
    await moveWorkspaceEntryToTarget(dragState.path, nextTarget.path);
  } catch (error) {
    updateStatus("error", t("status.moveErrorBadge"), normalizeError(error));
  }
}

function clearWorkspaceDragState() {
  workspaceDragState = null;
  setWorkspaceDropTarget(null);
  syncWorkspaceDragSourceClasses();
  workspaceMain.classList.remove("workspace-drag-active");
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
  syncWorkspaceDropTargetClasses();
}

function syncWorkspaceDropTargetClasses() {
  workspaceTree.classList.toggle("workspace-tree-drop-root", workspaceDropTarget?.mode === "root");
  workspaceEmpty.classList.toggle("workspace-tree-drop-root", workspaceDropTarget?.mode === "root");

  for (const row of workspaceTree.querySelectorAll(".tree-row.tree-row-drop-target")) {
    row.classList.remove("tree-row-drop-target");
  }

  for (const group of workspaceTree.querySelectorAll(".tree-group.tree-group-drop-target")) {
    group.classList.remove("tree-group-drop-target");
  }

  if (!workspaceDropTarget) {
    return;
  }

  let targetPath = null;
  let targetMode = null;
  if (workspaceDropTarget.mode === "inside") {
    targetPath = workspaceDropTarget.path;
    targetMode = "inside";
  } else if (workspaceDropTarget.mode === "sibling") {
    targetPath = workspaceDropTarget.path;
    targetMode = "sibling";
  }

  if (!targetPath) {
    return;
  }

  if (targetPath === currentWorkspace.rootPath) {
    workspaceTree.classList.add("workspace-tree-drop-root");
    workspaceEmpty.classList.add("workspace-tree-drop-root");
    return;
  }

  if (targetMode === "inside") {
    const rowSelector = `.tree-row[data-path="${CSS.escape(targetPath)}"]`;
    workspaceTree.querySelector(rowSelector)?.classList.add("tree-row-drop-target");
  }

  const groupSelector = `.tree-group[data-path="${CSS.escape(targetPath)}"][data-type="directory"]`;
  workspaceTree.querySelector(groupSelector)?.classList.add("tree-group-drop-target");
}

function syncWorkspaceDragSourceClasses() {
  for (const row of workspaceTree.querySelectorAll(".tree-row.tree-row-dragging-source")) {
    row.classList.remove("tree-row-dragging-source");
  }

  if (!workspaceDragState?.active || !workspaceDragState.path) {
    return;
  }

  const selector = `.tree-row[data-path="${CSS.escape(workspaceDragState.path)}"]`;
  workspaceTree.querySelector(selector)?.classList.add("tree-row-dragging-source");
}

function resolveWorkspaceDropTargetFromPoint(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  const row = element?.closest(".tree-row");
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

  if (pointInsideElement(workspaceTree, clientX, clientY) || pointInsideElement(workspaceEmpty, clientX, clientY)) {
    return {
      mode: "root",
      path: currentWorkspace.rootPath
    };
  }

  return null;
}

function pointInsideElement(element, clientX, clientY) {
  if (!element || element.hidden) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
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

function handleGlobalPointerDown(event) {
  if (event.button !== 0) {
    return;
  }

  if (performance.now() < menuDismissGuardUntil) {
    return;
  }

  if (!workspaceContextMenu.hidden && !workspaceContextMenu.contains(event.target)) {
    closeWorkspaceContextMenu();
  }

  if (!exportMenu.hidden && !exportMenu.contains(event.target) && event.target !== exportButton) {
    setExportMenuOpen(false);
  }
}

function retriggerAnimation(element, className, options = {}) {
  if (!element) {
    return;
  }

  const removeAfterMs = options.removeAfterMs ?? 280;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  if (removeAfterMs > 0) {
    window.setTimeout(() => {
      element.classList.remove(className);
    }, removeAfterMs);
  }
}

function playStatusFeedback() {
  retriggerAnimation(statusBadge, "status-bump");
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

  const target = { ...contextMenuTarget };
  closeWorkspaceContextMenu();
  const targetParentPath = target.parentPath;

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

  const target = { ...contextMenuTarget };
  closeWorkspaceContextMenu();
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

  const target = { ...contextMenuTarget };
  closeWorkspaceContextMenu();
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
  if (aiInlineState.isOpen) {
    return;
  }

  window.clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(() => {
    void autoSaveCurrentDocumentIfPossible();
  }, 260);
}

async function autoSaveCurrentDocumentIfPossible() {
  window.clearTimeout(autoSaveTimer);

  if (aiInlineState.isOpen) {
    return;
  }

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
    if (!(await rejectAiInlineWorkbench({ focusButton: false }))) {
      return false;
    }

    if (!options.skipAutosave) {
      await autoSaveCurrentDocumentIfPossible();
    }

    const api = getDesktopApi(["readTextFile"]);
    const result = await api.readTextFile({ filePath });
    setEditorValue(result.text, { silent: true });
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
    return true;
  } catch (error) {
    updateStatus("error", t("status.fileErrorBadge"), normalizeError(error));
    return false;
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

async function initializeAiSettingsState() {
  if (!isTauriEnvironment()) {
    aiSettingsState = {
      ...createDefaultAiSettingsState(),
      runtimeSupported: false,
      loaded: true
    };
    settingsDraftAi = { ...aiSettingsState };
    renderAiSettingsUi();
    return;
  }

  try {
    const api = getDesktopApi(["loadAiSettings"]);
    aiSettingsState = normalizeAiSettingsSnapshot(await api.loadAiSettings());
    settingsDraftAi = {
      ...aiSettingsState,
      token: "",
      clearToken: false
    };
  } catch (error) {
    console.warn("Failed to load AI settings:", error);
    aiSettingsState = {
      ...createDefaultAiSettingsState(),
      runtimeSupported: true,
      loaded: true,
      loadError: normalizeError(error)
    };
    settingsDraftAi = { ...aiSettingsState };
  }

  renderAiSettingsUi();
}

function normalizeAiSettingsSnapshot(snapshot) {
  return {
    ...createDefaultAiSettingsState(),
    enabled: Boolean(snapshot?.enabled),
    baseUrl: normalizeAiBaseUrl(snapshot?.baseUrl),
    model: String(snapshot?.model ?? "").trim(),
    systemPromptTemplate:
      String(snapshot?.systemPromptTemplate ?? "").trim() || defaultAiSystemPromptTemplate,
    userPromptTemplate:
      String(snapshot?.userPromptTemplate ?? "").trim() || defaultAiUserPromptTemplate,
    tokenConfigured: Boolean(snapshot?.tokenConfigured),
    runtimeSupported: snapshot?.runtimeSupported !== false,
    loaded: true,
    loadError: ""
  };
}

function renderAiSettingsUi() {
  const runtimeSupported = isAiSettingsRuntimeSupported();
  renderSettingsTabs();
  aiButton.hidden = !shouldShowAiButton();
  renderAiActionButton();

  if (!runtimeSupported) {
    return;
  }

  settingsAiEnabled.checked = settingsDraftAi.enabled;
  settingsAiBaseUrl.value = settingsDraftAi.baseUrl;
  settingsAiModel.value = settingsDraftAi.model;
  renderSettingsAiTokenInput();
  settingsAiSystemPrompt.value = settingsDraftAi.systemPromptTemplate;
  settingsAiUserPrompt.value = settingsDraftAi.userPromptTemplate;
  settingsAiTokenStatus.textContent = getSettingsAiTokenStatusText();
  settingsAiClearToken.textContent = settingsDraftAi.clearToken
    ? t("settings.ai.clearTokenUndo")
    : t("settings.ai.clearToken");
  settingsAiTestButton.textContent = t(
    settingsAiTestState.running ? "settings.ai.testRunning" : "settings.ai.test"
  );
  settingsAiTestButton.disabled = settingsAiTestState.running;
  settingsAiClearToken.disabled =
    !settingsDraftAi.tokenConfigured &&
    !settingsDraftAi.token.trim() &&
    !settingsDraftAi.clearToken;
  settingsAiTestStatus.hidden = !settingsAiTestState.message;
  settingsAiTestStatus.dataset.tone = settingsAiTestState.tone;
  settingsAiTestStatus.textContent = settingsAiTestState.message;
}

function getSettingsAiTokenStatusText() {
  if (settingsDraftAi.clearToken) {
    return t("settings.ai.tokenWillClear");
  }

  if (settingsDraftAi.token.trim()) {
    return t("settings.ai.tokenWillReplace");
  }

  if (settingsDraftAi.tokenConfigured) {
    return t("settings.ai.tokenSaved");
  }

  return t("settings.ai.tokenMissing");
}

function shouldDisplayMaskedSavedToken() {
  return Boolean(
    settingsDraftAi.tokenConfigured &&
      !settingsDraftAi.clearToken &&
      !settingsDraftAi.token.trim()
  );
}

function renderSettingsAiTokenInput() {
  if (settingsDraftAi.clearToken) {
    settingsAiToken.dataset.masked = "false";
    settingsAiToken.value = "";
    return;
  }

  if (settingsDraftAi.token.trim()) {
    settingsAiToken.dataset.masked = "false";
    settingsAiToken.value = settingsDraftAi.token;
    return;
  }

  if (shouldDisplayMaskedSavedToken()) {
    settingsAiToken.dataset.masked = "true";
    settingsAiToken.value = maskedSavedTokenValue;
    return;
  }

  settingsAiToken.dataset.masked = "false";
  settingsAiToken.value = "";
}

function isSettingsAiTokenMasked() {
  return settingsAiToken.dataset.masked === "true";
}

function shouldShowAiButton() {
  return Boolean(
    isTauriEnvironment() &&
      aiSettingsState.runtimeSupported &&
      aiSettingsState.enabled &&
      aiSettingsState.baseUrl &&
      aiSettingsState.model &&
      aiSettingsState.tokenConfigured
  );
}

function getAiActionMode() {
  return resolveAiActionMode(getActiveEditorSource());
}

function renderAiActionButton() {
  aiButton.textContent = t(getAiActionMode() === "new" ? "ai.button.new" : "ai.button.modify");
}

function isAiSettingsRuntimeSupported() {
  return Boolean(aiSettingsState.runtimeSupported && isTauriEnvironment());
}

function getAvailableSettingsTabs() {
  return isAiSettingsRuntimeSupported() ? ["general", "ai"] : ["general"];
}

function normalizeSettingsTab(tab) {
  return tab === "ai" && isAiSettingsRuntimeSupported() ? "ai" : "general";
}

function getSettingsTabButton(tab) {
  return tab === "ai" ? settingsTabAi : settingsTabGeneral;
}

function renderSettingsTabs() {
  settingsActiveTab = normalizeSettingsTab(settingsActiveTab);
  const aiTabVisible = isAiSettingsRuntimeSupported();
  const generalActive = settingsActiveTab === "general";
  const aiActive = aiTabVisible && settingsActiveTab === "ai";

  settingsTabGeneral.classList.toggle("settings-nav-button-active", generalActive);
  settingsTabGeneral.setAttribute("aria-selected", String(generalActive));
  settingsTabGeneral.tabIndex = generalActive ? 0 : -1;
  settingsPanelGeneral.hidden = !generalActive;

  settingsTabAi.hidden = !aiTabVisible;
  settingsTabAi.classList.toggle("settings-nav-button-active", aiActive);
  settingsTabAi.setAttribute("aria-selected", String(aiActive));
  settingsTabAi.tabIndex = aiActive ? 0 : -1;
  settingsPanelAi.hidden = !aiActive;
}

function setSettingsActiveTab(tab, options = {}) {
  const nextTab = normalizeSettingsTab(tab);
  const changed = settingsActiveTab !== nextTab;
  settingsActiveTab = nextTab;
  renderSettingsTabs();

  if (options.resetScroll === true || (changed && options.resetScroll !== false)) {
    settingsContent.scrollTop = 0;
  }

  if (options.focusButton) {
    getSettingsTabButton(nextTab)?.focus({ preventScroll: true });
  }
}

function handleSettingsTabKeydown(event) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
    return;
  }

  const tabs = getAvailableSettingsTabs();
  const currentIndex = tabs.indexOf(settingsActiveTab);
  let nextIndex = currentIndex;

  if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = tabs.length - 1;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  } else {
    nextIndex = (currentIndex + 1) % tabs.length;
  }

  event.preventDefault();
  setSettingsActiveTab(tabs[nextIndex], { focusButton: true });
}

function readSettingsAiDraftFromDom() {
  const tokenValue = isSettingsAiTokenMasked() ? "" : String(settingsAiToken.value ?? "");

  return {
    ...settingsDraftAi,
    enabled: Boolean(settingsAiEnabled.checked),
    baseUrl: normalizeAiBaseUrl(settingsAiBaseUrl.value),
    model: String(settingsAiModel.value ?? "").trim(),
    systemPromptTemplate:
      String(settingsAiSystemPrompt.value ?? "").trim() || defaultAiSystemPromptTemplate,
    userPromptTemplate:
      String(settingsAiUserPrompt.value ?? "").trim() || defaultAiUserPromptTemplate,
    token: tokenValue,
    runtimeSupported: aiSettingsState.runtimeSupported
  };
}

function toggleSettingsAiClearToken() {
  settingsDraftAi = {
    ...readSettingsAiDraftFromDom(),
    clearToken: !settingsDraftAi.clearToken
  };
  resetSettingsAiTestState();

  if (settingsDraftAi.clearToken) {
    settingsDraftAi.token = "";
    settingsAiToken.value = "";
  }

  renderAiSettingsUi();
}

function handleSettingsAiDraftInput() {
  settingsDraftAi = {
    ...readSettingsAiDraftFromDom(),
    clearToken: settingsDraftAi.clearToken && settingsDraftAi.tokenConfigured
  };
  resetSettingsAiTestState();
  renderAiSettingsUi();
}

function handleSettingsAiTokenInput() {
  settingsDraftAi = {
    ...readSettingsAiDraftFromDom(),
    clearToken: false
  };
  settingsAiToken.dataset.masked = "false";
  resetSettingsAiTestState();
  renderAiSettingsUi();
}

function handleSettingsAiTokenFocus() {
  if (!isSettingsAiTokenMasked()) {
    return;
  }

  settingsAiToken.value = "";
  settingsAiToken.dataset.masked = "false";
}

function handleSettingsAiTokenBlur() {
  if (settingsAiToken.value.trim() || settingsDraftAi.clearToken) {
    return;
  }

  if (shouldDisplayMaskedSavedToken()) {
    settingsAiToken.dataset.masked = "true";
    settingsAiToken.value = maskedSavedTokenValue;
  }
}

function resetSettingsAiTestState() {
  settingsAiTestState = {
    running: false,
    tone: "idle",
    message: ""
  };
}

function buildAiSettingsValidationMessage(missingFields) {
  const labels = missingFields.map((field) => {
    if (field === "baseUrl") {
      return t("settings.ai.baseUrl");
    }

    if (field === "model") {
      return t("settings.ai.model");
    }

    return t("settings.ai.token");
  });

  return `${t("ai.error.settingsIncomplete")} (${labels.join(", ")})`;
}

function hasAiMergeSource() {
  return hasMeaningfulDiagram(getActiveEditorSource(), sampleCode);
}

function syncTextareaValue(element, value) {
  if (element.value !== value) {
    element.value = value;
  }
}

function isAiInlineDraftDirty() {
  return Boolean(
    aiInlineState.isOpen &&
      (
        aiInlineState.isGenerating ||
        aiInlineState.hasUnacceptedChanges ||
        (aiInlineState.mode === "new" && aiInlineState.hasProposal) ||
        aiInlineState.prompt.trim()
      )
  );
}

async function rejectAiInlineWorkbench(options = {}) {
  if (!aiInlineState.isOpen) {
    return true;
  }

  if (options.confirm !== false && isAiInlineDraftDirty()) {
    const shouldDiscard = window.confirm(t("ai.inline.discardConfirm"));
    if (!shouldDiscard) {
      return false;
    }
  }

  window.clearTimeout(aiInlineValidationTimer);
  const restoredSource = aiInlineState.sourceCode;
  aiInlineState = createDefaultAiInlineState();
  setEditorValue(restoredSource, { silent: true });
  clearPreviewSourceSelection({ render: false });
  updateCursorStatus();
  renderAiInlineState();
  renderHighlightedCode();
  renderAiActionButton();
  scheduleRender();

  if (options.focusButton !== false && !aiButton.hidden) {
    queueMicrotask(() => {
      aiButton.focus({ preventScroll: true });
    });
  }

  return true;
}

function syncAiInlineDraftState(nextDraft) {
  const proposalCode = String(nextDraft ?? "");
  aiInlineState = {
    ...aiInlineState,
    proposalCode,
    hasProposal: Boolean(proposalCode.trim()),
    hasUnacceptedChanges: proposalCode !== aiInlineState.sourceCode,
    error: ""
  };
}

function setActiveEditorDraft(nextDraft, options = {}) {
  const draft = String(nextDraft ?? "");
  setEditorValue(draft, { silent: true });

  if (aiInlineState.isOpen) {
    syncAiInlineDraftState(draft);
  }

  clearPreviewSourceSelection({ render: false });
  updateCursorStatus();
  renderHighlightedCode();
  renderAiActionButton();

  if (aiInlineState.isOpen) {
    renderAiInlineState();
    if (options.validate !== false) {
      scheduleAiInlineValidation();
    }
  } else {
    markDocumentDirty();
    scheduleAutoSave();
  }

  if (options.render !== false) {
    scheduleRender();
  }
}

function openAiInlineWorkbench() {
  if (!shouldShowAiButton()) {
    updateStatus("error", t("status.settingsErrorBadge"), t("ai.error.settingsIncomplete"));
    return;
  }

  closeWorkspaceContextMenu();
  setExportMenuOpen(false);
  if (!settingsModal.hidden) {
    closeSettingsModal();
  }

  const mode = getAiActionMode();
  const sourceCode = getActiveEditorSource();
  aiInlineState = {
    ...createDefaultAiInlineState(),
    isOpen: true,
    mode,
    sourceCode,
    proposalCode: sourceCode,
    hasProposal: Boolean(sourceCode.trim()),
    prompt: "",
    hasUnacceptedChanges: false,
    panelCollapsed: false,
    statusKey: "ai.status.idle",
    statusMessageKey: "ai.status.idleMessage"
  };
  renderAiInlineState();
  renderHighlightedCode();
  scheduleRender();
  queueMicrotask(() => {
    aiInlinePromptInput.focus({ preventScroll: true });
  });
}

async function acceptAiInlineWorkbench() {
  const acceptedCode = getActiveEditorSource();
  const canAccept =
    aiInlineState.isOpen &&
    aiInlineState.hasProposal &&
    (aiInlineState.mode === "new" || aiInlineState.hasUnacceptedChanges);

  if (!canAccept) {
    updateStatus("error", t("status.errorBadge"), t("ai.error.applyUnavailable"));
    return;
  }

  aiInlineState = createDefaultAiInlineState();
  renderAiInlineState();
  replaceEditorCode(acceptedCode);
  updateStatusByKey("success", "status.savedBadge", "ai.status.appliedMessage");
}

function handleAiInlinePromptInput() {
  aiInlineState = {
    ...aiInlineState,
    prompt: aiInlinePromptInput.value
  };
}

function handleAiInlineEditorInput() {
  if (!aiInlineState.isOpen) {
    return;
  }

  syncAiInlineDraftState(getActiveEditorSource());
  renderAiInlineState();
  renderHighlightedCode();
  renderAiActionButton();
  scheduleAiInlineValidation();
  scheduleRender();
}

function scheduleAiInlineValidation() {
  const validationToken = ++aiInlineValidationSequence;
  window.clearTimeout(aiInlineValidationTimer);
  aiInlineValidationTimer = window.setTimeout(async () => {
    if (!aiInlineState.isOpen) {
      return;
    }

    const proposalCode = getActiveEditorSource();
    if (!proposalCode.trim()) {
      aiInlineState = {
        ...aiInlineState,
        isValid: false,
        hasProposal: false,
        error: "",
        statusKey: "ai.status.idle",
        statusMessageKey: "ai.status.idleMessage"
      };
      renderAiInlineState();
      return;
    }

    const validation = await validateMermaidSource(proposalCode, currentMermaidConfig);
    if (validationToken !== aiInlineValidationSequence || !aiInlineState.isOpen) {
      return;
    }

    aiInlineState = {
      ...aiInlineState,
      proposalCode,
      isValid: validation.valid,
      error: validation.valid ? "" : validation.message,
      statusKey: validation.valid ? "ai.status.valid" : "ai.status.invalid",
      statusMessageKey: validation.valid ? "ai.status.validMessage" : "ai.status.invalidMessage"
    };
    renderAiInlineState();
  }, 180);
}

function renderAiInlineState() {
  const collapsed = Boolean(aiInlineState.isOpen && aiInlineState.panelCollapsed);
  const canAccept = Boolean(
    aiInlineState.hasProposal &&
      (aiInlineState.mode === "new" || aiInlineState.hasUnacceptedChanges)
  );

  aiInlinePanel.hidden = !aiInlineState.isOpen;
  aiInlinePanel.classList.toggle("ai-inline-panel-collapsed", collapsed);
  aiButton.disabled = aiInlineState.isOpen;
  codeEditor?.setEditable(!aiInlineState.isGenerating);
  editorDocumentName.disabled =
    aiInlineState.isOpen || !(currentDocument.kind === "mermaid-file" && currentDocument.path);
  codeEditorShell.classList.toggle("code-editor-shell-ai-session", aiInlineState.isOpen);
  codeEditorShell.classList.toggle("code-editor-shell-ai-session-collapsed", collapsed);

  if (!aiInlineState.isOpen) {
    codeEditor?.setEditable(true);
    codeEditorShell.classList.remove("code-editor-shell-ai-session", "code-editor-shell-ai-session-collapsed");
    return;
  }

  syncTextareaValue(aiInlinePromptInput, aiInlineState.prompt);
  aiInlineTitle.textContent = t(
    aiInlineState.mode === "new" ? "ai.inline.title.new" : "ai.inline.title.modify"
  );
  aiInlineModePill.textContent = t(
    aiInlineState.mode === "new" ? "ai.inline.mode.new" : "ai.inline.mode.modify"
  );
  aiInlineGenerateButton.textContent = t(aiInlineState.model ? "ai.regenerate" : "ai.generate");
  aiInlineGenerateButton.disabled = aiInlineState.isGenerating;
  aiInlineStatusChip.className = `status status-${
    aiInlineState.error ? "error" : aiInlineState.isGenerating ? "rendering" : aiInlineState.isValid ? "success" : "idle"
  }`;
  aiInlineStatusChip.textContent = t(aiInlineState.statusKey);
  aiInlineStatusText.textContent = aiInlineState.error || t(aiInlineState.statusMessageKey);
  aiInlineError.hidden = collapsed || !aiInlineState.error;
  aiInlineError.textContent = aiInlineState.error;
  aiInlineFooter.hidden = collapsed ? aiInlineState.isGenerating : false;
  aiInlineAdjustButton.hidden = !collapsed || aiInlineState.isGenerating;
  aiInlineRejectButton.hidden = collapsed ? aiInlineState.isGenerating : false;
  aiInlineAcceptButton.hidden = !collapsed || aiInlineState.isGenerating || !canAccept;
  aiInlineAcceptButton.disabled = !canAccept;
}

function reopenAiInlinePrompt() {
  if (!aiInlineState.isOpen || aiInlineState.isGenerating) {
    return;
  }

  aiInlineState = {
    ...aiInlineState,
    panelCollapsed: false
  };
  renderAiInlineState();
  queueMicrotask(() => {
    aiInlinePromptInput.focus({ preventScroll: true });
  });
}

async function requestAiInlineDraft(api, payload, requestToken) {
  aiInlineState = {
    ...aiInlineState,
    proposalCode: "",
    hasProposal: false,
    hasUnacceptedChanges: false
  };
  renderAiInlineState();
  return api.generateAiMermaidStream({
    ...payload,
    requestToken
  });
}

async function generateAiInlineProposal() {
  if (!shouldShowAiButton()) {
    updateStatus("error", t("status.settingsErrorBadge"), t("ai.error.settingsIncomplete"));
    return;
  }

  const prompt = aiInlinePromptInput.value.trim();
  if (!prompt) {
    aiInlineState = {
      ...aiInlineState,
      error: t("ai.error.emptyPrompt"),
      statusKey: "ai.status.invalid",
      statusMessageKey: "ai.status.invalidMessage"
    };
    renderAiInlineState();
    return;
  }

  const requestToken = ++aiRequestSequence;
  aiInlineState = {
    ...aiInlineState,
    prompt,
    panelCollapsed: true,
    isGenerating: true,
    error: "",
    requestToken,
    statusKey: "ai.status.generating",
    statusMessageKey: "ai.status.generatingMessage"
  };
  renderAiInlineState();

  try {
    await ensureAiStreamListener();
    const api = getDesktopApi(["generateAiMermaidStream"]);
    const currentCode = aiInlineState.mode === "modify" ? getActiveEditorSource() : "";
    const firstPayload = buildAiRequestPayload({
      prompt,
      mode: aiInlineState.mode === "modify" ? "merge" : "new",
      currentCode,
      requestToken
    });
    let result = await requestAiInlineDraft(api, firstPayload, requestToken);
    let nextCode = sanitizeAiMermaidText(result.mermaidText);
    let validation = await validateMermaidSource(nextCode, currentMermaidConfig);
    let repaired = false;

    if (!validation.valid) {
      aiInlineState = {
        ...aiInlineState,
        isGenerating: true,
        statusKey: "ai.status.repairing",
        statusMessageKey: "ai.status.repairingMessage",
        requestToken
      };
      renderAiInlineState();

      const repairPayload = buildAiRequestPayload({
        prompt,
        mode: aiInlineState.mode === "modify" ? "merge" : "new",
        currentCode,
        previousCode: nextCode,
        validationError: validation.message,
        requestToken
      });
      result = await requestAiInlineDraft(api, repairPayload, requestToken);
      nextCode = sanitizeAiMermaidText(result.mermaidText);
      validation = await validateMermaidSource(nextCode, currentMermaidConfig);
      repaired = true;
    }

    if (requestToken !== aiInlineState.requestToken) {
      return;
    }

    aiInlineState = {
      ...aiInlineState,
      prompt,
      isGenerating: false,
      panelCollapsed: true,
      repaired,
      proposalCode: nextCode,
      hasProposal: Boolean(nextCode.trim()),
      isValid: validation.valid,
      model: result.model,
      error: validation.valid ? "" : validation.message,
      diff: buildLineDiffSummary(aiInlineState.sourceCode, nextCode),
      hasUnacceptedChanges: nextCode !== aiInlineState.sourceCode,
      statusKey: validation.valid ? "ai.status.valid" : "ai.status.invalid",
      statusMessageKey: validation.valid ? "ai.status.validMessage" : "ai.status.invalidMessage"
    };
    setActiveEditorDraft(nextCode, { validate: false });
    renderAiInlineState();
    updateCursorStatus();
    renderHighlightedCode();
    scheduleRender();
    queueMicrotask(() => {
      focusEditor({ preventScroll: true });
    });
  } catch (error) {
    reportAppError("ai.inline.generate", error);
    if (requestToken !== aiInlineState.requestToken) {
      return;
    }

    aiInlineState = {
      ...aiInlineState,
      isGenerating: false,
      panelCollapsed: true,
      error: normalizeError(error),
      statusKey: "ai.status.invalid",
      statusMessageKey: "ai.status.invalidMessage"
    };
    renderAiInlineState();
    updateStatus("error", t("status.errorBadge"), normalizeError(error));
  }
}

function openAiModal() {
  if (!shouldShowAiButton()) {
    updateStatus("error", t("status.settingsErrorBadge"), t("ai.error.settingsIncomplete"));
    return;
  }

  window.clearTimeout(aiModalCloseTimer);
  closeWorkspaceContextMenu();
  setExportMenuOpen(false);
  if (!settingsModal.hidden) {
    closeSettingsModal();
  }

  aiDialogState = {
    ...createDefaultAiDialogState(),
    mode: hasAiMergeSource() ? "merge" : "new"
  };
  aiPromptInput.value = "";
  aiModal.hidden = false;
  aiModal.classList.remove("modal-animate-in");
  requestAnimationFrame(() => {
    aiModal.classList.add("modal-animate-in");
  });
  renderAiDialogState();
  queueMicrotask(() => {
    aiPromptInput.focus({ preventScroll: true });
  });
}

function closeAiModal() {
  aiDialogState = {
    ...aiDialogState,
    requestToken: ++aiRequestSequence
  };
  aiModal.classList.remove("modal-animate-in");
  window.clearTimeout(aiModalCloseTimer);
  aiModalCloseTimer = window.setTimeout(() => {
    aiModal.hidden = true;
    if (!aiButton.hidden) {
      aiButton.focus({ preventScroll: true });
    }
  }, 160);
}

function setAiDialogMode(mode) {
  const nextMode = mode === "merge" && hasAiMergeSource() ? "merge" : "new";
  aiDialogState = {
    ...createDefaultAiDialogState(),
    mode: nextMode
  };
  renderAiDialogState();
}

function renderAiDialogState() {
  const mergeAvailable = hasAiMergeSource();
  aiModeMergeButton.disabled = !mergeAvailable;
  aiModeNewButton.classList.toggle("settings-mode-button-active", aiDialogState.mode === "new");
  aiModeMergeButton.classList.toggle(
    "settings-mode-button-active",
    aiDialogState.mode === "merge"
  );
  aiContextNote.textContent = t(
    aiDialogState.mode === "merge" ? "ai.context.merge" : "ai.context.new"
  );
  aiGenerateButton.disabled = aiDialogState.isGenerating;
  aiGenerateButton.textContent = t(aiDialogState.hasResult ? "ai.regenerate" : "ai.generate");
  aiStatusChip.className = `status status-${
    aiDialogState.error ? "error" : aiDialogState.isGenerating ? "rendering" : aiDialogState.isValid ? "success" : "idle"
  }`;
  aiStatusChip.textContent = t(aiDialogState.statusKey);
  aiStatusText.textContent = t(aiDialogState.statusMessageKey);
  aiResultSection.hidden = !aiDialogState.hasResult;
  aiResultCode.textContent = aiDialogState.resultCode;
  aiModelPill.textContent = aiDialogState.model || t("ai.result.model");
  aiResultSummary.textContent = t(
    aiDialogState.isValid
      ? aiDialogState.repaired
        ? "ai.result.repairedSummary"
        : "ai.result.validSummary"
      : "ai.result.invalidSummary"
  );
  aiDiffPanel.hidden = !(aiDialogState.mode === "merge" && aiDialogState.hasResult);
  aiDiffBefore.textContent = aiDialogState.diff.removedBlock || t("ai.diff.none");
  aiDiffAfter.textContent = aiDialogState.diff.addedBlock || t("ai.diff.none");
  aiDiffSummary.textContent = aiDialogState.diff.hasChanges
    ? t("ai.diff.summary", {
        added: aiDialogState.diff.addedCount,
        removed: aiDialogState.diff.removedCount
      })
    : t("ai.diff.none");
  aiErrorMessage.hidden = !aiDialogState.error;
  aiErrorMessage.textContent = aiDialogState.error;
  aiCopyButton.disabled = !aiDialogState.hasResult;
  aiApplyButton.disabled = !(aiDialogState.hasResult && aiDialogState.isValid);
}

async function generateAiMermaidCode() {
  if (!shouldShowAiButton()) {
    aiDialogState = {
      ...aiDialogState,
      error: t("ai.error.settingsIncomplete"),
      statusKey: "ai.status.invalid",
      statusMessageKey: "ai.status.invalidMessage"
    };
    renderAiDialogState();
    return;
  }

  const prompt = aiPromptInput.value.trim();
  if (!prompt) {
    aiDialogState = {
      ...aiDialogState,
      error: t("ai.error.emptyPrompt"),
      statusKey: "ai.status.invalid",
      statusMessageKey: "ai.status.invalidMessage"
    };
    renderAiDialogState();
    return;
  }

  if (aiDialogState.mode === "merge" && !hasAiMergeSource()) {
    aiDialogState = {
      ...aiDialogState,
      error: t("ai.error.mergeUnavailable"),
      statusKey: "ai.status.invalid",
      statusMessageKey: "ai.status.invalidMessage"
    };
    renderAiDialogState();
    return;
  }

  const requestToken = ++aiRequestSequence;
  aiDialogState = {
    ...createDefaultAiDialogState(),
    mode: aiDialogState.mode,
    isGenerating: true,
    statusKey: "ai.status.generating",
    statusMessageKey: "ai.status.generatingMessage",
    requestToken
  };
  renderAiDialogState();

  try {
    const api = getDesktopApi(["generateAiMermaid"]);
    const currentCode = aiDialogState.mode === "merge" ? getActiveEditorSource() : "";
    const firstPayload = buildAiRequestPayload({
      prompt,
      mode: aiDialogState.mode,
      currentCode
    });
    let result = await api.generateAiMermaid(firstPayload);
    let nextCode = sanitizeAiMermaidText(result.mermaidText);
    let validation = await validateMermaidSource(nextCode, currentMermaidConfig);
    let repaired = false;

    if (!validation.valid) {
      aiDialogState = {
        ...aiDialogState,
        isGenerating: true,
        statusKey: "ai.status.repairing",
        statusMessageKey: "ai.status.repairingMessage",
        requestToken
      };
      renderAiDialogState();

      const repairPayload = buildAiRequestPayload({
        prompt,
        mode: aiDialogState.mode,
        currentCode,
        previousCode: nextCode,
        validationError: validation.message
      });
      result = await api.generateAiMermaid(repairPayload);
      nextCode = sanitizeAiMermaidText(result.mermaidText);
      validation = await validateMermaidSource(nextCode, currentMermaidConfig);
      repaired = true;
    }

    if (requestToken !== aiDialogState.requestToken) {
      return;
    }

    aiDialogState = {
      ...aiDialogState,
      isGenerating: false,
      repaired,
      hasResult: true,
      isValid: validation.valid,
      resultCode: nextCode,
      model: result.model,
      error: validation.valid ? "" : validation.message,
      diff: buildLineDiffSummary(currentCode, nextCode),
      statusKey: validation.valid ? "ai.status.valid" : "ai.status.invalid",
      statusMessageKey: validation.valid ? "ai.status.validMessage" : "ai.status.invalidMessage"
    };
    renderAiDialogState();

    if (validation.valid) {
      updateStatusByKey("success", "status.renderedBadge", "ai.status.validMessage");
    } else {
      updateStatus("error", t("status.errorBadge"), validation.message);
    }
  } catch (error) {
    reportAppError("ai.generate", error);
    if (requestToken !== aiDialogState.requestToken) {
      return;
    }

    aiDialogState = {
      ...aiDialogState,
      isGenerating: false,
      error: normalizeError(error),
      statusKey: "ai.status.invalid",
      statusMessageKey: "ai.status.invalidMessage"
    };
    renderAiDialogState();
    updateStatus("error", t("status.errorBadge"), normalizeError(error));
  }
}

async function copyAiResultToClipboard() {
  if (!aiDialogState.hasResult || !aiDialogState.resultCode) {
    updateStatus("error", t("status.clipboardErrorBadge"), t("ai.error.copyUnavailable"));
    return;
  }

  try {
    await navigator.clipboard.writeText(aiDialogState.resultCode);
    updateStatusByKey("success", "status.copiedBadge", "status.codeCopied");
  } catch (error) {
    updateStatus("error", t("status.clipboardErrorBadge"), normalizeError(error));
  }
}

async function applyAiResultToEditor() {
  if (!(aiDialogState.hasResult && aiDialogState.isValid && aiDialogState.resultCode)) {
    updateStatus("error", t("status.errorBadge"), t("ai.error.applyUnavailable"));
    return;
  }

  replaceEditorCode(aiDialogState.resultCode);
  closeAiModal();
  updateStatusByKey("success", "status.savedBadge", "ai.status.appliedMessage");
}

async function testAiConnection() {
  settingsDraftAi = readSettingsAiDraftFromDom();
  const baseUrl = normalizeAiBaseUrl(settingsDraftAi.baseUrl);
  const model = String(settingsDraftAi.model ?? "").trim();
  const token = String(settingsDraftAi.token ?? "").trim();
  const useSavedToken =
    Boolean(settingsDraftAi.tokenConfigured) && !settingsDraftAi.clearToken && !token;

  if (!baseUrl || !model || (!token && !useSavedToken)) {
    settingsAiTestState = {
      running: false,
      tone: "error",
      message: t("ai.error.testIncomplete")
    };
    renderAiSettingsUi();
    return;
  }

  settingsAiTestState = {
    running: true,
    tone: "idle",
    message: ""
  };
  renderAiSettingsUi();

  try {
    const api = getDesktopApi(["testAiConnection"]);
    const result = await api.testAiConnection({
      baseUrl,
      model,
      token: token || null,
      useSavedToken
    });
    settingsAiTestState = {
      running: false,
      tone: "success",
      message: t("settings.ai.testSuccess", { host: result.endpointHost })
    };
    renderAiSettingsUi();
    updateStatusByKey("success", "status.testSuccessBadge", "settings.ai.testSuccess", {
      host: result.endpointHost
    });
  } catch (error) {
    reportAppError("ai.testConnection", error);
    settingsAiTestState = {
      running: false,
      tone: "error",
      message: normalizeError(error)
    };
    renderAiSettingsUi();
    updateStatus("error", t("status.settingsErrorBadge"), normalizeError(error));
  }
}

function replaceEditorCode(nextCode) {
  setEditorValue(`${String(nextCode ?? "").replace(/\s*$/u, "")}\n`, { silent: true });
  clearPreviewSourceSelection({ render: false });
  markDocumentDirty();
  updateCursorStatus();
  renderHighlightedCode();
  renderAiActionButton();
  scheduleAutoSave();
  scheduleRender();
}

async function validateMermaidSource(source, mermaidConfig) {
  const nextSource = String(source ?? "").trim();
  if (!nextSource) {
    return {
      valid: false,
      message: t("ai.error.applyUnavailable")
    };
  }

  try {
    mermaid.initialize(mermaidConfig);
    const id = `mermaid-ai-validate-${crypto.randomUUID()}`;
    await mermaid.render(id, nextSource);
    return {
      valid: true,
      message: ""
    };
  } catch (error) {
    return {
      valid: false,
      message: normalizeError(error)
    };
  }
}

async function openSettingsModal() {
  if (!(await rejectAiInlineWorkbench({ focusButton: false }))) {
    return;
  }

  window.clearTimeout(settingsModalCloseTimer);
  closeWorkspaceContextMenu();
  setExportMenuOpen(false);
  settingsDraftThemeMode = currentThemeMode;
  settingsDraftUiLanguage = currentUiLanguage;
  settingsDraftAi = {
    ...aiSettingsState,
    token: "",
    clearToken: false
  };
  resetSettingsAiTestState();
  settingsThemeSelect.value = resolveOfficialTheme(currentMermaidConfig.theme);
  settingsCustomConfig.value = lastValidConfigText;
  settingsClipboardFormat.value = loadClipboardFormat();
  settingsLanguageSelect.value = settingsDraftUiLanguage;
  renderAiSettingsUi();
  setSettingsThemeMode(settingsDraftThemeMode);
  setSettingsActiveTab(settingsActiveTab, { resetScroll: true });
  settingsModal.hidden = false;
  settingsModal.classList.remove("modal-animate-in");
  requestAnimationFrame(() => {
    settingsModal.classList.add("modal-animate-in");
  });
  queueMicrotask(() => {
    settingsCloseButton.focus({ preventScroll: true });
  });
}

function closeSettingsModal() {
  settingsModal.classList.remove("modal-animate-in");
  window.clearTimeout(settingsModalCloseTimer);
  settingsModalCloseTimer = window.setTimeout(() => {
    settingsModal.hidden = true;
    settingsButton.focus({ preventScroll: true });
  }, 160);
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
    let nextAiSnapshot = aiSettingsState;

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

    if (isTauriEnvironment() && aiSettingsState.runtimeSupported) {
      settingsDraftAi = readSettingsAiDraftFromDom();
      const validatedAiSettings = validateAiSettingsDraft(settingsDraftAi);
      if (!validatedAiSettings.valid) {
        setSettingsActiveTab("ai");
        throw new Error(buildAiSettingsValidationMessage(validatedAiSettings.missing));
      }

      if (aiInlineState.isOpen && !validatedAiSettings.enabled) {
        const discarded = await rejectAiInlineWorkbench({ focusButton: false });
        if (!discarded) {
          return;
        }
      }

      const api = getDesktopApi(["saveAiSettings"]);
      nextAiSnapshot = normalizeAiSettingsSnapshot(
        await api.saveAiSettings({
          enabled: validatedAiSettings.enabled,
          baseUrl: validatedAiSettings.baseUrl,
          model: validatedAiSettings.model,
          systemPromptTemplate: validatedAiSettings.systemPromptTemplate,
          userPromptTemplate: validatedAiSettings.userPromptTemplate,
          token: validatedAiSettings.token || null,
          clearToken: validatedAiSettings.clearToken
        })
      );
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
    aiSettingsState = nextAiSnapshot;
    settingsDraftAi = {
      ...aiSettingsState,
      token: "",
      clearToken: false
    };
    applyUiLanguage();
    applyPreviewTheme(currentPptTheme);
    scheduleRender();
    if (!shouldShowAiButton() && !aiModal.hidden) {
      closeAiModal();
    }
    if (aiInlineState.isOpen && !shouldShowAiButton()) {
      await rejectAiInlineWorkbench({ confirm: false, focusButton: false });
    }
    closeSettingsModal();
    updateStatusByKey("success", "status.settingsSavedBadge", "status.settingsSaved");
  } catch (error) {
    reportAppError("settings.save", error);
    updateStatus("error", t("status.settingsErrorBadge"), normalizeError(error));
  }
}

function toggleExportMenu() {
  closeWorkspaceContextMenu();
  setExportMenuOpen(exportMenu.hidden);
}

function closeWorkspaceContextMenu() {
  workspaceContextMenu.hidden = true;
  contextMenuTarget = null;
}

function setExportMenuOpen(nextOpen) {
  const isOpen = Boolean(nextOpen);
  exportMenu.hidden = !isOpen;
  exportButton.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    menuDismissGuardUntil = performance.now() + 180;
    retriggerAnimation(exportMenu, "menu-animate-in", { removeAfterMs: 0 });
    queueMicrotask(() => {
      getVisibleMenuItems(exportMenuItems)[0]?.focus({ preventScroll: true });
    });
  }
}

function getVisibleMenuItems(items) {
  return items.filter((item) => !item.hidden && !item.disabled);
}

function handleMenuKeydown(event, menuElement, items, closeMenu) {
  const visibleItems = getVisibleMenuItems(items);
  if (!visibleItems.length) {
    return;
  }

  const currentIndex = visibleItems.indexOf(document.activeElement);
  if (event.key === "Escape") {
    event.preventDefault();
    closeMenu();
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % visibleItems.length;
    visibleItems[nextIndex]?.focus({ preventScroll: true });
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    const nextIndex =
      currentIndex < 0 ? visibleItems.length - 1 : (currentIndex - 1 + visibleItems.length) % visibleItems.length;
    visibleItems[nextIndex]?.focus({ preventScroll: true });
    return;
  }

  if (event.key === "Tab") {
    closeMenu();
    return;
  }

  if ((event.key === "Enter" || event.key === " ") && menuElement.contains(event.target)) {
    event.preventDefault();
    document.activeElement?.click?.();
  }
}

function handleGlobalKeydown(event) {
  if (event.key !== "Escape") {
    return;
  }

  if (!aiModal.hidden) {
    closeAiModal();
    return;
  }

  if (!workspaceContextMenu.hidden) {
    closeWorkspaceContextMenu();
    return;
  }

  if (!exportMenu.hidden) {
    setExportMenuOpen(false);
    exportButton.focus({ preventScroll: true });
    return;
  }

  if (!settingsModal.hidden) {
    closeSettingsModal();
  }
}

function getVisibleTreeRows() {
  return Array.from(workspaceTree.querySelectorAll(".tree-row"));
}

function focusAdjacentTreeRow(currentRow, direction) {
  const rows = getVisibleTreeRows();
  const currentIndex = rows.indexOf(currentRow);
  if (currentIndex < 0) {
    return;
  }

  const nextRow = rows[currentIndex + direction];
  nextRow?.focus({ preventScroll: true });
}

function focusFirstChildTreeRow(row) {
  const childrenGroup = row.nextElementSibling;
  const firstChildRow = childrenGroup?.querySelector?.(".tree-row");
  firstChildRow?.focus({ preventScroll: true });
}

function focusParentTreeRow(row) {
  const parentChildren = row.parentElement?.closest(".tree-children");
  const parentRow = parentChildren?.previousElementSibling;
  if (parentRow?.classList.contains("tree-row")) {
    parentRow.focus({ preventScroll: true });
  }
}

function getSelectedOrFirstTreeRow() {
  return workspaceTree.querySelector(".tree-row-active") ?? workspaceTree.querySelector(".tree-row");
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

function isPieSource(source) {
  return /^\s*pie(?:\s+showData)?\b/i.test(source);
}

function isJourneySource(source) {
  return /^\s*journey\b/i.test(source);
}

function isClassSource(source) {
  return /^\s*classDiagram(?:-v2)?\b/i.test(source);
}

function isErSource(source) {
  return /^\s*erDiagram\b/i.test(source);
}

function isStateSource(source) {
  return /^\s*stateDiagram(?:-v2)?\b/i.test(source);
}

function isPptExportableSource(source) {
  return (
    isFlowchartSource(source) ||
    isSequenceSource(source) ||
    isPieSource(source) ||
    isJourneySource(source) ||
    isClassSource(source) ||
    isErSource(source) ||
    isStateSource(source)
  );
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

  const { blob } = await getClipboardRasterPayload(svgMarkup, format, width, height);
  await navigator.clipboard.write([
    new ClipboardItem({
      [blob.type]: blob
    })
  ]);
}

async function copyRasterToClipboardViaDesktop(svgMarkup, width, height) {
  const api = getDesktopApi(["copyImageToClipboard"]);
  const format = loadClipboardFormat();
  const { bytes } = await getClipboardRasterPayload(svgMarkup, format, width, height);
  await api.copyImageToClipboard({
    buffer: bytes
  });
}

async function getClipboardRasterPayload(svgMarkup, format, width, height) {
  const cacheKey = `clipboard:${format}:${width}:${height}:${svgMarkup}`;
  if (clipboardRasterCache.key === cacheKey && clipboardRasterCache.blob && clipboardRasterCache.bytes) {
    return clipboardRasterCache;
  }

  const blob = await rasterizeSvgToBlob(svgMarkup, format, width, height, {
    scale: 1
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  clipboardRasterCache = { key: cacheKey, blob, bytes };
  return clipboardRasterCache;
}

async function rasterizeSvgToBlob(svgMarkup, format, width, height, options = {}) {
  const scale = Math.max(0.5, Number(options.scale) || 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error(t("error.canvasContextUnavailable"));
  }

  context.scale(scale, scale);

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
    const blob = new Blob([svgMarkup], {
      type: "image/svg+xml;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t("error.rasterizeFailed")));
    };
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
