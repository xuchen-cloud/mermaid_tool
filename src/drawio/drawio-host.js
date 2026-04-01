const DEFAULT_DRAWIO_EDITOR_PATH = "./vendor/drawio/index.html";
const DEFAULT_DRAWIO_TIMEOUT_MS = 30000;
const DRAWIO_AUTOSAVE_DELAY_MS = 240;

export function buildDrawioEditorUrl(editorPath = DEFAULT_DRAWIO_EDITOR_PATH, params = {}) {
  const url = new URL(editorPath, window.location.href);
  const searchParams = new URLSearchParams({
    offline: "1",
    embed: "1",
    dev: "1",
    proto: "json",
    ui: "min",
    dark: "0",
    spin: "1",
    libraries: "1",
    noSaveBtn: "1",
    noExitBtn: "1",
    saveAndExit: "0",
    modified: "0",
    ...params
  });

  url.search = searchParams.toString();
  return url.toString();
}

export function createDrawioHost(options) {
  return new DrawioHost(options);
}

export async function convertMermaidToDrawioXml(options) {
  const source = String(options?.source ?? "").trim();
  if (!source) {
    throw new Error("Mermaid source is empty.");
  }

  const mountNode = document.createElement("div");
  mountNode.className = "drawio-session-sandbox";
  document.body.appendChild(mountNode);

  try {
    return await runTemporaryDrawioSession({
      editorPath: options?.editorPath,
      timeoutMs: options?.timeoutMs,
      onInit(postMessage) {
        postMessage({
          action: "load",
          descriptor: {
            format: "mermaid",
            data: source
          },
          title: options?.title ?? "Mermaid Import",
          noSaveBtn: "1",
          noExitBtn: "1",
          saveAndExit: "0",
          modified: "0"
        });
      },
      onEvent(message, postMessage, controls) {
        if (message.event === "load") {
          const xml = String(message.xml ?? "").trim();
          if (xml) {
            controls.resolve(xml);
            return;
          }

          postMessage({
            action: "export",
            format: "xml"
          });
          return;
        }

        if (message.event === "export") {
          const xml = String(message.xml ?? message.data ?? "").trim();
          if (!xml) {
            controls.reject(new Error("draw.io export did not include XML."));
            return;
          }

          controls.resolve(xml);
          return;
        }

        if (message.event === "exit") {
          controls.reject(new Error("draw.io conversion exited before export completed."));
        }
      },
      mountNode
    });
  } finally {
    mountNode.remove();
  }
}

class DrawioHost {
  constructor({
    mountNode,
    editorPath = DEFAULT_DRAWIO_EDITOR_PATH,
    onSave,
    onLoaded,
    onError
  }) {
    this.mountNode = mountNode;
    this.editorPath = editorPath;
    this.onSave = onSave;
    this.onLoaded = onLoaded;
    this.onError = onError;
    this.iframe = null;
    this.ready = false;
    this.initializing = null;
    this.pendingLoad = null;
    this.activeDocument = null;
    this.pendingXml = null;
    this.pendingSaveReason = "autosave";
    this.saveTimer = null;
    this.pendingSavePromise = null;
    this.boundMessageHandler = (event) => this.handleWindowMessage(event);
  }

  async openDocument({ filePath, xml, title }) {
    this.activeDocument = {
      filePath,
      title: String(title ?? "")
    };

    this.mountNode.hidden = false;
    await this.ensureReady();
    await this.loadXmlDocument(String(xml ?? ""), title);
  }

  setFilePath(filePath) {
    if (this.activeDocument) {
      this.activeDocument.filePath = filePath;
    }
  }

  hide() {
    this.mountNode.hidden = true;
  }

  async flush() {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = null;

    if (this.pendingXml !== null) {
      await this.commitSave(this.pendingSaveReason);
    } else if (this.pendingSavePromise) {
      await this.pendingSavePromise;
    }
  }

  destroy() {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = null;
    window.removeEventListener("message", this.boundMessageHandler);
    this.pendingLoad?.reject?.(new Error("draw.io session was destroyed."));
    this.pendingLoad = null;

    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }

    this.ready = false;
    this.initializing = null;
    this.activeDocument = null;
    this.pendingXml = null;
    this.pendingSavePromise = null;
  }

  async ensureReady() {
    if (this.ready && this.iframe?.contentWindow) {
      return;
    }

    if (!this.initializing) {
      this.initializing = new Promise((resolve, reject) => {
        this.mountNode.innerHTML = "";
        this.iframe = document.createElement("iframe");
        this.iframe.className = "drawio-frame";
        this.iframe.title = "draw.io editor";
        this.iframe.src = buildDrawioEditorUrl(this.editorPath);
        this.mountNode.appendChild(this.iframe);
        this.readyResolve = resolve;
        this.readyReject = reject;
        window.addEventListener("message", this.boundMessageHandler);
      }).finally(() => {
        this.initializing = null;
      });
    }

    await this.initializing;
  }

  async loadXmlDocument(xml, title) {
    await new Promise((resolve, reject) => {
      this.pendingLoad?.reject?.(new Error("draw.io load was interrupted."));
      this.pendingLoad = { resolve, reject };
      this.postMessage({
        action: "load",
        xml,
        autosave: "1",
        title: String(title ?? ""),
        noSaveBtn: "1",
        noExitBtn: "1",
        saveAndExit: "0",
        modified: "0"
      });
    });
  }

  handleWindowMessage(event) {
    if (!this.iframe?.contentWindow || event.source !== this.iframe.contentWindow) {
      return;
    }

    const message = parseDrawioMessage(event.data);
    if (!message) {
      return;
    }

    if (message.event === "init") {
      this.ready = true;
      this.readyResolve?.();
      this.readyResolve = null;
      this.readyReject = null;
      return;
    }

    if (message.event === "load") {
      this.pendingLoad?.resolve?.();
      this.pendingLoad = null;
      this.onLoaded?.(message);
      return;
    }

    if (message.event === "autosave") {
      this.queueSave(message.xml, "autosave");
      return;
    }

    if (message.event === "save") {
      this.queueSave(message.xml, message.exit ? "save-exit" : "save", true);
      return;
    }

    if (message.event === "exit") {
      this.flush().catch((error) => this.reportError(error));
      return;
    }
  }

  queueSave(xml, reason, immediate = false) {
    this.pendingXml = String(xml ?? "");
    this.pendingSaveReason = reason ?? "autosave";

    if (immediate) {
      void this.commitSave(this.pendingSaveReason);
      return;
    }

    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      void this.commitSave(this.pendingSaveReason);
    }, DRAWIO_AUTOSAVE_DELAY_MS);
  }

  async commitSave(reason) {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = null;

    const xml = this.pendingXml;
    const filePath = this.activeDocument?.filePath;
    if (xml === null || !filePath || typeof this.onSave !== "function") {
      this.pendingXml = null;
      return;
    }

    this.pendingXml = null;
    const savePromise = Promise.resolve(this.onSave({ filePath, xml, reason }))
      .catch((error) => {
        this.reportError(error);
        throw error;
      })
      .finally(() => {
        if (this.pendingSavePromise === savePromise) {
          this.pendingSavePromise = null;
        }
      });

    this.pendingSavePromise = savePromise;
    await savePromise;
  }

  postMessage(message) {
    if (!this.iframe?.contentWindow) {
      throw new Error("draw.io iframe is not ready.");
    }

    this.iframe.contentWindow.postMessage(JSON.stringify(message), "*");
  }

  reportError(error) {
    this.onError?.(error);
  }
}

async function runTemporaryDrawioSession({
  editorPath,
  timeoutMs = DEFAULT_DRAWIO_TIMEOUT_MS,
  onInit,
  onEvent,
  mountNode
}) {
  return await new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.className = "drawio-frame";
    iframe.title = "draw.io background session";
    iframe.src = buildDrawioEditorUrl(editorPath);
    mountNode.appendChild(iframe);

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while waiting for draw.io."));
    }, timeoutMs);

    const controls = {
      resolve(value) {
        cleanup();
        resolve(value);
      },
      reject(error) {
        cleanup();
        reject(error);
      }
    };

    const postMessage = (message) => {
      iframe.contentWindow?.postMessage(JSON.stringify(message), "*");
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
      iframe.remove();
    };

    const handleMessage = (event) => {
      if (event.source !== iframe.contentWindow) {
        return;
      }

      const message = parseDrawioMessage(event.data);
      if (!message) {
        return;
      }

      if (message.event === "init") {
        onInit(postMessage);
        return;
      }

      onEvent(message, postMessage, controls);
    };

    window.addEventListener("message", handleMessage);
  });
}

function parseDrawioMessage(rawValue) {
  if (!rawValue) {
    return null;
  }

  if (typeof rawValue === "object") {
    return rawValue;
  }

  if (typeof rawValue !== "string") {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}
