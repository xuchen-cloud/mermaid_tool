const tauriCommandMap = {
  chooseWorkspaceDirectory: "choose_workspace_directory",
  readWorkspaceTree: "read_workspace_tree",
  createWorkspaceEntry: "create_workspace_entry",
  renameWorkspaceEntry: "rename_workspace_entry",
  moveWorkspaceEntry: "move_workspace_entry",
  deleteWorkspaceEntry: "delete_workspace_entry",
  readTextFile: "read_text_file",
  saveTextFile: "save_text_file",
  writeTextFile: "write_text_file",
  openTextFile: "open_text_file",
  saveBinaryFile: "save_binary_file"
};

const tauriMethodArgShape = {
  chooseWorkspaceDirectory: "options",
  readWorkspaceTree: "options",
  createWorkspaceEntry: "options",
  renameWorkspaceEntry: "options",
  moveWorkspaceEntry: "options",
  deleteWorkspaceEntry: "options",
  readTextFile: "options",
  saveTextFile: "options",
  writeTextFile: "options",
  openTextFile: "options",
  saveBinaryFile: "options"
};

function isBrowserWindowAvailable() {
  return typeof window !== "undefined";
}

export function isTauriEnvironment() {
  return Boolean(isBrowserWindowAvailable() && window.__TAURI__?.core?.invoke);
}

export function isElectronEnvironment() {
  return Boolean(isBrowserWindowAvailable() && window.electronAPI);
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
  if (method === "saveBinaryFile" && args?.buffer) {
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
  if (isElectronEnvironment()) {
    return Object.keys(window.electronAPI || {});
  }

  if (isTauriEnvironment()) {
    return Object.keys(tauriCommandMap);
  }

  return [];
}

export function getDesktopApi(requiredMethods = []) {
  let api = null;

  if (isElectronEnvironment()) {
    api = window.electronAPI;
  } else if (isTauriEnvironment()) {
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
