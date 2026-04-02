import mermaid from "../../node_modules/mermaid/dist/mermaid.esm.min.mjs";
import {
  buildAiRequestPayload,
  buildLineDiffSummary,
  hasMeaningfulDiagram,
  normalizeAiBaseUrl,
  resolveAiActionMode,
  sanitizeAiMermaidText,
  validateAiSettingsDraft
} from "../ai-utils.js";
import { isTauriEnvironment, listenToTauriEvent } from "../platform/desktop-api.js";
import { app } from "./context.js";
import {
  aiStreamEventName,
  defaultAiSystemPromptTemplate,
  defaultAiUserPromptTemplate,
  maskedSavedTokenValue,
  mermaidDeclarationPattern,
  sampleCode
} from "./constants.js";
import {
  createDefaultAiDialogState,
  createDefaultAiInlineState,
  createDefaultAiSettingsState
} from "./state.js";
import {
  isMermaidDocumentKind,
  normalizeError,
  reportAppError,
  t,
  updateStatus,
  updateStatusByKey
} from "./common.js";

export function initializeAiModule() {
  app.dom.settingsAiEnabled.addEventListener("change", () => handleSettingsAiDraftInput());
  app.dom.settingsAiBaseUrl.addEventListener("input", () => handleSettingsAiDraftInput());
  app.dom.settingsAiModel.addEventListener("input", () => handleSettingsAiDraftInput());
  app.dom.settingsAiSystemPrompt.addEventListener("input", () => handleSettingsAiDraftInput());
  app.dom.settingsAiUserPrompt.addEventListener("input", () => handleSettingsAiDraftInput());
  app.dom.settingsAiClearToken.addEventListener("click", () => toggleSettingsAiClearToken());
  app.dom.settingsAiToken.addEventListener("input", () => handleSettingsAiTokenInput());
  app.dom.settingsAiToken.addEventListener("focus", () => handleSettingsAiTokenFocus());
  app.dom.settingsAiToken.addEventListener("blur", () => handleSettingsAiTokenBlur());
  app.dom.settingsAiTestButton.addEventListener("click", () => void testAiConnection());
  app.dom.aiButton.addEventListener("click", () => openAiInlineWorkbench());
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

  app.modules.ai = {
    initializeAiSettingsState,
    ensureAiStreamListener,
    beginSettingsEdit,
    saveSettingsDraft,
    renderAiSettingsUi,
    renderAiActionButton,
    shouldShowAiButton,
    rejectAiInlineWorkbench,
    handleAiInlineEditorInput,
    renderAiInlineState,
    renderAiDialogState,
    openAiModal,
    closeAiModal
  };

  renderAiSettingsUi();
  renderAiDialogState();
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
  } catch (error) {
    console.warn("Failed to load AI settings:", error);
    app.state.aiSettingsState = {
      ...createDefaultAiSettingsState(),
      runtimeSupported: true,
      loaded: true,
      loadError: normalizeError(error)
    };
    app.state.settingsDraftAi = { ...app.state.aiSettingsState };
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

  if (
    !chunk ||
    !app.state.aiInlineState.isOpen ||
    !app.state.aiInlineState.isGenerating ||
    !Number.isInteger(requestToken) ||
    requestToken !== app.state.aiInlineState.requestToken
  ) {
    return;
  }

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
  renderAiSettingsUi();
  return nextSnapshot;
}

export function renderAiSettingsUi() {
  const runtimeSupported = isAiSettingsRuntimeSupported();
  renderAiActionButton();

  if (!runtimeSupported) {
    app.dom.aiButton.hidden = true;
    return;
  }

  app.dom.settingsAiEnabled.checked = app.state.settingsDraftAi.enabled;
  app.dom.settingsAiBaseUrl.value = app.state.settingsDraftAi.baseUrl;
  app.dom.settingsAiModel.value = app.state.settingsDraftAi.model;
  renderSettingsAiTokenInput();
  app.dom.settingsAiSystemPrompt.value = app.state.settingsDraftAi.systemPromptTemplate;
  app.dom.settingsAiUserPrompt.value = app.state.settingsDraftAi.userPromptTemplate;
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

function getAiActionMode() {
  return resolveAiActionMode(app.modules.editor?.getVisibleMermaidSource?.() ?? "");
}

export function renderAiActionButton() {
  app.dom.aiButton.hidden = !shouldShowAiButton();
  app.dom.aiButton.textContent = t(
    getAiActionMode() === "new" ? "ai.button.new" : "ai.button.modify"
  );
}

function isAiSettingsRuntimeSupported() {
  return Boolean(app.state.aiSettingsState.runtimeSupported && isTauriEnvironment());
}

function readSettingsAiDraftFromDom() {
  const tokenValue = isSettingsAiTokenMasked()
    ? ""
    : String(app.dom.settingsAiToken.value ?? "");

  return {
    ...app.state.settingsDraftAi,
    enabled: Boolean(app.dom.settingsAiEnabled.checked),
    baseUrl: normalizeAiBaseUrl(app.dom.settingsAiBaseUrl.value),
    model: String(app.dom.settingsAiModel.value ?? "").trim(),
    systemPromptTemplate:
      String(app.dom.settingsAiSystemPrompt.value ?? "").trim() ||
      defaultAiSystemPromptTemplate,
    userPromptTemplate:
      String(app.dom.settingsAiUserPrompt.value ?? "").trim() || defaultAiUserPromptTemplate,
    token: tokenValue,
    runtimeSupported: app.state.aiSettingsState.runtimeSupported
  };
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

function handleSettingsAiDraftInput() {
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
