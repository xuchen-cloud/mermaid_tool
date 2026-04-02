import {
  buildPptThemeFromMermaidConfig,
  createDefaultMermaidConfig,
  normalizeMermaidConfig,
  parseMermaidConfigText,
  resolveOfficialTheme,
  stringifyMermaidConfig
} from "../mermaid-config.js";
import { isTauriEnvironment } from "../platform/desktop-api.js";
import { app } from "./context.js";
import {
  mermaidConfigStorageKey,
  mermaidThemeModeStorageKey,
  uiLanguageStorageKey
} from "./constants.js";
import {
  renderCurrentStatus,
  reportAppError,
  t,
  updateStatus,
  updateStatusByKey
} from "./common.js";
import { normalizeError } from "./utils.js";
import { normalizeUiLanguage } from "./i18n.js";

export function initializeSettingsModule() {
  initializeSettingsState();
  applyUiLanguage();

  app.dom.settingsButton.addEventListener("click", () => void openSettingsModal());
  app.dom.settingsBackdrop.addEventListener("click", () => closeSettingsModal());
  app.dom.settingsCloseButton.addEventListener("click", () => closeSettingsModal());
  app.dom.settingsCancelButton.addEventListener("click", () => closeSettingsModal());
  app.dom.settingsSaveButton.addEventListener("click", () => void saveSettingsModal());
  app.dom.settingsTabGeneral.addEventListener("click", () => setSettingsActiveTab("general"));
  app.dom.settingsTabAi.addEventListener("click", () => setSettingsActiveTab("ai"));
  app.dom.settingsTabGeneral.addEventListener("keydown", (event) => handleSettingsTabKeydown(event));
  app.dom.settingsTabAi.addEventListener("keydown", (event) => handleSettingsTabKeydown(event));
  app.dom.themeModeOfficialButton.addEventListener("click", () => setSettingsThemeMode("official"));
  app.dom.themeModeCustomButton.addEventListener("click", () => setSettingsThemeMode("custom"));

  app.modules.settings = {
    applyUiLanguage,
    openSettingsModal,
    closeSettingsModal,
    setSettingsThemeMode
  };
}

function initializeSettingsState() {
  const { text, config } = loadMermaidConfigState();
  app.state.lastValidConfigText = text;
  app.state.currentMermaidConfig = config;
  app.state.currentPptTheme = buildPptThemeFromMermaidConfig(config);
  app.state.currentThemeMode = resolveThemeMode(text, config);
  app.modules.preview?.applyPreviewTheme?.(app.state.currentPptTheme);
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
    return {
      text: stringifyMermaidConfig(parsed),
      config: normalizeMermaidConfig(parsed)
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

export function applyUiLanguage() {
  document.documentElement.lang = app.state.currentUiLanguage;
  document.documentElement.dataset.uiLanguage = app.state.currentUiLanguage;
  document.title = t("app.title");
  app.dom.topbarTitle.textContent = t("app.title");
  app.dom.projectsButton.textContent = t("nav.projects");
  app.dom.settingsButton.setAttribute("aria-label", t("settings.label"));
  app.dom.workspaceKicker.textContent = t("workspace.title");
  app.dom.workspaceSortSelect.setAttribute("aria-label", t("workspace.sortAria"));

  for (const option of app.dom.workspaceSortSelect.options) {
    option.textContent = t(`workspace.sort.${option.value}`);
  }

  app.dom.workspaceRefreshButton.setAttribute("aria-label", t("workspace.refreshAria"));
  app.dom.newDocumentButton.textContent = t("workspace.newMermaidFile");
  app.dom.newDrawioDocumentButton.textContent = t("workspace.newDrawioFile");
  app.dom.workspaceTree.setAttribute("aria-label", t("workspace.treeAria"));
  app.dom.workspaceTree.setAttribute("aria-multiselectable", "false");
  app.dom.contextNewMermaidFileButton.textContent = t("workspace.context.newMermaidFile");
  app.dom.contextNewDrawioFileButton.textContent = t("workspace.context.newDrawioFile");
  app.dom.contextNewFolderButton.textContent = t("workspace.context.newFolder");
  app.dom.contextRenameButton.textContent = t("workspace.context.rename");
  app.dom.contextDeleteButton.textContent = t("workspace.context.delete");
  app.dom.editorEyebrow.textContent = t("editor.title");
  app.dom.editorDocumentName.setAttribute("aria-label", t("editor.fileNameAria"));
  app.dom.copyCodeButton.textContent = t("editor.copyCode");
  app.dom.paneDivider.setAttribute("aria-label", t("preview.resizeAria"));
  app.dom.previewEyebrow.textContent = t("preview.title");
  app.dom.previewBeforeLabel.textContent = t("preview.compare.before");
  app.dom.previewAfterLabel.textContent = t("preview.compare.after");
  app.dom.previewBeforeZoomOutButton.setAttribute("aria-label", t("preview.compare.zoomOutBeforeAria"));
  app.dom.previewBeforeZoomFitButton.setAttribute("aria-label", t("preview.compare.zoomFitBeforeAria"));
  app.dom.previewBeforeZoomInButton.setAttribute("aria-label", t("preview.compare.zoomInBeforeAria"));
  app.dom.previewAfterZoomOutButton.setAttribute("aria-label", t("preview.compare.zoomOutAfterAria"));
  app.dom.previewAfterZoomFitButton.setAttribute("aria-label", t("preview.compare.zoomFitAfterAria"));
  app.dom.previewAfterZoomInButton.setAttribute("aria-label", t("preview.compare.zoomInAfterAria"));
  app.dom.copyClipboardButton.textContent = t("preview.copyImage");
  app.dom.exportButton.textContent = t("preview.export");
  app.dom.exportDrawioButton.textContent = "draw.io";
  app.dom.previewEmpty.textContent = t("preview.empty");
  app.dom.zoomInButton.setAttribute("aria-label", t("preview.zoomInAria"));
  app.dom.zoomOutButton.setAttribute("aria-label", t("preview.zoomOutAria"));
  app.dom.zoomFitButton.setAttribute("aria-label", t("preview.zoomFitAria"));
  app.dom.encodingStatus.textContent = t("status.encoding");
  app.dom.settingsEyebrow.textContent = t("settings.label");
  app.dom.settingsTitle.textContent = t("settings.title");
  app.dom.settingsCloseButton.setAttribute("aria-label", t("settings.closeAria"));
  app.dom.settingsTablist.setAttribute("aria-label", t("settings.tabs.aria"));
  app.dom.settingsTabGeneral.textContent = t("settings.tabs.general");
  app.dom.settingsTabAi.textContent = t("settings.tabs.ai");
  app.dom.settingsLanguageTitle.textContent = t("settings.language.title");
  app.dom.settingsLanguageLabel.textContent = t("settings.language.label");
  app.dom.settingsLanguageSelect.options[0].textContent = t("settings.language.en");
  app.dom.settingsLanguageSelect.options[1].textContent = t("settings.language.zh-CN");
  app.dom.settingsThemeTitle.textContent = t("settings.theme.title");
  app.dom.themeModeOfficialButton.textContent = t("settings.theme.official");
  app.dom.themeModeCustomButton.textContent = t("settings.theme.custom");
  app.dom.settingsThemeLabel.textContent = t("settings.theme.label");
  app.dom.settingsCustomConfigLabel.textContent = t("settings.customConfig.label");
  app.dom.settingsCustomConfig.setAttribute("aria-label", t("settings.customConfig.aria"));
  app.dom.settingsClipboardTitle.textContent = t("settings.clipboard.title");
  app.dom.settingsClipboardLabel.textContent = t("settings.clipboard.label");
  app.dom.settingsAiTitle.textContent = t("settings.ai.connectionTitle");
  app.dom.settingsAiPromptsTitle.textContent = t("settings.ai.promptsTitle");
  app.dom.settingsAiEnabledLabel.textContent = t("settings.ai.enabled");
  app.dom.settingsAiBaseUrlLabel.textContent = t("settings.ai.baseUrl");
  app.dom.settingsAiModelLabel.textContent = t("settings.ai.model");
  app.dom.settingsAiTokenLabel.textContent = t("settings.ai.token");
  app.dom.settingsAiSystemPromptLabel.textContent = t("settings.ai.systemPrompt");
  app.dom.settingsAiUserPromptLabel.textContent = t("settings.ai.userPrompt");
  app.dom.settingsAiPromptNote.textContent = t("settings.ai.promptNote");
  app.dom.settingsCancelButton.textContent = t("settings.cancel");
  app.dom.settingsSaveButton.textContent = t("settings.save");
  app.dom.aiInlineKicker.textContent = t("ai.label");
  app.dom.aiInlinePromptLabel.textContent = t("ai.prompt.label");
  app.dom.aiInlinePromptInput.setAttribute("placeholder", t("ai.prompt.placeholder"));
  app.dom.aiInlineThinkingLabel.textContent = t("ai.inline.thinking");
  app.dom.aiInlineAdjustButton.textContent = t("ai.inline.adjust");
  app.dom.aiInlineRejectButton.textContent = t("ai.inline.reject");
  app.dom.aiInlineAcceptButton.textContent = t("ai.inline.accept");
  app.dom.aiEyebrow.textContent = t("ai.label");
  app.dom.aiTitle.textContent = t("ai.title");
  app.dom.aiCloseButton.setAttribute("aria-label", t("ai.closeAria"));
  app.dom.aiModeNewButton.textContent = t("ai.mode.new");
  app.dom.aiModeMergeButton.textContent = t("ai.mode.merge");
  app.dom.aiPromptLabel.textContent = t("ai.prompt.label");
  app.dom.aiPromptInput.setAttribute("placeholder", t("ai.prompt.placeholder"));
  app.dom.aiResultKicker.textContent = t("ai.result");
  app.dom.aiResultTitle.textContent = t("ai.result.title");
  app.dom.aiCodePanelTitle.textContent = t("ai.result.code");
  app.dom.aiDiffPanelTitle.textContent = t("ai.result.diffTitle");
  app.dom.aiDiffBeforeLabel.textContent = t("ai.diff.before");
  app.dom.aiDiffAfterLabel.textContent = t("ai.diff.after");
  app.dom.aiCancelButton.textContent = t("settings.cancel");
  app.dom.aiCopyButton.textContent = t("ai.copy");
  app.dom.aiApplyButton.textContent = t("ai.apply");

  renderSettingsTabs();
  app.modules.workspace?.applyWorkspaceSidebarState?.();
  app.modules.editor?.renderDocumentMode?.();
  app.modules.workspace?.renderWorkspaceState?.();
  app.modules.editor?.updateCursorStatus?.();
  renderCurrentStatus();
  app.modules.ai?.renderAiSettingsUi?.();
  app.modules.ai?.renderAiActionButton?.();
  app.modules.ai?.renderAiInlineState?.();
  app.modules.ai?.renderAiDialogState?.();
}

function getAvailableSettingsTabs() {
  return isAiSettingsRuntimeSupported() ? ["general", "ai"] : ["general"];
}

function isAiSettingsRuntimeSupported() {
  return Boolean(app.state.aiSettingsState.runtimeSupported && isTauriEnvironment());
}

function normalizeSettingsTab(tab) {
  return tab === "ai" && isAiSettingsRuntimeSupported() ? "ai" : "general";
}

function getSettingsTabButton(tab) {
  return tab === "ai" ? app.dom.settingsTabAi : app.dom.settingsTabGeneral;
}

function renderSettingsTabs() {
  app.state.settingsActiveTab = normalizeSettingsTab(app.state.settingsActiveTab);
  const aiTabVisible = isAiSettingsRuntimeSupported();
  const generalActive = app.state.settingsActiveTab === "general";
  const aiActive = aiTabVisible && app.state.settingsActiveTab === "ai";

  app.dom.settingsTabGeneral.classList.toggle("settings-nav-button-active", generalActive);
  app.dom.settingsTabGeneral.setAttribute("aria-selected", String(generalActive));
  app.dom.settingsTabGeneral.tabIndex = generalActive ? 0 : -1;
  app.dom.settingsPanelGeneral.hidden = !generalActive;

  app.dom.settingsTabAi.hidden = !aiTabVisible;
  app.dom.settingsTabAi.classList.toggle("settings-nav-button-active", aiActive);
  app.dom.settingsTabAi.setAttribute("aria-selected", String(aiActive));
  app.dom.settingsTabAi.tabIndex = aiActive ? 0 : -1;
  app.dom.settingsPanelAi.hidden = !aiActive;
}

function setSettingsActiveTab(tab, options = {}) {
  const nextTab = normalizeSettingsTab(tab);
  const changed = app.state.settingsActiveTab !== nextTab;
  app.state.settingsActiveTab = nextTab;
  renderSettingsTabs();

  if (options.resetScroll === true || (changed && options.resetScroll !== false)) {
    app.dom.settingsContent.scrollTop = 0;
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
  const currentIndex = tabs.indexOf(app.state.settingsActiveTab);
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

export async function openSettingsModal() {
  if (!(await app.modules.ai?.rejectAiInlineWorkbench?.({ focusButton: false }))) {
    return;
  }

  window.clearTimeout(app.state.timers.settingsModalClose);
  app.modules.workspace?.closeWorkspaceContextMenu?.();
  app.modules.export?.setExportMenuOpen?.(false);
  app.state.settingsDraftThemeMode = app.state.currentThemeMode;
  app.state.settingsDraftUiLanguage = app.state.currentUiLanguage;
  app.modules.ai?.beginSettingsEdit?.();
  app.dom.settingsThemeSelect.value = resolveOfficialTheme(app.state.currentMermaidConfig.theme);
  app.dom.settingsCustomConfig.value = app.state.lastValidConfigText;
  app.dom.settingsClipboardFormat.value = app.modules.export?.loadClipboardFormat?.() ?? "png";
  app.dom.settingsLanguageSelect.value = app.state.settingsDraftUiLanguage;
  app.modules.ai?.renderAiSettingsUi?.();
  setSettingsThemeMode(app.state.settingsDraftThemeMode);
  setSettingsActiveTab(app.state.settingsActiveTab, { resetScroll: true });
  app.dom.settingsModal.hidden = false;
  app.dom.settingsModal.classList.remove("modal-animate-in");
  requestAnimationFrame(() => {
    app.dom.settingsModal.classList.add("modal-animate-in");
  });
  queueMicrotask(() => {
    app.dom.settingsCloseButton.focus({ preventScroll: true });
  });
}

export function closeSettingsModal() {
  app.dom.settingsModal.classList.remove("modal-animate-in");
  window.clearTimeout(app.state.timers.settingsModalClose);
  app.state.timers.settingsModalClose = window.setTimeout(() => {
    app.dom.settingsModal.hidden = true;
    app.dom.settingsButton.focus({ preventScroll: true });
  }, 160);
}

export function setSettingsThemeMode(mode) {
  app.state.settingsDraftThemeMode = mode === "custom" ? "custom" : "official";
  app.dom.settingsOfficialThemeField.hidden = app.state.settingsDraftThemeMode === "custom";
  app.dom.settingsCustomPanel.hidden = app.state.settingsDraftThemeMode !== "custom";
  app.dom.themeModeOfficialButton.classList.toggle(
    "settings-mode-button-active",
    app.state.settingsDraftThemeMode === "official"
  );
  app.dom.themeModeCustomButton.classList.toggle(
    "settings-mode-button-active",
    app.state.settingsDraftThemeMode === "custom"
  );
}

async function saveSettingsModal() {
  try {
    let nextConfig;
    let nextText;

    if (app.state.settingsDraftThemeMode === "custom") {
      const parsed = parseMermaidConfigText(app.dom.settingsCustomConfig.value);
      nextConfig = normalizeMermaidConfig(parsed);
      nextText = stringifyMermaidConfig(parsed);
    } else {
      const theme = resolveOfficialTheme(app.dom.settingsThemeSelect.value);
      const defaultConfig = createDefaultMermaidConfig(theme);
      nextConfig = normalizeMermaidConfig(defaultConfig);
      nextText = stringifyMermaidConfig(defaultConfig);
    }

    const nextAiSnapshot = await app.modules.ai?.saveSettingsDraft?.();
    if (nextAiSnapshot === null) {
      return;
    }

    app.state.currentThemeMode = app.state.settingsDraftThemeMode;
    app.state.currentUiLanguage = normalizeUiLanguage(app.dom.settingsLanguageSelect.value);
    app.state.settingsDraftUiLanguage = app.state.currentUiLanguage;
    app.state.currentMermaidConfig = nextConfig;
    app.state.currentPptTheme = buildPptThemeFromMermaidConfig(nextConfig);
    app.state.lastValidConfigText = nextText;
    window.localStorage.setItem(mermaidConfigStorageKey, nextText);
    window.localStorage.setItem(mermaidThemeModeStorageKey, app.state.currentThemeMode);
    window.localStorage.setItem(uiLanguageStorageKey, app.state.currentUiLanguage);
    app.modules.export?.saveClipboardFormat?.(app.dom.settingsClipboardFormat.value);

    if (nextAiSnapshot) {
      app.state.aiSettingsState = nextAiSnapshot;
    }

    applyUiLanguage();
    app.modules.preview?.applyPreviewTheme?.(app.state.currentPptTheme);
    app.modules.preview?.scheduleRender?.();

    if (!app.modules.ai?.shouldShowAiButton?.() && !app.dom.aiModal.hidden) {
      app.modules.ai?.closeAiModal?.();
    }

    if (app.state.aiInlineState.isOpen && !app.modules.ai?.shouldShowAiButton?.()) {
      await app.modules.ai?.rejectAiInlineWorkbench?.({
        confirm: false,
        focusButton: false
      });
    }

    closeSettingsModal();
    updateStatusByKey("success", "status.settingsSavedBadge", "status.settingsSaved");
  } catch (error) {
    reportAppError("settings.save", error);
    updateStatus("error", t("status.settingsErrorBadge"), normalizeError(error));
  }
}
