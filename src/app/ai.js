import mermaid from "../../node_modules/mermaid/dist/mermaid.esm.min.mjs";
import {
  buildAiDrawioRequestPayload,
  buildAiRequestPayload,
  buildLineDiffSummary,
  hasMeaningfulDiagram,
  normalizeAiBaseUrl,
  resolveAiActionMode,
  sanitizeAiDrawioXml,
  sanitizeAiMermaidText,
  validateAiSettingsDraft
} from "../ai-utils.js";
import { isTauriEnvironment, listenToTauriEvent } from "../platform/desktop-api.js";
import { validateDrawioXml } from "../drawio/drawio-host.js";
import { app } from "./context.js";
import {
  aiStreamEventName,
  defaultAiDrawioSystemPromptTemplate,
  defaultAiDrawioUserPromptTemplate,
  defaultAiSystemPromptTemplate,
  defaultAiUserPromptTemplate,
  maskedSavedTokenValue,
  mermaidDeclarationPattern,
  sampleCode
} from "./constants.js";
import {
  createDefaultAiDialogState,
  createDefaultDrawioAiDialogState,
  createDefaultAiInlineState,
  createDefaultAiSettingsState
} from "./state.js";
import {
  getCurrentDocumentTitle,
  isDrawioDocumentKind,
  isMermaidDocumentKind,
  normalizeError,
  reportAppError,
  t,
  updateStatus,
  updateStatusByKey
} from "./common.js";

export function initializeAiModule() {
  app.dom.settingsAiEnabled.addEventListener("change", (event) => handleSettingsAiDraftInput(event));
  app.dom.settingsAiBaseUrl.addEventListener("input", (event) => handleSettingsAiDraftInput(event));
  app.dom.settingsAiModel.addEventListener("input", (event) => handleSettingsAiDraftInput(event));
  app.dom.settingsAiSystemPrompt.addEventListener("input", (event) => handleSettingsAiDraftInput(event));
  app.dom.settingsAiUserPrompt.addEventListener("input", (event) => handleSettingsAiDraftInput(event));
  app.dom.settingsAiDrawioSystemPrompt.addEventListener("input", (event) => handleSettingsAiDraftInput(event));
  app.dom.settingsAiDrawioUserPrompt.addEventListener("input", (event) => handleSettingsAiDraftInput(event));
  app.dom.settingsAiClearToken.addEventListener("click", () => toggleSettingsAiClearToken());
  app.dom.settingsAiToken.addEventListener("input", () => handleSettingsAiTokenInput());
  app.dom.settingsAiToken.addEventListener("focus", () => handleSettingsAiTokenFocus());
  app.dom.settingsAiToken.addEventListener("blur", () => handleSettingsAiTokenBlur());
  app.dom.settingsAiTestButton.addEventListener("click", () => void testAiConnection());
  app.dom.settingsAiPromptFamilyMermaidButton.addEventListener("click", () =>
    setAiSettingsPromptFamily("mermaid")
  );
  app.dom.settingsAiPromptFamilyDrawioButton.addEventListener("click", () =>
    setAiSettingsPromptFamily("drawio")
  );
  app.dom.settingsAiMermaidPresetDefaultButton.addEventListener("click", () =>
    setAiSettingsPromptMode("mermaid", "default")
  );
  app.dom.settingsAiMermaidPresetCustomButton.addEventListener("click", () =>
    setAiSettingsPromptMode("mermaid", "custom")
  );
  app.dom.settingsAiDrawioPresetDefaultButton.addEventListener("click", () =>
    setAiSettingsPromptMode("drawio", "default")
  );
  app.dom.settingsAiDrawioPresetCustomButton.addEventListener("click", () =>
    setAiSettingsPromptMode("drawio", "custom")
  );
  app.dom.aiButton.addEventListener("click", () => openAiInlineWorkbench());
  app.dom.drawioAiButton.addEventListener("click", () => void openDrawioAiModal());
  app.dom.aiInlineAdjustButton.addEventListener("click", () => reopenAiInlinePrompt());
  app.dom.aiInlineRejectButton.addEventListener("click", () => void rejectAiInlineWorkbench());
  app.dom.aiInlineAcceptButton.addEventListener("click", () => void acceptAiInlineWorkbench());
  app.dom.aiInlineGenerateButton.addEventListener("click", () => void generateAiInlineProposal());
  app.dom.aiInlinePromptInput.addEventListener("input", () => handleAiInlinePromptInput());
  app.dom.aiBackdrop.addEventListener("click", () => closeAiModal());
  app.dom.aiCloseButton.addEventListener("click", () => closeAiModal());
  app.dom.aiCancelButton.addEventListener("click", () => closeAiModal());
  app.dom.aiModeNewButton.addEventListener("click", () => setAiDialogMode("new"));
  app.dom.aiModeMergeButton.addEventListener("click", () => setAiDialogMode("merge"));
  app.dom.aiGenerateButton.addEventListener("click", () => void generateAiMermaidCode());
  app.dom.aiCopyButton.addEventListener("click", () => void copyAiResultToClipboard());
  app.dom.aiApplyButton.addEventListener("click", () => void applyAiResultToEditor());
  app.dom.drawioAiBackdrop?.addEventListener("click", () => closeDrawioAiModal());
  app.dom.drawioAiCloseButton.addEventListener("click", () => closeDrawioAiModal());
  app.dom.drawioAiCancelButton.addEventListener("click", () => closeDrawioAiModal());
  app.dom.drawioAiGenerateButton.addEventListener("click", () => void generateAiDrawioXml());
  app.dom.drawioAiApplyButton.addEventListener("click", () => void applyDrawioAiResult());

  app.modules.ai = {
    initializeAiSettingsState,
    ensureAiStreamListener,
    beginSettingsEdit,
    saveSettingsDraft,
    renderAiSettingsUi,
    renderAiActionButton,
    shouldShowAiButton,
    shouldShowDrawioAiButton,
    rejectAiInlineWorkbench,
    handleAiInlineEditorInput,
    renderAiInlineState,
    renderAiDialogState,
    renderDrawioAiDialogState,
    openAiModal,
    closeAiModal,
    openDrawioAiModal,
    closeDrawioAiModal
  };

  renderAiSettingsUi();
  renderAiDialogState();
  renderDrawioAiDialogState();
  renderAiInlineState();
  void initializeAiSettingsState();
  void ensureAiStreamListener();
}

export async function initializeAiSettingsState() {
  if (!isTauriEnvironment()) {
    app.state.aiSettingsState = {
      ...createDefaultAiSettingsState(),
      runtimeSupported: false,
      loaded: true
    };
    app.state.settingsDraftAi = { ...app.state.aiSettingsState };
    syncAiSettingsUiStateFromDraft();
    renderAiSettingsUi();
    return;
  }

  try {
    const api = app.desktopApi.getDesktopApi(["loadAiSettings"]);
    app.state.aiSettingsState = normalizeAiSettingsSnapshot(await api.loadAiSettings());
    app.state.settingsDraftAi = {
      ...app.state.aiSettingsState,
      token: "",
      clearToken: false
    };
    syncAiSettingsUiStateFromDraft();
  } catch (error) {
    console.warn("Failed to load AI settings:", error);
    app.state.aiSettingsState = {
      ...createDefaultAiSettingsState(),
      runtimeSupported: true,
      loaded: true,
      loadError: normalizeError(error)
    };
    app.state.settingsDraftAi = { ...app.state.aiSettingsState };
    syncAiSettingsUiStateFromDraft();
  }

  renderAiSettingsUi();
}

function getPreferredAiSettingsPromptFamily() {
  return isDrawioDocumentKind(app.state.currentDocument.kind) ? "drawio" : "mermaid";
}

function resolvePromptMode(systemPrompt, userPrompt, defaultSystemPrompt, defaultUserPrompt) {
  return systemPrompt === defaultSystemPrompt && userPrompt === defaultUserPrompt
    ? "default"
    : "custom";
}

function syncAiSettingsUiStateFromDraft(options = {}) {
  const preferredFamily =
    options.preserveFamily &&
    (app.state.settingsAiPromptFamily === "drawio" || app.state.settingsAiPromptFamily === "mermaid")
      ? app.state.settingsAiPromptFamily
      : getPreferredAiSettingsPromptFamily();

  app.state.settingsAiPromptFamily = preferredFamily;
  app.state.settingsAiMermaidPromptMode = resolvePromptMode(
    app.state.settingsDraftAi.systemPromptTemplate,
    app.state.settingsDraftAi.userPromptTemplate,
    defaultAiSystemPromptTemplate,
    defaultAiUserPromptTemplate
  );
  app.state.settingsAiDrawioPromptMode = resolvePromptMode(
    app.state.settingsDraftAi.drawioSystemPromptTemplate,
    app.state.settingsDraftAi.drawioUserPromptTemplate,
    defaultAiDrawioSystemPromptTemplate,
    defaultAiDrawioUserPromptTemplate
  );
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
    drawioSystemPromptTemplate:
      String(snapshot?.drawioSystemPromptTemplate ?? "").trim() ||
      defaultAiDrawioSystemPromptTemplate,
    drawioUserPromptTemplate:
      String(snapshot?.drawioUserPromptTemplate ?? "").trim() || defaultAiDrawioUserPromptTemplate,
    tokenConfigured: Boolean(snapshot?.tokenConfigured),
    runtimeSupported: snapshot?.runtimeSupported !== false,
    loaded: true,
    loadError: ""
  };
}

export async function ensureAiStreamListener() {
  if (!isTauriEnvironment()) {
    return null;
  }

  if (!app.state.aiStreamListenerPromise) {
    app.state.aiStreamListenerPromise = listenToTauriEvent(aiStreamEventName, (event) => {
      handleAiStreamChunkEvent(event?.payload);
    }).catch((error) => {
      app.state.aiStreamListenerPromise = null;
      reportAppError("ai.inline.stream.listen", error);
      return null;
    });
  }

  return app.state.aiStreamListenerPromise;
}

function handleAiStreamChunkEvent(payload) {
  const requestToken = Number(payload?.requestToken);
  const kind = payload?.kind === "thinking" ? "thinking" : "content";
  const chunk = String(payload?.chunk ?? "");

  if (!chunk || !Number.isInteger(requestToken)) {
    return;
  }

  if (
    app.state.aiInlineState.isOpen &&
    app.state.aiInlineState.isGenerating &&
    requestToken === app.state.aiInlineState.requestToken
  ) {
    if (kind === "thinking") {
      if (!app.state.aiInlineState.hasStreamedContent) {
        app.state.aiInlineState = {
          ...app.state.aiInlineState,
          thinkingText: `${app.state.aiInlineState.thinkingText}${chunk}`
        };
        renderAiInlineState();
      }
      return;
    }

    appendAiInlineContentChunk(chunk);
    return;
  }

  if (
    app.state.drawioAiDialogState.isOpen &&
    app.state.drawioAiDialogState.isGenerating &&
    requestToken === app.state.drawioAiDialogState.requestToken
  ) {
    if (kind === "thinking" && !app.state.drawioAiDialogState.hasStreamedContent) {
      app.state.drawioAiDialogState = {
        ...app.state.drawioAiDialogState,
        thinkingText: `${app.state.drawioAiDialogState.thinkingText}${chunk}`
      };
      renderDrawioAiDialogState();
      return;
    }

    if (kind !== "content") {
      return;
    }

    appendDrawioAiContentChunk(chunk);
    return;
  }
}

function appendAiInlineContentChunk(chunk) {
  if (!chunk) {
    return;
  }

  if (app.state.aiInlineState.hasStreamedContent) {
    const nextDraft = `${app.state.aiInlineState.proposalCode}${chunk}`;
    app.state.aiInlineState = {
      ...app.state.aiInlineState,
      thinkingText: ""
    };
    setActiveEditorDraft(nextDraft, { validate: false, render: false });
    return;
  }

  const combinedText = `${app.state.aiInlineState.proposalCode}${chunk}`;
  const mermaidStartIndex = findMermaidSourceStartIndex(combinedText);
  if (mermaidStartIndex < 0) {
    app.state.aiInlineState = {
      ...app.state.aiInlineState,
      proposalCode: combinedText,
      hasProposal: false,
      hasUnacceptedChanges: false,
      thinkingText: `${app.state.aiInlineState.thinkingText}${chunk}`
    };
    renderAiInlineState();
    return;
  }

  const nextDraft = combinedText.slice(mermaidStartIndex);
  app.state.aiInlineState = {
    ...app.state.aiInlineState,
    hasStreamedContent: true,
    thinkingText: ""
  };
  setActiveEditorDraft(nextDraft, { validate: false, render: false });
}

function appendDrawioAiContentChunk(chunk) {
  const nextStreamText = `${app.state.drawioAiDialogState.streamText}${chunk}`;
  app.state.drawioAiDialogState = {
    ...app.state.drawioAiDialogState,
    streamText: nextStreamText,
    thinkingText: "",
    hasStreamedContent: true
  };
  renderDrawioAiDialogState();
}

function findMermaidSourceStartIndex(value) {
  const text = String(value ?? "");
  const match = mermaidDeclarationPattern.exec(text);
  if (!match) {
    return -1;
  }

  const prefix = match[1] ?? "";
  return (match.index ?? 0) + prefix.length;
}

export function beginSettingsEdit() {
  app.state.settingsDraftAi = {
    ...app.state.aiSettingsState,
    token: "",
    clearToken: false
  };
  syncAiSettingsUiStateFromDraft();
  resetSettingsAiTestState();
  renderAiSettingsUi();
}

export async function saveSettingsDraft() {
  if (!(isTauriEnvironment() && app.state.aiSettingsState.runtimeSupported)) {
    return app.state.aiSettingsState;
  }

  app.state.settingsDraftAi = readSettingsAiDraftFromDom();
  const validatedAiSettings = validateAiSettingsDraft(app.state.settingsDraftAi);
  if (!validatedAiSettings.valid) {
    throw new Error(buildAiSettingsValidationMessage(validatedAiSettings.missing));
  }

  if (app.state.aiInlineState.isOpen && !validatedAiSettings.enabled) {
    const discarded = await rejectAiInlineWorkbench({ focusButton: false });
    if (!discarded) {
      return null;
    }
  }

  const api = app.desktopApi.getDesktopApi(["saveAiSettings"]);
  const nextSnapshot = normalizeAiSettingsSnapshot(
    await api.saveAiSettings({
      enabled: validatedAiSettings.enabled,
      baseUrl: validatedAiSettings.baseUrl,
      model: validatedAiSettings.model,
      systemPromptTemplate: validatedAiSettings.systemPromptTemplate,
      userPromptTemplate: validatedAiSettings.userPromptTemplate,
      drawioSystemPromptTemplate: validatedAiSettings.drawioSystemPromptTemplate,
      drawioUserPromptTemplate: validatedAiSettings.drawioUserPromptTemplate,
      token: validatedAiSettings.token || null,
      clearToken: validatedAiSettings.clearToken
    })
  );

  app.state.aiSettingsState = nextSnapshot;
  app.state.settingsDraftAi = {
    ...nextSnapshot,
    token: "",
    clearToken: false
  };
  syncAiSettingsUiStateFromDraft();
  renderAiSettingsUi();
  return nextSnapshot;
}

export function renderAiSettingsUi() {
  const runtimeSupported = isAiSettingsRuntimeSupported();
  renderAiActionButton();

  if (!runtimeSupported) {
    app.dom.aiButton.hidden = true;
    app.dom.drawioAiButton.hidden = true;
    return;
  }

  app.dom.settingsAiEnabled.checked = app.state.settingsDraftAi.enabled;
  app.dom.settingsAiBaseUrl.value = app.state.settingsDraftAi.baseUrl;
  app.dom.settingsAiModel.value = app.state.settingsDraftAi.model;
  renderSettingsAiTokenInput();
  app.dom.settingsAiSystemPrompt.value = app.state.settingsDraftAi.systemPromptTemplate;
  app.dom.settingsAiUserPrompt.value = app.state.settingsDraftAi.userPromptTemplate;
  app.dom.settingsAiDrawioSystemPrompt.value = app.state.settingsDraftAi.drawioSystemPromptTemplate;
  app.dom.settingsAiDrawioUserPrompt.value = app.state.settingsDraftAi.drawioUserPromptTemplate;
  app.dom.settingsAiDisabledNote.hidden = app.state.settingsDraftAi.enabled;
  app.dom.settingsAiConfig.hidden = !app.state.settingsDraftAi.enabled;
  app.dom.settingsAiPromptsSection.hidden = !app.state.settingsDraftAi.enabled;
  const promptFamily = app.state.settingsAiPromptFamily === "drawio" ? "drawio" : "mermaid";
  const mermaidPromptMode =
    app.state.settingsAiMermaidPromptMode === "custom" ? "custom" : "default";
  const drawioPromptMode =
    app.state.settingsAiDrawioPromptMode === "custom" ? "custom" : "default";
  app.dom.settingsAiPromptFamilyMermaidButton.classList.toggle(
    "settings-mode-button-active",
    promptFamily === "mermaid"
  );
  app.dom.settingsAiPromptFamilyDrawioButton.classList.toggle(
    "settings-mode-button-active",
    promptFamily === "drawio"
  );
  app.dom.settingsAiPromptMermaidPanel.hidden = promptFamily !== "mermaid";
  app.dom.settingsAiPromptDrawioPanel.hidden = promptFamily !== "drawio";
  app.dom.settingsAiMermaidPresetDefaultButton.classList.toggle(
    "settings-mode-button-active",
    mermaidPromptMode === "default"
  );
  app.dom.settingsAiMermaidPresetCustomButton.classList.toggle(
    "settings-mode-button-active",
    mermaidPromptMode === "custom"
  );
  app.dom.settingsAiMermaidCustomFields.hidden = mermaidPromptMode !== "custom";
  app.dom.settingsAiDrawioPresetDefaultButton.classList.toggle(
    "settings-mode-button-active",
    drawioPromptMode === "default"
  );
  app.dom.settingsAiDrawioPresetCustomButton.classList.toggle(
    "settings-mode-button-active",
    drawioPromptMode === "custom"
  );
  app.dom.settingsAiDrawioCustomFields.hidden = drawioPromptMode !== "custom";
  app.dom.settingsAiTokenStatus.textContent = getSettingsAiTokenStatusText();
  app.dom.settingsAiClearToken.textContent = app.state.settingsDraftAi.clearToken
    ? t("settings.ai.clearTokenUndo")
    : t("settings.ai.clearToken");
  app.dom.settingsAiTestButton.textContent = t(
    app.state.settingsAiTestState.running ? "settings.ai.testRunning" : "settings.ai.test"
  );
  app.dom.settingsAiTestButton.disabled = app.state.settingsAiTestState.running;
  app.dom.settingsAiClearToken.disabled =
    !app.state.settingsDraftAi.tokenConfigured &&
    !app.state.settingsDraftAi.token.trim() &&
    !app.state.settingsDraftAi.clearToken;
  app.dom.settingsAiTestStatus.hidden = !app.state.settingsAiTestState.message;
  app.dom.settingsAiTestStatus.dataset.tone = app.state.settingsAiTestState.tone;
  app.dom.settingsAiTestStatus.textContent = app.state.settingsAiTestState.message;
}

function getSettingsAiTokenStatusText() {
  if (app.state.settingsDraftAi.clearToken) {
    return t("settings.ai.tokenWillClear");
  }

  if (app.state.settingsDraftAi.token.trim()) {
    return t("settings.ai.tokenWillReplace");
  }

  if (app.state.settingsDraftAi.tokenConfigured) {
    return t("settings.ai.tokenSaved");
  }

  return t("settings.ai.tokenMissing");
}

function shouldDisplayMaskedSavedToken() {
  return Boolean(
    app.state.settingsDraftAi.tokenConfigured &&
      !app.state.settingsDraftAi.clearToken &&
      !app.state.settingsDraftAi.token.trim()
  );
}

function renderSettingsAiTokenInput() {
  if (app.state.settingsDraftAi.clearToken) {
    app.dom.settingsAiToken.dataset.masked = "false";
    app.dom.settingsAiToken.value = "";
    return;
  }

  if (app.state.settingsDraftAi.token.trim()) {
    app.dom.settingsAiToken.dataset.masked = "false";
    app.dom.settingsAiToken.value = app.state.settingsDraftAi.token;
    return;
  }

  if (shouldDisplayMaskedSavedToken()) {
    app.dom.settingsAiToken.dataset.masked = "true";
    app.dom.settingsAiToken.value = maskedSavedTokenValue;
    return;
  }

  app.dom.settingsAiToken.dataset.masked = "false";
  app.dom.settingsAiToken.value = "";
}

function isSettingsAiTokenMasked() {
  return app.dom.settingsAiToken.dataset.masked === "true";
}

export function shouldShowAiButton() {
  return Boolean(
    isMermaidDocumentKind(app.state.currentDocument.kind) &&
      isTauriEnvironment() &&
      app.state.aiSettingsState.runtimeSupported &&
      app.state.aiSettingsState.enabled &&
      app.state.aiSettingsState.baseUrl &&
      app.state.aiSettingsState.model &&
      app.state.aiSettingsState.tokenConfigured
  );
}

export function shouldShowDrawioAiButton() {
  return Boolean(
    isDrawioDocumentKind(app.state.currentDocument.kind) &&
      isTauriEnvironment() &&
      app.state.aiSettingsState.runtimeSupported &&
      app.state.aiSettingsState.enabled &&
      app.state.aiSettingsState.baseUrl &&
      app.state.aiSettingsState.model &&
      app.state.aiSettingsState.tokenConfigured
  );
}

function getAiActionMode() {
  return resolveAiActionMode(app.modules.editor?.getVisibleMermaidSource?.() ?? "");
}

export function renderAiActionButton() {
  app.dom.aiButton.hidden = !shouldShowAiButton();
  app.dom.aiButton.textContent = t(getAiActionMode() === "new" ? "ai.button.new" : "ai.button.modify");
  app.dom.drawioAiButton.hidden = !shouldShowDrawioAiButton();
  app.dom.drawioAiButton.textContent = t("drawio.ai.label");
  app.dom.drawioAiButton.disabled = !app.dom.drawioAiModal.hidden;
}

function isAiSettingsRuntimeSupported() {
  return Boolean(app.state.aiSettingsState.runtimeSupported && isTauriEnvironment());
}

function readSettingsAiDraftFromDom() {
  const tokenValue = isSettingsAiTokenMasked()
    ? ""
    : String(app.dom.settingsAiToken.value ?? "");
  const mermaidUsesCustomPrompt = app.state.settingsAiMermaidPromptMode === "custom";
  const drawioUsesCustomPrompt = app.state.settingsAiDrawioPromptMode === "custom";

  return {
    ...app.state.settingsDraftAi,
    enabled: Boolean(app.dom.settingsAiEnabled.checked),
    baseUrl: normalizeAiBaseUrl(app.dom.settingsAiBaseUrl.value),
    model: String(app.dom.settingsAiModel.value ?? "").trim(),
    systemPromptTemplate: mermaidUsesCustomPrompt
      ? String(app.dom.settingsAiSystemPrompt.value ?? "").trim() || defaultAiSystemPromptTemplate
      : defaultAiSystemPromptTemplate,
    userPromptTemplate: mermaidUsesCustomPrompt
      ? String(app.dom.settingsAiUserPrompt.value ?? "").trim() || defaultAiUserPromptTemplate
      : defaultAiUserPromptTemplate,
    drawioSystemPromptTemplate: drawioUsesCustomPrompt
      ? String(app.dom.settingsAiDrawioSystemPrompt.value ?? "").trim() ||
        defaultAiDrawioSystemPromptTemplate
      : defaultAiDrawioSystemPromptTemplate,
    drawioUserPromptTemplate: drawioUsesCustomPrompt
      ? String(app.dom.settingsAiDrawioUserPrompt.value ?? "").trim() ||
        defaultAiDrawioUserPromptTemplate
      : defaultAiDrawioUserPromptTemplate,
    token: tokenValue,
    runtimeSupported: app.state.aiSettingsState.runtimeSupported
  };
}

function setAiSettingsPromptFamily(family) {
  app.state.settingsAiPromptFamily = family === "drawio" ? "drawio" : "mermaid";
  renderAiSettingsUi();
}

function setAiSettingsPromptMode(family, mode) {
  const nextMode = mode === "custom" ? "custom" : "default";
  const nextDraft = readSettingsAiDraftFromDom();

  if (family === "drawio") {
    app.state.settingsAiDrawioPromptMode = nextMode;
    app.state.settingsAiPromptFamily = "drawio";
    app.state.settingsDraftAi = {
      ...nextDraft,
      drawioSystemPromptTemplate:
        nextMode === "custom"
          ? nextDraft.drawioSystemPromptTemplate || defaultAiDrawioSystemPromptTemplate
          : defaultAiDrawioSystemPromptTemplate,
      drawioUserPromptTemplate:
        nextMode === "custom"
          ? nextDraft.drawioUserPromptTemplate || defaultAiDrawioUserPromptTemplate
          : defaultAiDrawioUserPromptTemplate
    };
  } else {
    app.state.settingsAiMermaidPromptMode = nextMode;
    app.state.settingsAiPromptFamily = "mermaid";
    app.state.settingsDraftAi = {
      ...nextDraft,
      systemPromptTemplate:
        nextMode === "custom"
          ? nextDraft.systemPromptTemplate || defaultAiSystemPromptTemplate
          : defaultAiSystemPromptTemplate,
      userPromptTemplate:
        nextMode === "custom"
          ? nextDraft.userPromptTemplate || defaultAiUserPromptTemplate
          : defaultAiUserPromptTemplate
    };
  }

  resetSettingsAiTestState();
  renderAiSettingsUi();
}

function toggleSettingsAiClearToken() {
  app.state.settingsDraftAi = {
    ...readSettingsAiDraftFromDom(),
    clearToken: !app.state.settingsDraftAi.clearToken
  };
  resetSettingsAiTestState();

  if (app.state.settingsDraftAi.clearToken) {
    app.state.settingsDraftAi.token = "";
    app.dom.settingsAiToken.value = "";
  }

  renderAiSettingsUi();
}

function handleSettingsAiDraftInput(event) {
  if (
    event?.target === app.dom.settingsAiSystemPrompt ||
    event?.target === app.dom.settingsAiUserPrompt
  ) {
    app.state.settingsAiMermaidPromptMode = "custom";
  }

  if (
    event?.target === app.dom.settingsAiDrawioSystemPrompt ||
    event?.target === app.dom.settingsAiDrawioUserPrompt
  ) {
    app.state.settingsAiDrawioPromptMode = "custom";
  }

  app.state.settingsDraftAi = {
    ...readSettingsAiDraftFromDom(),
    clearToken:
      app.state.settingsDraftAi.clearToken && app.state.settingsDraftAi.tokenConfigured
  };
  resetSettingsAiTestState();
  renderAiSettingsUi();
}

function handleSettingsAiTokenInput() {
  app.state.settingsDraftAi = {
    ...readSettingsAiDraftFromDom(),
    clearToken: false
  };
  app.dom.settingsAiToken.dataset.masked = "false";
  resetSettingsAiTestState();
  renderAiSettingsUi();
}

function handleSettingsAiTokenFocus() {
  if (!isSettingsAiTokenMasked()) {
    return;
  }

  app.dom.settingsAiToken.value = "";
  app.dom.settingsAiToken.dataset.masked = "false";
}

function handleSettingsAiTokenBlur() {
  if (app.dom.settingsAiToken.value.trim() || app.state.settingsDraftAi.clearToken) {
    return;
  }

  if (shouldDisplayMaskedSavedToken()) {
    app.dom.settingsAiToken.dataset.masked = "true";
    app.dom.settingsAiToken.value = maskedSavedTokenValue;
  }
}

function resetSettingsAiTestState() {
  app.state.settingsAiTestState = {
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
  return (
    isMermaidDocumentKind(app.state.currentDocument.kind) &&
    hasMeaningfulDiagram(app.modules.editor?.getVisibleMermaidSource?.() ?? "", sampleCode)
  );
}

function parseDrawioXmlDocument(source) {
  const xml = String(source ?? "").trim();
  if (!xml || typeof DOMParser !== "function") {
    return null;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) {
    return null;
  }

  return document;
}

function isMeaningfulDrawioDiagram(source) {
  const xml = String(source ?? "").trim();
  if (!xml) {
    return false;
  }

  const document = parseDrawioXmlDocument(xml);
  if (!document) {
    return true;
  }

  const root = document.documentElement;
  if (!root || root.tagName !== "mxfile") {
    return true;
  }

  const diagrams = Array.from(root.getElementsByTagName("diagram"));
  if (!diagrams.length) {
    return false;
  }

  return diagrams.some((diagram) => hasDrawableDrawioCells(diagram));
}

function hasDrawableDrawioCells(diagramElement) {
  const graphModel = diagramElement.getElementsByTagName("mxGraphModel")[0];
  const modelRoot = graphModel?.getElementsByTagName("root")[0];
  if (!modelRoot) {
    return true;
  }

  const cells = Array.from(modelRoot.querySelectorAll("mxCell"));
  return cells.some((cell) => {
    const id = cell.getAttribute("id");
    if (id === "0" || id === "1") {
      return false;
    }

    const isVertex = cell.getAttribute("vertex") === "1";
    const isEdge = cell.getAttribute("edge") === "1";
    const geometry = cell.querySelector("mxGeometry");
    const hasSize =
      Number.parseFloat(geometry?.getAttribute("width") ?? "0") > 0 ||
      Number.parseFloat(geometry?.getAttribute("height") ?? "0") > 0;

    return isEdge || isVertex || hasSize;
  });
}

async function getCurrentDrawioXmlForAi() {
  if (!isDrawioDocumentKind(app.state.currentDocument.kind)) {
    return "";
  }

  const xml = await app.modules.editor?.getCurrentDrawioXml?.();
  return sanitizeAiDrawioXml(xml);
}

async function getDrawioAiActionMode() {
  return isMeaningfulDrawioDiagram(await getCurrentDrawioXmlForAi()) ? "modify" : "new";
}

function syncTextareaValue(element, value) {
  if (element.value !== value) {
    element.value = value;
  }
}

function isAiInlineDraftDirty() {
  return Boolean(
    app.state.aiInlineState.isOpen &&
      (app.state.aiInlineState.isGenerating ||
        app.state.aiInlineState.hasUnacceptedChanges ||
        (app.state.aiInlineState.mode === "new" && app.state.aiInlineState.hasProposal) ||
        app.state.aiInlineState.prompt.trim())
  );
}

export async function rejectAiInlineWorkbench(options = {}) {
  if (!app.state.aiInlineState.isOpen) {
    return true;
  }

  if (options.confirm !== false && isAiInlineDraftDirty()) {
    const shouldDiscard = window.confirm(t("ai.inline.discardConfirm"));
    if (!shouldDiscard) {
      return false;
    }
  }

  window.clearTimeout(app.state.timers.aiInlineValidation);
  const restoredSource = app.state.aiInlineState.sourceCode;
  app.state.aiInlineState = createDefaultAiInlineState();
  app.modules.editor?.setEditorValue?.(restoredSource, { silent: true });
  app.modules.preview?.clearPreviewSourceSelection?.({ render: false });
  app.modules.editor?.updateCursorStatus?.();
  renderAiInlineState();
  app.modules.editor?.renderHighlightedCode?.();
  renderAiActionButton();
  app.modules.preview?.scheduleRender?.();

  if (options.focusButton !== false && !app.dom.aiButton.hidden) {
    queueMicrotask(() => {
      app.dom.aiButton.focus({ preventScroll: true });
    });
  }

  return true;
}

function syncAiInlineDraftState(nextDraft) {
  const proposalCode = String(nextDraft ?? "");
  app.state.aiInlineState = {
    ...app.state.aiInlineState,
    proposalCode,
    hasProposal: Boolean(proposalCode.trim()),
    hasUnacceptedChanges: proposalCode !== app.state.aiInlineState.sourceCode,
    error: ""
  };
}

function setActiveEditorDraft(nextDraft, options = {}) {
  const draft = String(nextDraft ?? "");
  app.modules.editor?.setEditorValue?.(draft, { silent: true });

  if (app.state.aiInlineState.isOpen) {
    syncAiInlineDraftState(draft);
  }

  app.modules.preview?.clearPreviewSourceSelection?.({ render: false });
  app.modules.editor?.updateCursorStatus?.();
  app.modules.editor?.renderHighlightedCode?.();
  renderAiActionButton();

  if (app.state.aiInlineState.isOpen) {
    renderAiInlineState();
    if (options.validate !== false) {
      scheduleAiInlineValidation();
    }
  } else {
    app.modules.editor?.replaceEditorCode?.(draft);
  }

  if (options.render !== false) {
    app.modules.preview?.scheduleRender?.();
  }
}

function openAiInlineWorkbench() {
  if (!shouldShowAiButton()) {
    updateStatus("error", t("status.settingsErrorBadge"), t("ai.error.settingsIncomplete"));
    return;
  }

  app.modules.workspace?.closeWorkspaceContextMenu?.();
  app.modules.export?.setExportMenuOpen?.(false);
  if (!app.dom.settingsModal.hidden) {
    app.modules.settings?.closeSettingsModal?.();
  }

  const mode = getAiActionMode();
  const sourceCode = app.modules.editor?.getActiveEditorSource?.() ?? "";
  app.state.aiInlineState = {
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
  app.modules.editor?.renderHighlightedCode?.();
  app.modules.preview?.scheduleRender?.();
  queueMicrotask(() => {
    app.dom.aiInlinePromptInput.focus({ preventScroll: true });
  });
}

async function acceptAiInlineWorkbench() {
  const acceptedCode = app.modules.editor?.getActiveEditorSource?.() ?? "";
  const canAccept =
    app.state.aiInlineState.isOpen &&
    app.state.aiInlineState.hasProposal &&
    (app.state.aiInlineState.mode === "new" || app.state.aiInlineState.hasUnacceptedChanges);

  if (!canAccept) {
    updateStatus("error", t("status.errorBadge"), t("ai.error.applyUnavailable"));
    return;
  }

  app.state.aiInlineState = createDefaultAiInlineState();
  renderAiInlineState();
  app.modules.editor?.replaceEditorCode?.(acceptedCode);
  updateStatusByKey("success", "status.savedBadge", "ai.status.appliedMessage");
}

function handleAiInlinePromptInput() {
  app.state.aiInlineState = {
    ...app.state.aiInlineState,
    prompt: app.dom.aiInlinePromptInput.value
  };
}

export function handleAiInlineEditorInput() {
  if (!app.state.aiInlineState.isOpen) {
    return;
  }

  syncAiInlineDraftState(app.modules.editor?.getActiveEditorSource?.() ?? "");
  renderAiInlineState();
  app.modules.editor?.renderHighlightedCode?.();
  renderAiActionButton();
  scheduleAiInlineValidation();
  app.modules.preview?.scheduleRender?.();
}

function scheduleAiInlineValidation() {
  const validationToken = ++app.state.aiInlineValidationSequence;
  window.clearTimeout(app.state.timers.aiInlineValidation);
  app.state.timers.aiInlineValidation = window.setTimeout(async () => {
    if (!app.state.aiInlineState.isOpen) {
      return;
    }

    const proposalCode = app.modules.editor?.getActiveEditorSource?.() ?? "";
    if (!proposalCode.trim()) {
      app.state.aiInlineState = {
        ...app.state.aiInlineState,
        isValid: false,
        hasProposal: false,
        error: "",
        statusKey: "ai.status.idle",
        statusMessageKey: "ai.status.idleMessage"
      };
      renderAiInlineState();
      return;
    }

    const validation = await validateMermaidSource(proposalCode, app.state.currentMermaidConfig);
    if (
      validationToken !== app.state.aiInlineValidationSequence ||
      !app.state.aiInlineState.isOpen
    ) {
      return;
    }

    app.state.aiInlineState = {
      ...app.state.aiInlineState,
      proposalCode,
      isValid: validation.valid,
      error: validation.valid ? "" : validation.message,
      statusKey: validation.valid ? "ai.status.valid" : "ai.status.invalid",
      statusMessageKey: validation.valid
        ? "ai.status.validMessage"
        : "ai.status.invalidMessage"
    };
    renderAiInlineState();
  }, 180);
}

export function renderAiInlineState() {
  const collapsed = Boolean(
    app.state.aiInlineState.isOpen && app.state.aiInlineState.panelCollapsed
  );
  const canAccept = Boolean(
    app.state.aiInlineState.hasProposal &&
      (app.state.aiInlineState.mode === "new" ||
        app.state.aiInlineState.hasUnacceptedChanges)
  );
  const showThinking = Boolean(
    app.state.aiInlineState.isGenerating &&
      app.state.aiInlineState.thinkingText.trim() &&
      !app.state.aiInlineState.hasStreamedContent
  );

  const codeEditor = app.modules.editor?.getCodeEditor?.();
  app.dom.aiInlinePanel.hidden = !app.state.aiInlineState.isOpen;
  app.dom.aiInlinePanel.classList.toggle("ai-inline-panel-collapsed", collapsed);
  app.dom.aiInlinePanel.classList.toggle("ai-inline-panel-has-thinking", showThinking);
  app.dom.aiButton.disabled = app.state.aiInlineState.isOpen;
  codeEditor?.setEditable(!app.state.aiInlineState.isGenerating);
  app.dom.editorDocumentName.disabled =
    app.state.aiInlineState.isOpen || !app.state.currentDocument.path;
  app.dom.codeEditorShell.classList.toggle(
    "code-editor-shell-ai-session",
    app.state.aiInlineState.isOpen
  );
  app.dom.codeEditorShell.classList.toggle(
    "code-editor-shell-ai-session-collapsed",
    collapsed
  );

  if (!app.state.aiInlineState.isOpen) {
    codeEditor?.setEditable(true);
    app.dom.codeEditorShell.classList.remove(
      "code-editor-shell-ai-session",
      "code-editor-shell-ai-session-collapsed"
    );
    return;
  }

  syncTextareaValue(app.dom.aiInlinePromptInput, app.state.aiInlineState.prompt);
  app.dom.aiInlineTitle.textContent = t(
    app.state.aiInlineState.mode === "new"
      ? "ai.inline.title.new"
      : "ai.inline.title.modify"
  );
  app.dom.aiInlineModePill.textContent = t(
    app.state.aiInlineState.mode === "new" ? "ai.inline.mode.new" : "ai.inline.mode.modify"
  );
  app.dom.aiInlineGenerateButton.textContent = t(
    app.state.aiInlineState.model ? "ai.regenerate" : "ai.generate"
  );
  app.dom.aiInlineGenerateButton.disabled = app.state.aiInlineState.isGenerating;
  app.dom.aiInlineStatusChip.className = `status status-${
    app.state.aiInlineState.error
      ? "error"
      : app.state.aiInlineState.isGenerating
        ? "rendering"
        : app.state.aiInlineState.isValid
          ? "success"
          : "idle"
  }`;
  app.dom.aiInlineStatusChip.textContent = t(app.state.aiInlineState.statusKey);
  app.dom.aiInlineStatusText.textContent =
    app.state.aiInlineState.error || t(app.state.aiInlineState.statusMessageKey);
  app.dom.aiInlineError.hidden = collapsed || !app.state.aiInlineState.error;
  app.dom.aiInlineError.textContent = app.state.aiInlineState.error;
  app.dom.aiInlineThinkingPanel.hidden = !showThinking;
  app.dom.aiInlineThinkingText.textContent = app.state.aiInlineState.thinkingText.trim();
  if (showThinking) {
    app.dom.aiInlineThinkingText.scrollTop = app.dom.aiInlineThinkingText.scrollHeight;
  }
  app.dom.aiInlineFooter.hidden = collapsed ? app.state.aiInlineState.isGenerating : false;
  app.dom.aiInlineAdjustButton.hidden =
    !collapsed || app.state.aiInlineState.isGenerating;
  app.dom.aiInlineRejectButton.hidden =
    collapsed ? app.state.aiInlineState.isGenerating : false;
  app.dom.aiInlineAcceptButton.hidden =
    !collapsed || app.state.aiInlineState.isGenerating || !canAccept;
  app.dom.aiInlineAcceptButton.disabled = !canAccept;
}

function reopenAiInlinePrompt() {
  if (!app.state.aiInlineState.isOpen || app.state.aiInlineState.isGenerating) {
    return;
  }

  app.state.aiInlineState = {
    ...app.state.aiInlineState,
    panelCollapsed: false
  };
  renderAiInlineState();
  queueMicrotask(() => {
    app.dom.aiInlinePromptInput.focus({ preventScroll: true });
  });
}

async function requestAiInlineDraft(api, payload, requestToken) {
  app.state.aiInlineState = {
    ...app.state.aiInlineState,
    proposalCode: "",
    hasProposal: false,
    hasUnacceptedChanges: false,
    thinkingText: "",
    hasStreamedContent: false
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

  const prompt = app.dom.aiInlinePromptInput.value.trim();
  if (!prompt) {
    app.state.aiInlineState = {
      ...app.state.aiInlineState,
      error: t("ai.error.emptyPrompt"),
      statusKey: "ai.status.invalid",
      statusMessageKey: "ai.status.invalidMessage"
    };
    renderAiInlineState();
    return;
  }

  const requestToken = ++app.state.aiRequestSequence;
  app.state.aiInlineState = {
    ...app.state.aiInlineState,
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
    const api = app.desktopApi.getDesktopApi(["generateAiMermaidStream"]);
    const currentCode =
      app.state.aiInlineState.mode === "modify"
        ? app.modules.editor?.getActiveEditorSource?.() ?? ""
        : "";
    const firstPayload = buildAiRequestPayload({
      prompt,
      mode: app.state.aiInlineState.mode === "modify" ? "merge" : "new",
      currentCode,
      requestToken
    });
    let result = await requestAiInlineDraft(api, firstPayload, requestToken);
    let nextCode = sanitizeAiMermaidText(result.mermaidText);
    let validation = await validateMermaidSource(nextCode, app.state.currentMermaidConfig);
    let repaired = false;

    if (!validation.valid) {
      app.state.aiInlineState = {
        ...app.state.aiInlineState,
        isGenerating: true,
        statusKey: "ai.status.repairing",
        statusMessageKey: "ai.status.repairingMessage",
        requestToken
      };
      renderAiInlineState();

      const repairPayload = buildAiRequestPayload({
        prompt,
        mode: app.state.aiInlineState.mode === "modify" ? "merge" : "new",
        currentCode,
        previousCode: nextCode,
        validationError: validation.message,
        requestToken
      });
      result = await requestAiInlineDraft(api, repairPayload, requestToken);
      nextCode = sanitizeAiMermaidText(result.mermaidText);
      validation = await validateMermaidSource(nextCode, app.state.currentMermaidConfig);
      repaired = true;
    }

    if (requestToken !== app.state.aiInlineState.requestToken) {
      return;
    }

    const sourceCode = app.state.aiInlineState.sourceCode;
    app.state.aiInlineState = {
      ...app.state.aiInlineState,
      prompt,
      isGenerating: false,
      panelCollapsed: true,
      repaired,
      proposalCode: nextCode,
      hasProposal: Boolean(nextCode.trim()),
      isValid: validation.valid,
      thinkingText: "",
      hasStreamedContent: Boolean(nextCode.trim()),
      model: result.model,
      error: validation.valid ? "" : validation.message,
      diff: buildLineDiffSummary(sourceCode, nextCode),
      hasUnacceptedChanges: nextCode !== sourceCode,
      statusKey: validation.valid ? "ai.status.valid" : "ai.status.invalid",
      statusMessageKey: validation.valid
        ? "ai.status.validMessage"
        : "ai.status.invalidMessage"
    };
    setActiveEditorDraft(nextCode, { validate: false });
    renderAiInlineState();
    app.modules.editor?.updateCursorStatus?.();
    app.modules.editor?.renderHighlightedCode?.();
    app.modules.preview?.scheduleRender?.();
    queueMicrotask(() => {
      app.modules.editor?.focusEditor?.({ preventScroll: true });
    });
  } catch (error) {
    reportAppError("ai.inline.generate", error);
    if (requestToken !== app.state.aiInlineState.requestToken) {
      return;
    }

    app.state.aiInlineState = {
      ...app.state.aiInlineState,
      isGenerating: false,
      thinkingText: "",
      panelCollapsed: true,
      error: normalizeError(error),
      statusKey: "ai.status.invalid",
      statusMessageKey: "ai.status.invalidMessage"
    };
    renderAiInlineState();
    updateStatus("error", t("status.errorBadge"), normalizeError(error));
  }
}

export async function openDrawioAiModal() {
  if (!shouldShowDrawioAiButton()) {
    updateStatus("error", t("status.settingsErrorBadge"), t("drawio.ai.error.settingsIncomplete"));
    return;
  }

  window.clearTimeout(app.state.timers.drawioAiModalClose);
  app.modules.workspace?.closeWorkspaceContextMenu?.();
  app.modules.export?.setExportMenuOpen?.(false);
  if (!app.dom.settingsModal.hidden) {
    app.modules.settings?.closeSettingsModal?.();
  }

  let mode = "new";
  try {
    mode = await getDrawioAiActionMode();
  } catch (error) {
    reportAppError("drawio.ai.resolve_mode", error);
    updateStatus("error", t("status.errorBadge"), normalizeError(error));
    return;
  }

  app.state.drawioAiDialogState = {
    ...createDefaultDrawioAiDialogState(),
    isOpen: true,
    mode
  };
  app.dom.drawioAiPromptInput.value = "";
  app.dom.drawioAiModal.hidden = false;
  renderDrawioAiDialogState();
  queueMicrotask(() => {
    app.dom.drawioAiPromptInput.focus({ preventScroll: true });
  });
}

async function revertDrawioAiPreviewIfNeeded() {
  if (!app.state.drawioAiDialogState.hasPreviewApplied) {
    return;
  }

  const originalXml = app.state.drawioAiDialogState.originalXml;
  if (!originalXml) {
    return;
  }

  const drawioEditor = app.modules.editor?.ensureDrawioEditor?.();
  if (!drawioEditor) {
    return;
  }

  const title = getCurrentDocumentTitle();
  await drawioEditor.replaceXml({ xml: originalXml, title });
  await drawioEditor.stageXmlForSave(originalXml, "ai-cancel-revert");
}

function resetAndHideDrawioAiPanel() {
  app.state.drawioAiDialogState = createDefaultDrawioAiDialogState();
  app.dom.drawioAiModal.hidden = true;
  renderDrawioAiDialogState();
  renderAiActionButton();
}

export async function closeDrawioAiModal() {
  const shouldRevert = app.state.drawioAiDialogState.hasPreviewApplied;
  const shouldBumpToken = app.state.drawioAiDialogState.isGenerating;
  const nextRequestToken = shouldBumpToken ? ++app.state.aiRequestSequence : 0;

  try {
    if (shouldRevert) {
      await revertDrawioAiPreviewIfNeeded();
    }
  } catch (error) {
    reportAppError("drawio.ai.revert", error);
    updateStatus("error", t("status.errorBadge"), normalizeError(error));
    return;
  }

  if (shouldBumpToken) {
    app.state.drawioAiDialogState = {
      ...app.state.drawioAiDialogState,
      requestToken: nextRequestToken
    };
  }

  resetAndHideDrawioAiPanel();
  if (!app.dom.drawioAiButton.hidden) {
    app.dom.drawioAiButton.focus({ preventScroll: true });
  }
}

export function renderDrawioAiDialogState() {
  app.dom.drawioAiModal.hidden = !app.state.drawioAiDialogState.isOpen;
  const phase = app.state.drawioAiDialogState.isGenerating
    ? "generating"
    : app.state.drawioAiDialogState.hasPreviewApplied
      ? "confirm"
      : "fill";
  const mode = app.state.drawioAiDialogState.mode === "modify" ? "modify" : "new";
  const valid = app.state.drawioAiDialogState.isValid;
  const generating = app.state.drawioAiDialogState.isGenerating;
  const error = app.state.drawioAiDialogState.error;
  const showThinking = Boolean(
    generating &&
      app.state.drawioAiDialogState.thinkingText.trim() &&
      !app.state.drawioAiDialogState.hasStreamedContent
  );
  const showProgress = Boolean(generating && app.state.drawioAiDialogState.hasStreamedContent);

  app.dom.drawioAiButton.disabled = app.state.drawioAiDialogState.isOpen;
  app.dom.drawioAiCloseButton.disabled = generating;
  app.dom.drawioAiModePill.textContent = t(
    mode === "modify" ? "drawio.ai.mode.modify" : "drawio.ai.mode.new"
  );
  app.dom.drawioAiContextNote.textContent = t(
    mode === "modify" ? "drawio.ai.context.merge" : "drawio.ai.context.new"
  );
  app.dom.drawioAiGenerateButton.disabled = generating;
  app.dom.drawioAiGenerateButton.textContent = t("ai.generate");
  app.dom.drawioAiStatusChip.className = `status status-${
    error ? "error" : generating ? "rendering" : valid ? "success" : "idle"
  }`;
  app.dom.drawioAiStatusChip.textContent = t(app.state.drawioAiDialogState.statusKey);
  app.dom.drawioAiStatusText.textContent = error || t(app.state.drawioAiDialogState.statusMessageKey);
  app.dom.drawioAiFillSection.hidden = phase !== "fill";
  app.dom.drawioAiGeneratingSection.hidden = phase !== "generating";
  app.dom.drawioAiResultSection.hidden = phase !== "confirm";
  app.dom.drawioAiThinkingPanel.hidden = !showThinking;
  app.dom.drawioAiThinkingText.textContent = app.state.drawioAiDialogState.thinkingText.trim();
  if (showThinking) {
    app.dom.drawioAiThinkingText.scrollTop = app.dom.drawioAiThinkingText.scrollHeight;
  }
  app.dom.drawioAiProgressPanel.hidden = !showProgress;
  app.dom.drawioAiGeneratingStatusChip.className = `status status-${
    generating ? "rendering" : "idle"
  }`;
  app.dom.drawioAiGeneratingStatusChip.textContent = t(app.state.drawioAiDialogState.statusKey);
  app.dom.drawioAiGeneratingStatusText.textContent = showProgress
    ? t("drawio.ai.status.drawingMessage")
    : error || t(app.state.drawioAiDialogState.statusMessageKey);
  app.dom.drawioAiModelPill.textContent =
    app.state.drawioAiDialogState.model || t("drawio.ai.result.model");
  app.dom.drawioAiResultSummary.textContent = t(
    phase === "confirm"
      ? "drawio.ai.result.previewSummary"
      : valid
        ? app.state.drawioAiDialogState.repaired
          ? "drawio.ai.result.repairedSummary"
          : "drawio.ai.result.validSummary"
        : "drawio.ai.result.invalidSummary"
  );
  app.dom.drawioAiErrorMessage.hidden = !error;
  app.dom.drawioAiErrorMessage.textContent = error;
  app.dom.drawioAiCancelButton.hidden = phase === "generating";
  app.dom.drawioAiApplyButton.hidden = phase !== "confirm";
  app.dom.drawioAiApplyButton.disabled = !(
    app.state.drawioAiDialogState.hasPreviewApplied &&
    app.state.drawioAiDialogState.isValid &&
    app.state.drawioAiDialogState.resultXml
  );
}

export function openAiModal() {
  if (!shouldShowAiButton()) {
    updateStatus("error", t("status.settingsErrorBadge"), t("ai.error.settingsIncomplete"));
    return;
  }

  window.clearTimeout(app.state.timers.aiModalClose);
  app.modules.workspace?.closeWorkspaceContextMenu?.();
  app.modules.export?.setExportMenuOpen?.(false);
  if (!app.dom.settingsModal.hidden) {
    app.modules.settings?.closeSettingsModal?.();
  }

  app.state.aiDialogState = {
    ...createDefaultAiDialogState(),
    mode: hasAiMergeSource() ? "merge" : "new"
  };
  app.dom.aiPromptInput.value = "";
  app.dom.aiModal.hidden = false;
  app.dom.aiModal.classList.remove("modal-animate-in");
  requestAnimationFrame(() => {
    app.dom.aiModal.classList.add("modal-animate-in");
  });
  renderAiDialogState();
  queueMicrotask(() => {
    app.dom.aiPromptInput.focus({ preventScroll: true });
  });
}

export function closeAiModal() {
  app.state.aiDialogState = {
    ...app.state.aiDialogState,
    requestToken: ++app.state.aiRequestSequence
  };
  app.dom.aiModal.classList.remove("modal-animate-in");
  window.clearTimeout(app.state.timers.aiModalClose);
  app.state.timers.aiModalClose = window.setTimeout(() => {
    app.dom.aiModal.hidden = true;
    if (!app.dom.aiButton.hidden) {
      app.dom.aiButton.focus({ preventScroll: true });
    }
  }, 160);
}

function setAiDialogMode(mode) {
  const nextMode = mode === "merge" && hasAiMergeSource() ? "merge" : "new";
  app.state.aiDialogState = {
    ...createDefaultAiDialogState(),
    mode: nextMode
  };
  renderAiDialogState();
}

export function renderAiDialogState() {
  const mergeAvailable = hasAiMergeSource();
  app.dom.aiModeMergeButton.disabled = !mergeAvailable;
  app.dom.aiModeNewButton.classList.toggle(
    "settings-mode-button-active",
    app.state.aiDialogState.mode === "new"
  );
  app.dom.aiModeMergeButton.classList.toggle(
    "settings-mode-button-active",
    app.state.aiDialogState.mode === "merge"
  );
  app.dom.aiContextNote.textContent = t(
    app.state.aiDialogState.mode === "merge" ? "ai.context.merge" : "ai.context.new"
  );
  app.dom.aiGenerateButton.disabled = app.state.aiDialogState.isGenerating;
  app.dom.aiGenerateButton.textContent = t(
    app.state.aiDialogState.hasResult ? "ai.regenerate" : "ai.generate"
  );
  app.dom.aiStatusChip.className = `status status-${
    app.state.aiDialogState.error
      ? "error"
      : app.state.aiDialogState.isGenerating
        ? "rendering"
        : app.state.aiDialogState.isValid
          ? "success"
          : "idle"
  }`;
  app.dom.aiStatusChip.textContent = t(app.state.aiDialogState.statusKey);
  app.dom.aiStatusText.textContent = t(app.state.aiDialogState.statusMessageKey);
  app.dom.aiResultSection.hidden = !app.state.aiDialogState.hasResult;
  app.dom.aiResultCode.textContent = app.state.aiDialogState.resultCode;
  app.dom.aiModelPill.textContent = app.state.aiDialogState.model || t("ai.result.model");
  app.dom.aiResultSummary.textContent = t(
    app.state.aiDialogState.isValid
      ? app.state.aiDialogState.repaired
        ? "ai.result.repairedSummary"
        : "ai.result.validSummary"
      : "ai.result.invalidSummary"
  );
  app.dom.aiDiffPanel.hidden =
    !(app.state.aiDialogState.mode === "merge" && app.state.aiDialogState.hasResult);
  app.dom.aiDiffBefore.textContent =
    app.state.aiDialogState.diff.removedBlock || t("ai.diff.none");
  app.dom.aiDiffAfter.textContent =
    app.state.aiDialogState.diff.addedBlock || t("ai.diff.none");
  app.dom.aiDiffSummary.textContent = app.state.aiDialogState.diff.hasChanges
    ? t("ai.diff.summary", {
        added: app.state.aiDialogState.diff.addedCount,
        removed: app.state.aiDialogState.diff.removedCount
      })
    : t("ai.diff.none");
  app.dom.aiErrorMessage.hidden = !app.state.aiDialogState.error;
  app.dom.aiErrorMessage.textContent = app.state.aiDialogState.error;
  app.dom.aiCopyButton.disabled = !app.state.aiDialogState.hasResult;
  app.dom.aiApplyButton.disabled = !(
    app.state.aiDialogState.hasResult && app.state.aiDialogState.isValid
  );
}

async function generateAiMermaidCode() {
  if (!shouldShowAiButton()) {
    app.state.aiDialogState = {
      ...app.state.aiDialogState,
      error: t("ai.error.settingsIncomplete"),
      statusKey: "ai.status.invalid",
      statusMessageKey: "ai.status.invalidMessage"
    };
    renderAiDialogState();
    return;
  }

  const prompt = app.dom.aiPromptInput.value.trim();
  if (!prompt) {
    app.state.aiDialogState = {
      ...app.state.aiDialogState,
      error: t("ai.error.emptyPrompt"),
      statusKey: "ai.status.invalid",
      statusMessageKey: "ai.status.invalidMessage"
    };
    renderAiDialogState();
    return;
  }

  if (app.state.aiDialogState.mode === "merge" && !hasAiMergeSource()) {
    app.state.aiDialogState = {
      ...app.state.aiDialogState,
      error: t("ai.error.mergeUnavailable"),
      statusKey: "ai.status.invalid",
      statusMessageKey: "ai.status.invalidMessage"
    };
    renderAiDialogState();
    return;
  }

  const nextMode = app.state.aiDialogState.mode;
  const requestToken = ++app.state.aiRequestSequence;
  app.state.aiDialogState = {
    ...createDefaultAiDialogState(),
    mode: nextMode,
    isGenerating: true,
    statusKey: "ai.status.generating",
    statusMessageKey: "ai.status.generatingMessage",
    requestToken
  };
  renderAiDialogState();

  try {
    const api = app.desktopApi.getDesktopApi(["generateAiMermaid"]);
    const currentCode =
      nextMode === "merge" ? app.modules.editor?.getActiveEditorSource?.() ?? "" : "";
    const firstPayload = buildAiRequestPayload({
      prompt,
      mode: nextMode,
      currentCode
    });
    let result = await api.generateAiMermaid(firstPayload);
    let nextCode = sanitizeAiMermaidText(result.mermaidText);
    let validation = await validateMermaidSource(nextCode, app.state.currentMermaidConfig);
    let repaired = false;

    if (!validation.valid) {
      app.state.aiDialogState = {
        ...app.state.aiDialogState,
        isGenerating: true,
        statusKey: "ai.status.repairing",
        statusMessageKey: "ai.status.repairingMessage",
        requestToken
      };
      renderAiDialogState();

      const repairPayload = buildAiRequestPayload({
        prompt,
        mode: nextMode,
        currentCode,
        previousCode: nextCode,
        validationError: validation.message
      });
      result = await api.generateAiMermaid(repairPayload);
      nextCode = sanitizeAiMermaidText(result.mermaidText);
      validation = await validateMermaidSource(nextCode, app.state.currentMermaidConfig);
      repaired = true;
    }

    if (requestToken !== app.state.aiDialogState.requestToken) {
      return;
    }

    app.state.aiDialogState = {
      ...app.state.aiDialogState,
      isGenerating: false,
      repaired,
      hasResult: true,
      isValid: validation.valid,
      resultCode: nextCode,
      model: result.model,
      error: validation.valid ? "" : validation.message,
      diff: buildLineDiffSummary(currentCode, nextCode),
      statusKey: validation.valid ? "ai.status.valid" : "ai.status.invalid",
      statusMessageKey: validation.valid
        ? "ai.status.validMessage"
        : "ai.status.invalidMessage"
    };
    renderAiDialogState();

    if (validation.valid) {
      updateStatusByKey("success", "status.renderedBadge", "ai.status.validMessage");
    } else {
      updateStatus("error", t("status.errorBadge"), validation.message);
    }
  } catch (error) {
    reportAppError("ai.generate", error);
    if (requestToken !== app.state.aiDialogState.requestToken) {
      return;
    }

    app.state.aiDialogState = {
      ...app.state.aiDialogState,
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
  if (!app.state.aiDialogState.hasResult || !app.state.aiDialogState.resultCode) {
    updateStatus("error", t("status.clipboardErrorBadge"), t("ai.error.copyUnavailable"));
    return;
  }

  try {
    await navigator.clipboard.writeText(app.state.aiDialogState.resultCode);
    updateStatusByKey("success", "status.copiedBadge", "status.codeCopied");
  } catch (error) {
    updateStatus("error", t("status.clipboardErrorBadge"), normalizeError(error));
  }
}

async function applyAiResultToEditor() {
  if (
    !(app.state.aiDialogState.hasResult &&
      app.state.aiDialogState.isValid &&
      app.state.aiDialogState.resultCode)
  ) {
    updateStatus("error", t("status.errorBadge"), t("ai.error.applyUnavailable"));
    return;
  }

  app.modules.editor?.replaceEditorCode?.(app.state.aiDialogState.resultCode);
  closeAiModal();
  updateStatusByKey("success", "status.savedBadge", "ai.status.appliedMessage");
}

async function generateAiDrawioXml() {
  if (!shouldShowDrawioAiButton()) {
    app.state.drawioAiDialogState = {
      ...app.state.drawioAiDialogState,
      error: t("drawio.ai.error.settingsIncomplete"),
      statusKey: "drawio.ai.status.invalid",
      statusMessageKey: "drawio.ai.status.invalidMessage"
    };
    renderDrawioAiDialogState();
    return;
  }

  const prompt = app.dom.drawioAiPromptInput.value.trim();
  if (!prompt) {
    app.state.drawioAiDialogState = {
      ...app.state.drawioAiDialogState,
      error: t("drawio.ai.error.emptyPrompt"),
      statusKey: "drawio.ai.status.invalid",
      statusMessageKey: "drawio.ai.status.invalidMessage"
    };
    renderDrawioAiDialogState();
    return;
  }

  const nextMode = app.state.drawioAiDialogState.mode === "modify" ? "modify" : "new";
  let currentXmlSnapshot = "";

  try {
    currentXmlSnapshot = await getCurrentDrawioXmlForAi();
  } catch (error) {
    reportAppError("drawio.ai.export_current", error);
    app.state.drawioAiDialogState = {
      ...app.state.drawioAiDialogState,
      error: normalizeError(error),
      statusKey: "drawio.ai.status.invalid",
      statusMessageKey: "drawio.ai.status.invalidMessage"
    };
    renderDrawioAiDialogState();
    updateStatus("error", t("status.errorBadge"), normalizeError(error));
    return;
  }

  if (nextMode === "modify" && !currentXmlSnapshot) {
    app.state.drawioAiDialogState = {
      ...app.state.drawioAiDialogState,
      error: t("drawio.ai.error.mergeUnavailable"),
      statusKey: "drawio.ai.status.invalid",
      statusMessageKey: "drawio.ai.status.invalidMessage"
    };
    renderDrawioAiDialogState();
    return;
  }

  const currentXml = nextMode === "modify" ? currentXmlSnapshot : "";
  const requestToken = ++app.state.aiRequestSequence;
  app.state.drawioAiDialogState = {
    ...createDefaultDrawioAiDialogState(),
    isOpen: true,
    mode: nextMode,
    isGenerating: true,
    originalXml: currentXmlSnapshot,
    streamText: "",
    thinkingText: "",
    hasStreamedContent: false,
    statusKey: "drawio.ai.status.generating",
    statusMessageKey: "drawio.ai.status.generatingMessage",
    requestToken
  };
  renderDrawioAiDialogState();

  try {
    await ensureAiStreamListener();
    const api = app.desktopApi.getDesktopApi(["generateAiDrawioStream"]);
    const firstPayload = buildAiDrawioRequestPayload({
      prompt,
      mode: nextMode === "modify" ? "merge" : "new",
      currentXml,
      requestToken
    });
    let result = await api.generateAiDrawioStream(firstPayload);
    let nextXml = sanitizeAiDrawioXml(result.drawioXml || app.state.drawioAiDialogState.streamText);
    let validation = await validateDrawioSource(nextXml);
    let repaired = false;

    if (!validation.valid) {
      app.state.drawioAiDialogState = {
        ...app.state.drawioAiDialogState,
        streamText: "",
        resultXml: "",
        hasResult: false,
        isGenerating: true,
        thinkingText: "",
        hasStreamedContent: false,
        statusKey: "drawio.ai.status.repairing",
        statusMessageKey: "drawio.ai.status.repairingMessage",
        requestToken
      };
      renderDrawioAiDialogState();

      const repairPayload = buildAiDrawioRequestPayload({
        prompt,
        mode: nextMode === "modify" ? "merge" : "new",
        currentXml,
        previousXml: nextXml,
        validationError: validation.message,
        requestToken
      });
      result = await api.generateAiDrawioStream(repairPayload);
      nextXml = sanitizeAiDrawioXml(result.drawioXml || app.state.drawioAiDialogState.streamText);
      validation = await validateDrawioSource(nextXml);
      repaired = true;
    }

    if (requestToken !== app.state.drawioAiDialogState.requestToken) {
      return;
    }

    if (validation.valid) {
      const drawioEditor = app.modules.editor?.ensureDrawioEditor?.();
      if (!drawioEditor) {
        throw new Error("draw.io editor is unavailable.");
      }

      const title = getCurrentDocumentTitle();
      await drawioEditor.replaceXml({
        xml: validation.canonicalXml,
        title
      });

      if (requestToken !== app.state.drawioAiDialogState.requestToken) {
        await drawioEditor.replaceXml({
          xml: currentXmlSnapshot,
          title
        });
        await drawioEditor.stageXmlForSave(currentXmlSnapshot, "ai-cancel-revert");
        return;
      }
    }

    app.state.drawioAiDialogState = {
      ...app.state.drawioAiDialogState,
      isOpen: true,
      isGenerating: false,
      repaired,
      hasResult: validation.valid,
      hasPreviewApplied: validation.valid,
      isValid: validation.valid,
      streamText: validation.valid ? validation.canonicalXml : nextXml,
      thinkingText: "",
      hasStreamedContent: false,
      resultXml: validation.valid ? validation.canonicalXml : "",
      model: result.model,
      error: validation.valid ? "" : validation.message,
      statusKey: validation.valid ? "drawio.ai.status.valid" : "drawio.ai.status.invalid",
      statusMessageKey: validation.valid
        ? "drawio.ai.status.validMessage"
        : "drawio.ai.status.invalidMessage"
    };
    renderDrawioAiDialogState();

    if (validation.valid) {
      updateStatusByKey("success", "status.renderedBadge", "drawio.ai.status.validMessage");
    } else {
      updateStatus("error", t("status.errorBadge"), validation.message);
    }
  } catch (error) {
    reportAppError("drawio.ai.generate", error);
    if (requestToken !== app.state.drawioAiDialogState.requestToken) {
      return;
    }

    app.state.drawioAiDialogState = {
      ...app.state.drawioAiDialogState,
      isOpen: true,
      isGenerating: false,
      error: normalizeError(error),
      statusKey: "drawio.ai.status.invalid",
      statusMessageKey: "drawio.ai.status.invalidMessage"
    };
    renderDrawioAiDialogState();
    updateStatus("error", t("status.errorBadge"), normalizeError(error));
  }
}

async function applyDrawioAiResult() {
  if (
    !(app.state.drawioAiDialogState.hasPreviewApplied &&
      app.state.drawioAiDialogState.isValid &&
      app.state.drawioAiDialogState.resultXml)
  ) {
    updateStatus("error", t("status.errorBadge"), t("drawio.ai.error.applyUnavailable"));
    return;
  }

  try {
    const drawioEditor = app.modules.editor?.ensureDrawioEditor?.();
    if (!drawioEditor) {
      throw new Error("draw.io editor is unavailable.");
    }

    await drawioEditor.stageXmlForSave(app.state.drawioAiDialogState.resultXml, "ai-apply");
    resetAndHideDrawioAiPanel();
    updateStatusByKey("success", "status.savedBadge", "drawio.ai.status.appliedMessage");
  } catch (error) {
    reportAppError("drawio.ai.apply", error);
    updateStatus("error", t("status.errorBadge"), normalizeError(error));
  }
}

async function testAiConnection() {
  app.state.settingsDraftAi = readSettingsAiDraftFromDom();
  const baseUrl = normalizeAiBaseUrl(app.state.settingsDraftAi.baseUrl);
  const model = String(app.state.settingsDraftAi.model ?? "").trim();
  const token = String(app.state.settingsDraftAi.token ?? "").trim();
  const useSavedToken =
    Boolean(app.state.settingsDraftAi.tokenConfigured) &&
    !app.state.settingsDraftAi.clearToken &&
    !token;

  if (!baseUrl || !model || (!token && !useSavedToken)) {
    app.state.settingsAiTestState = {
      running: false,
      tone: "error",
      message: t("ai.error.testIncomplete")
    };
    renderAiSettingsUi();
    return;
  }

  app.state.settingsAiTestState = {
    running: true,
    tone: "idle",
    message: ""
  };
  renderAiSettingsUi();

  try {
    const api = app.desktopApi.getDesktopApi(["testAiConnection"]);
    const result = await api.testAiConnection({
      baseUrl,
      model,
      token: token || null,
      useSavedToken
    });
    app.state.settingsAiTestState = {
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
    app.state.settingsAiTestState = {
      running: false,
      tone: "error",
      message: normalizeError(error)
    };
    renderAiSettingsUi();
    updateStatus("error", t("status.settingsErrorBadge"), normalizeError(error));
  }
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

async function validateDrawioSource(source) {
  const nextXml = sanitizeAiDrawioXml(source);
  if (!nextXml) {
    return {
      valid: false,
      message: t("drawio.ai.error.applyUnavailable"),
      canonicalXml: ""
    };
  }

  try {
    const canonicalXml = await validateDrawioXml({
      xml: nextXml,
      title: getCurrentDocumentTitle()
    });
    if (!isMeaningfulDrawioDiagram(canonicalXml)) {
      return {
        valid: false,
        message: t("drawio.ai.error.emptyDiagram"),
        canonicalXml: ""
      };
    }
    return {
      valid: true,
      message: "",
      canonicalXml
    };
  } catch (error) {
    return {
      valid: false,
      message: normalizeError(error),
      canonicalXml: ""
    };
  }
}
