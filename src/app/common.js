import { app } from "./context.js";
import { retriggerAnimation, normalizeError, basename, dirname } from "./utils.js";
import { maskedSavedTokenValue, workspaceFileStorageKey } from "./constants.js";
import {
  getWorkspaceFileExtension,
  getWorkspaceFileTypeForDocumentKind,
  stripSupportedWorkspaceExtension
} from "../workspace-file-types.js";

export function t(key, vars = {}) {
  return app.i18n.t(key, vars);
}

export function getDocumentNameBase(name) {
  return stripSupportedWorkspaceExtension(name);
}

export function isMermaidDocumentKind(kind) {
  return kind === "draft" || kind === "mermaid-file";
}

export function isDrawioDocumentKind(kind) {
  return kind === "drawio-file";
}

export function getDocumentSuffixForKind(kind) {
  return getWorkspaceFileExtension(getWorkspaceFileTypeForDocumentKind(kind));
}

export function getCurrentDocumentTitle() {
  return getDocumentNameBase(app.state.currentDocument.name) || "diagram";
}

export function updateStatusByKey(stateName, badgeKey, messageKey, vars = {}) {
  app.state.status.descriptor = {
    type: "key",
    state: stateName,
    badgeKey,
    messageKey,
    vars
  };
  renderCurrentStatus();
}

export function updateStatus(stateName, badgeText, message) {
  app.state.status.descriptor = {
    type: "literal",
    state: stateName,
    badgeText,
    message
  };
  renderCurrentStatus();
}

export function renderCurrentStatus() {
  const { statusBadge, statusText } = app.dom;
  const descriptor = app.state.status.descriptor;
  statusBadge.className = `status status-${descriptor.state}`;

  if (descriptor.type === "key") {
    statusBadge.textContent = t(descriptor.badgeKey, descriptor.vars);
    statusText.textContent = t(descriptor.messageKey, descriptor.vars);
  } else {
    statusBadge.textContent = descriptor.badgeText;
    statusText.textContent = descriptor.message;
  }

  playStatusFeedback();
}

export function playStatusFeedback() {
  retriggerAnimation(app.dom.statusBadge, "status-bump");
}

export function renderDocumentState() {
  const { currentDocument, currentWorkspace } = app.state;
  const {
    topbarWorkspacePath,
    editorDocumentName,
    editorDocumentSuffix
  } = app.dom;

  if (currentWorkspace.rootPath) {
    topbarWorkspacePath.textContent = basename(currentWorkspace.rootPath);
    topbarWorkspacePath.title = currentWorkspace.rootPath;
  } else {
    topbarWorkspacePath.textContent = t("workspace.noneSelected");
    topbarWorkspacePath.title = "";
  }

  editorDocumentName.value = getDocumentNameBase(currentDocument.name);
  editorDocumentSuffix.textContent = getDocumentSuffixForKind(currentDocument.kind);
  editorDocumentName.disabled = app.state.aiInlineState.isOpen || !currentDocument.path;
  app.modules.editor?.updateEditorDocumentNameWidth?.();
  app.modules.editor?.renderDocumentMode?.();
  app.modules.export?.renderExportMenuState?.();
  app.modules.ai?.renderAiActionButton?.();
}

export function setCurrentDocument(nextState) {
  app.state.currentDocument = {
    ...app.state.currentDocument,
    ...nextState
  };

  if (isDrawioDocumentKind(app.state.currentDocument.kind) && app.state.currentDocument.path) {
    app.state.drawioEditor?.setFilePath(app.state.currentDocument.path);
  }

  if (app.state.currentDocument.path) {
    window.localStorage.setItem(workspaceFileStorageKey, app.state.currentDocument.path);
  } else {
    window.localStorage.removeItem(workspaceFileStorageKey);
  }

  renderDocumentState();
}

export function reportAppError(context, error) {
  console.error(`[app-error] ${context}`, error);
}

export function getDesktopApiOrThrow(requiredMethods = []) {
  try {
    return app.desktopApi.getDesktopApi(requiredMethods);
  } catch (error) {
    const message = String(error?.message ?? error);
    if (message.includes("missing")) {
      throw new Error(t("error.desktopApiOutdated", { method: requiredMethods[0] ?? "unknown" }));
    }

    throw new Error(t("error.desktopApiUnavailable"));
  }
}

export function isSettingsAiTokenMasked() {
  return app.state.settingsDraftAi.token === maskedSavedTokenValue;
}

export {
  basename,
  dirname,
  normalizeError
};
