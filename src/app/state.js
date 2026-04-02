import {
  defaultAiSystemPromptTemplate,
  defaultAiUserPromptTemplate,
  defaultPreviewDimensions
} from "./constants.js";
import {
  buildPptThemeFromMermaidConfig,
  createDefaultMermaidConfig,
  normalizeMermaidConfig,
  stringifyMermaidConfig
} from "../mermaid-config.js";
import { isTauriEnvironment } from "../platform/desktop-api.js";

export function createDraftDocumentState() {
  return {
    name: "scratch.mmd",
    path: null,
    kind: "draft",
    dirty: false
  };
}

export function createEmptyWorkspaceState(sortMode = "name") {
  return {
    rootPath: null,
    rootNode: null,
    nodesByPath: new Map(),
    childrenByPath: new Map(),
    loadedPaths: new Set(),
    expandedPaths: new Set(),
    selectedPath: null,
    sortMode
  };
}

export function createDefaultAiSettingsState() {
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

export function createDefaultAiDialogState() {
  return {
    mode: "new",
    isGenerating: false,
    isValid: false,
    repaired: false,
    hasResult: false,
    resultCode: "",
    model: "",
    error: "",
    diff: { added: 0, removed: 0 },
    statusKey: "ai.status.idle",
    statusMessageKey: "ai.status.idleMessage",
    requestToken: 0
  };
}

export function createDefaultAiInlineState() {
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
    thinkingText: "",
    hasStreamedContent: false,
    model: "",
    error: "",
    diff: { added: 0, removed: 0 },
    statusKey: "ai.status.idle",
    statusMessageKey: "ai.status.idleMessage",
    requestToken: 0
  };
}

export function createDefaultPreviewCompareItemState() {
  return {
    svg: "",
    dimensions: { ...defaultPreviewDimensions },
    error: "",
    scale: 1,
    fitScale: 1,
    autoFit: true
  };
}

export function createDefaultPreviewCompareState() {
  return {
    isActive: false,
    layout: "rows",
    before: createDefaultPreviewCompareItemState(),
    after: createDefaultPreviewCompareItemState()
  };
}

export function createAppState({ uiLanguage, workspaceSortMode, editorFontSize, sidebarCollapsed, editorPaneWidth }) {
  const mermaidConfig = normalizeMermaidConfig(createDefaultMermaidConfig());
  return {
    timers: {
      render: null,
      autoSave: null,
      settingsModalClose: null,
      aiModalClose: null,
      aiInlineValidation: null
    },
    status: {
      descriptor: {
        type: "key",
        state: "idle",
        badgeKey: "status.readyBadge",
        messageKey: "status.idleMessage",
        vars: {}
      }
    },
    currentUiLanguage: uiLanguage,
    currentThemeMode: "official",
    currentMermaidConfig: mermaidConfig,
    currentPptTheme: buildPptThemeFromMermaidConfig(mermaidConfig),
    lastValidConfigText: stringifyMermaidConfig(createDefaultMermaidConfig()),
    currentDocument: createDraftDocumentState(),
    currentWorkspace: createEmptyWorkspaceState(workspaceSortMode),
    currentMermaidDocument: null,
    latestSvg: "",
    latestSvgDimensions: { ...defaultPreviewDimensions },
    previewSourceMap: null,
    previewScale: 1,
    previewFitScale: 1,
    previewAutoFit: true,
    previewIsHovered: false,
    previewSpacePressed: false,
    previewPanMode: false,
    previewPanState: null,
    previewHighlightedLines: new Set(),
    previewPrimaryHighlightedLine: null,
    previewCompareState: createDefaultPreviewCompareState(),
    drawioEditor: null,
    contextMenuTarget: null,
    workspaceDropTarget: null,
    workspaceDragState: null,
    workspaceSuppressClickUntil: 0,
    menuDismissGuardUntil: 0,
    inlineRenameState: null,
    editorFontSize,
    workspaceSidebarCollapsed: sidebarCollapsed,
    editorPaneWidth,
    paneResizeState: null,
    editorDocumentNameMeasureContext: null,
    clipboardRasterCache: {
      key: "",
      blob: null,
      bytes: null
    },
    settingsDraftThemeMode: "official",
    settingsDraftUiLanguage: uiLanguage,
    settingsActiveTab: "general",
    settingsAiTestState: {
      running: false,
      tone: "idle",
      message: ""
    },
    aiSettingsState: createDefaultAiSettingsState(),
    settingsDraftAi: createDefaultAiSettingsState(),
    aiRequestSequence: 0,
    aiDialogState: createDefaultAiDialogState(),
    aiInlineState: createDefaultAiInlineState(),
    aiInlineValidationSequence: 0,
    aiStreamListenerPromise: null
  };
}
