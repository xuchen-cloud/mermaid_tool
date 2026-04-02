import { listen as listenTauriEvent } from "@tauri-apps/api/event";

const tauriCommandMap = {
  chooseWorkspaceDirectory: "choose_workspace_directory",
  openWorkspace: "open_workspace",
  readWorkspaceChildren: "read_workspace_children",
  createWorkspaceEntry: "create_workspace_entry",
  renameWorkspaceEntry: "rename_workspace_entry",
  moveWorkspaceEntry: "move_workspace_entry",
  deleteWorkspaceEntry: "delete_workspace_entry",
  readTextFile: "read_text_file",
  saveTextFile: "save_text_file",
  writeTextFile: "write_text_file",
  openTextFile: "open_text_file",
  saveBinaryFile: "save_binary_file",
  copyImageToClipboard: "copy_image_to_clipboard",
  loadAiSettings: "load_ai_settings",
  saveAiSettings: "save_ai_settings",
  generateAiMermaid: "generate_ai_mermaid",
  generateAiMermaidStream: "generate_ai_mermaid_stream",
  testAiConnection: "test_ai_connection"
};

const tauriMethodArgShape = {
  chooseWorkspaceDirectory: "options",
  openWorkspace: "options",
  readWorkspaceChildren: "options",
  createWorkspaceEntry: "options",
  renameWorkspaceEntry: "options",
  moveWorkspaceEntry: "options",
  deleteWorkspaceEntry: "options",
  readTextFile: "options",
  saveTextFile: "options",
  writeTextFile: "options",
  openTextFile: "options",
  saveBinaryFile: "options",
  copyImageToClipboard: "options",
  loadAiSettings: null,
  saveAiSettings: "options",
  generateAiMermaid: "options",
  generateAiMermaidStream: "options",
  testAiConnection: "options"
};

function isBrowserWindowAvailable() {
  return typeof window !== "undefined";
}

export function isTauriEnvironment() {
  return Boolean(isBrowserWindowAvailable() && window.__TAURI__?.core?.invoke);
}

export async function listenToTauriEvent(eventName, handler) {
  if (!isTauriEnvironment()) {
    throw new Error("Tauri event API is unavailable.");
  }

  return listenTauriEvent(eventName, handler);
}

function invokeTauri(method, args) {
  const command = tauriCommandMap[method];
  if (!command) {
    throw new Error(`No Tauri command mapping exists for "${method}".`);
  }

  const invoke = window.__TAURI__?.core?.invoke;
  if (typeof invoke !== "function") {
    throw new Error("Tauri API is unavailable.");
  }

  const normalizedArgs = normalizeTauriArgs(method, args);
  const argKey = tauriMethodArgShape[method];
  return invoke(command, argKey ? { [argKey]: normalizedArgs } : normalizedArgs);
}

function normalizeTauriArgs(method, args) {
  if ((method === "saveBinaryFile" || method === "copyImageToClipboard") && args?.buffer) {
    const view =
      args.buffer instanceof Uint8Array
        ? args.buffer
        : new Uint8Array(args.buffer);

    return {
      ...args,
      bytes: Array.from(view),
      buffer: undefined
    };
  }

  return args;
}

function buildTauriDesktopApi() {
  const api = {};

  for (const method of Object.keys(tauriCommandMap)) {
    api[method] = (args) => invokeTauri(method, args);
  }

  return api;
}

export function getAvailableDesktopApiKeys() {
  if (isTauriEnvironment()) {
    return Object.keys(tauriCommandMap);
  }

  return [];
}

export function getDesktopApi(requiredMethods = []) {
  let api = null;

  if (isTauriEnvironment()) {
    api = buildTauriDesktopApi();
  }

  if (!api) {
    throw new Error("Desktop API is unavailable. Restart the app.");
  }

  for (const method of requiredMethods) {
    if (typeof api[method] !== "function") {
      throw new Error(`Desktop API is missing "${method}".`);
    }
  }

  return api;
}
