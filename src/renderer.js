import * as desktopApiModule from "./platform/desktop-api.js";
import { initializeAppContext, app } from "./app/context.js";
import { createDom } from "./app/dom.js";
import { loadUiLanguage, createTranslator } from "./app/i18n.js";
import { createAppState } from "./app/state.js";
import { createMermaidDocumentCache } from "./app/mermaid-document.js";
import { renderDocumentState } from "./app/common.js";
import { sampleCode, workspaceSortModeStorageKey } from "./app/constants.js";
import { initializePreviewModule } from "./app/preview.js";
import { initializeExportModule } from "./app/export.js";
import { initializeEditorModule } from "./app/editor.js";
import { initializeAiModule } from "./app/ai.js";
import { initializeWorkspaceModule } from "./app/workspace.js";
import { initializeSettingsModule } from "./app/settings.js";

function loadWorkspaceSortMode() {
  const saved = window.localStorage.getItem(workspaceSortModeStorageKey);
  return ["updated", "created"].includes(saved) ? saved : "name";
}

function loadEditorFontSize() {
  const raw = Number.parseInt(
    window.localStorage.getItem("mermaid-tool.editor-font-size") ?? "",
    10
  );
  if (!Number.isFinite(raw)) {
    return 14;
  }

  return Math.min(24, Math.max(12, raw));
}

function loadWorkspaceSidebarCollapsed() {
  return window.localStorage.getItem("mermaid-tool.workspace-sidebar-collapsed") === "true";
}

function loadEditorPaneWidth() {
  const raw = Number.parseInt(
    window.localStorage.getItem("mermaid-tool.editor-pane-width") ?? "",
    10
  );
  if (!Number.isFinite(raw)) {
    return 520;
  }

  return Math.min(960, Math.max(360, raw));
}

function handleGlobalKeydown(event) {
  if (event.key !== "Escape") {
    return;
  }

  if (!app.dom.aiModal.hidden) {
    app.modules.ai?.closeAiModal?.();
    return;
  }

  if (!app.dom.drawioAiModal.hidden) {
    app.modules.ai?.closeDrawioAiModal?.();
    return;
  }

  if (!app.dom.workspaceContextMenu.hidden) {
    app.modules.workspace?.closeWorkspaceContextMenu?.();
    return;
  }

  if (!app.dom.exportMenu.hidden) {
    app.modules.export?.setExportMenuOpen?.(false);
    app.dom.exportButton.focus({ preventScroll: true });
    return;
  }

  if (!app.dom.settingsModal.hidden) {
    app.modules.settings?.closeSettingsModal?.();
  }
}

const uiLanguage = loadUiLanguage();
const dom = createDom();
const i18n = createTranslator(uiLanguage);
const state = createAppState({
  uiLanguage,
  workspaceSortMode: loadWorkspaceSortMode(),
  editorFontSize: loadEditorFontSize(),
  sidebarCollapsed: loadWorkspaceSidebarCollapsed(),
  editorPaneWidth: loadEditorPaneWidth()
});

initializeAppContext({
  dom,
  state,
  documentCache: createMermaidDocumentCache(),
  i18n,
  desktopApi: desktopApiModule
});

initializePreviewModule();
initializeExportModule();
initializeEditorModule();
initializeAiModule();
initializeWorkspaceModule();
initializeSettingsModule();

renderDocumentState();
app.modules.editor?.renderHighlightedCode?.();
app.modules.editor?.updateCursorStatus?.();
app.modules.preview?.applyPreviewTheme?.(app.state.currentPptTheme);

window.addEventListener("keydown", (event) => handleGlobalKeydown(event));

const hasStoredWorkspaceRoot = Boolean(
  window.localStorage.getItem("mermaid-tool.workspace-root")
);
if (!hasStoredWorkspaceRoot) {
  void app.modules.preview?.renderDiagram?.(sampleCode, app.state.currentMermaidConfig);
}

window.requestAnimationFrame(() => {
  window.setTimeout(() => {
    void app.modules.workspace?.initializeWorkspaceState?.();
  }, 0);
});
