import mermaid from "../node_modules/mermaid/dist/mermaid.esm.min.mjs";
import {
  buildPptThemeFromMermaidConfig,
  createDefaultMermaidConfig,
  normalizeMermaidConfig,
  parseMermaidConfigText,
  resolveOfficialTheme,
  stringifyMermaidConfig
} from "./mermaid-config.js";

const sampleCode = `flowchart TD
    A[Collect ideas] --> B{Need export?}
    B -->|SVG| C[Save vector output]
    B -->|PNG/JPG| D[Rasterize from SVG]
    C --> E[Share diagram]
    D --> E
`;

const codeInput = document.querySelector("#code-input");
const configInput = document.querySelector("#config-input");
const themeSelect = document.querySelector("#theme-select");
const newDocumentButton = document.querySelector("#new-document");
const openProjectButton = document.querySelector("#open-project");
const saveProjectButton = document.querySelector("#save-project");
const importConfigButton = document.querySelector("#import-config");
const exportConfigButton = document.querySelector("#export-config");
const resetConfigButton = document.querySelector("#reset-config");
const preview = document.querySelector("#preview");
const previewFrame = document.querySelector("#preview-frame");
const previewEmpty = document.querySelector("#preview-empty");
const statusBadge = document.querySelector("#status-badge");
const statusText = document.querySelector("#status-text");
const clipboardFormatSelect = document.querySelector("#clipboard-format");
const copyClipboardButton = document.querySelector("#copy-clipboard");
const exportPptxButton = document.querySelector("#export-pptx");
const exportSvgButton = document.querySelector("#export-svg");
const exportPngButton = document.querySelector("#export-png");
const exportJpgButton = document.querySelector("#export-jpg");
const clipboardFormatStorageKey = "mermaid-tool.clipboard-format";
const mermaidConfigStorageKey = "mermaid-tool.mermaid-config";

let renderTimer;
let latestSvg = "";
let currentMermaidConfig = normalizeMermaidConfig(createDefaultMermaidConfig());
let currentPptTheme = buildPptThemeFromMermaidConfig(currentMermaidConfig);
let lastValidConfigText = stringifyMermaidConfig(createDefaultMermaidConfig());

window.addEventListener("error", (event) => {
  console.error("window error:", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("unhandled rejection:", event.reason);
});

console.log("preload api keys:", Object.keys(window.electronAPI || {}));

codeInput.value = sampleCode;
clipboardFormatSelect.value = loadClipboardFormat();
initializeConfigEditor();

codeInput.addEventListener("input", () => {
  scheduleRender();
});

configInput.addEventListener("input", () => {
  scheduleRender();
});

themeSelect.addEventListener("change", () => {
  applyThemeSelection(themeSelect.value);
});

newDocumentButton.addEventListener("click", () => createNewDraft());
openProjectButton.addEventListener("click", () => openProjectFile());
saveProjectButton.addEventListener("click", () => saveProjectFile());
clipboardFormatSelect.addEventListener("change", () => {
  saveClipboardFormat(clipboardFormatSelect.value);
  updateStatus(
    "success",
    "Clipboard",
    `Clipboard export format set to ${clipboardFormatSelect.value.toUpperCase()}.`
  );
});

importConfigButton.addEventListener("click", () => importMermaidConfig());
exportConfigButton.addEventListener("click", () => exportMermaidConfig());
resetConfigButton.addEventListener("click", () => resetMermaidConfig());

copyClipboardButton.addEventListener("click", () => copyRasterToClipboard());
exportPptxButton.addEventListener("click", () => exportPptx());
exportSvgButton.addEventListener("click", () => exportSvg());
exportPngButton.addEventListener("click", () => exportRaster("png"));
exportJpgButton.addEventListener("click", () => exportRaster("jpeg"));

renderDiagram(sampleCode, currentMermaidConfig);

window.__mermaidTool = {
  getApiKeys: () => Object.keys(window.electronAPI || {}),
  getLatestSvg: () => latestSvg,
  debugWriteRasterFromSvg: async (format) => {
    const api = getElectronApi(["debugWriteRasterFromSvg"]);
    const svgElement = preview.querySelector("svg");

    if (!svgElement) {
      throw new Error("No rendered SVG is available for debug export.");
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
    const api = getElectronApi(["copyRasterFromSvg"]);
    const svgElement = preview.querySelector("svg");

    if (!svgElement) {
      throw new Error("No rendered SVG is available for debug clipboard export.");
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
      throw new Error("No rendered SVG is available for debug clipboard fallback export.");
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
    const api = getElectronApi(["debugWritePptxFile"]);
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
    latestSvg = serializeSvg();
    currentMermaidConfig = mermaidConfig;
    currentPptTheme = buildPptThemeFromMermaidConfig(mermaidConfig);
    applyPreviewTheme(currentPptTheme);
    preview.classList.add("is-visible");
    previewEmpty.style.display = "none";
    setExportButtonsDisabled(false);
    updateStatus("success", "Rendered", "Diagram preview is up to date.");
  } catch (error) {
    latestSvg = "";
    preview.innerHTML = "";
    preview.classList.remove("is-visible");
    previewEmpty.style.display = "block";
    setExportButtonsDisabled(true);
    updateStatus("error", "Error", normalizeError(error));
  }
}

async function exportSvg() {
  if (!latestSvg) {
    return;
  }

  const api = getElectronApi(["saveTextFile"]);
  const result = await api.saveTextFile({
    defaultPath: "diagram.svg",
    filters: [{ name: "SVG", extensions: ["svg"] }],
    text: latestSvg
  });

  if (!result.canceled) {
    updateStatus("success", "Saved", `SVG exported to ${result.filePath}`);
  }
}

async function exportPptx() {
  try {
    const api = getElectronApi(["savePptxFile"]);
    const source = getSupportedSourceForPptx();
    const result = await api.savePptxFile({
      defaultPath: "diagram.pptx",
      filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
      source,
      mermaidConfig: currentMermaidConfig
    });

    if (!result.canceled) {
      updateStatus("success", "Saved", `PPTX exported to ${result.filePath}`);
    }
  } catch (error) {
    updateStatus("error", "PPTX error", normalizeError(error));
  }
}

async function copyRasterToClipboard() {
  if (!latestSvg) {
    return;
  }

  const svgElement = preview.querySelector("svg");

  if (!svgElement) {
    updateStatus("error", "Clipboard error", "No rendered SVG is available for clipboard export.");
    return;
  }

  const format = clipboardFormatSelect.value;
  const { width, height } = getSvgSize(svgElement);
  const svgMarkup = buildExportableSvg(
    svgElement,
    width,
    height,
    getRasterBackgroundColor()
  );

  try {
    const api = getElectronApi(["copyRasterFromSvg"]);
    const result = await api.copyRasterFromSvg({
      format,
      quality: 95,
      svg: svgMarkup
    });

    if (result.ok) {
      updateStatus(
        "success",
        "Copied",
        `${format.toUpperCase()} image copied to clipboard.`
      );
    }
  } catch (error) {
    if (shouldUseRendererClipboardFallback(error)) {
      try {
        await copyRasterToClipboardInRenderer(svgMarkup, format, width, height);
        updateStatus(
          "success",
          "Copied",
          `${format.toUpperCase()} image copied to clipboard.`
        );
        console.warn("Fell back to renderer clipboard copy because main handler was unavailable.");
        return;
      } catch (fallbackError) {
        updateStatus("error", "Clipboard error", normalizeError(fallbackError));
        return;
      }
    }

    updateStatus("error", "Clipboard error", normalizeError(error));
  }
}

async function exportRaster(format) {
  if (!latestSvg) {
    return;
  }

  try {
    const api = getElectronApi(["saveRasterFromSvg"]);
    const svgElement = preview.querySelector("svg");

    if (!svgElement) {
      throw new Error("No rendered SVG is available for export.");
    }

    const { width, height } = getSvgSize(svgElement);
    const svgMarkup = buildExportableSvg(
      svgElement,
      width,
      height,
      getRasterBackgroundColor()
    );
    const extension = format === "png" ? "png" : "jpg";

    const result = await api.saveRasterFromSvg({
      defaultPath: `diagram.${extension}`,
      filters: [
        {
          name: format === "png" ? "PNG" : "JPG",
          extensions: [extension]
        }
      ],
      format,
      quality: 95,
      svg: svgMarkup
    });

    if (!result.canceled) {
      updateStatus(
        "success",
        "Saved",
        `${extension.toUpperCase()} exported to ${result.filePath}`
      );
    }
  } catch (error) {
    updateStatus("error", "Export error", normalizeError(error));
  }
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
  copyClipboardButton.disabled = disabled;
  exportPptxButton.disabled = disabled;
  exportSvgButton.disabled = disabled;
  exportPngButton.disabled = disabled;
  exportJpgButton.disabled = disabled;
}

function scheduleRender() {
  updateStatus("rendering", "Rendering", "Updating preview...");
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(async () => {
    try {
      const mermaidConfig = getNormalizedConfigFromEditor();
      await renderDiagram(codeInput.value, mermaidConfig);
    } catch (error) {
      latestSvg = "";
      setExportButtonsDisabled(true);
      updateStatus("error", "Config error", normalizeError(error));
    }
  }, 220);
}

function updateStatus(state, badgeText, message) {
  statusBadge.className = `status status-${state}`;
  statusBadge.textContent = badgeText;
  statusText.textContent = message;
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getElectronApi(requiredMethods) {
  const api = window.electronAPI;

  if (!api) {
    throw new Error("Electron preload API is unavailable. Restart the app.");
  }

  for (const method of requiredMethods) {
    if (typeof api[method] !== "function") {
      throw new Error(
        `Electron preload API is outdated and missing "${method}". Fully quit and restart the app.`
      );
    }
  }

  return api;
}

function getSupportedSourceForPptx() {
  if (!isPptExportableSource(codeInput.value)) {
    throw new Error("PPT export currently supports Flowchart and Sequence diagrams only.");
  }

  return codeInput.value;
}

function initializeConfigEditor() {
  const { text, config } = loadMermaidConfigState();
  lastValidConfigText = text;
  currentMermaidConfig = config;
  currentPptTheme = buildPptThemeFromMermaidConfig(config);
  configInput.value = text;
  themeSelect.value = resolveOfficialTheme(config.theme);
  applyPreviewTheme(currentPptTheme);
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

function getNormalizedConfigFromEditor() {
  const parsed = parseMermaidConfigText(configInput.value);
  const normalized = normalizeMermaidConfig(parsed);
  lastValidConfigText = stringifyMermaidConfig(parsed);
  window.localStorage.setItem(mermaidConfigStorageKey, lastValidConfigText);
  themeSelect.value = resolveOfficialTheme(normalized.theme);
  return normalized;
}

function applyThemeSelection(theme) {
  let parsed;

  try {
    parsed = parseMermaidConfigText(configInput.value);
  } catch {
    parsed = parseMermaidConfigText(lastValidConfigText);
  }

  parsed.theme = resolveOfficialTheme(theme);
  const text = stringifyMermaidConfig(parsed);
  configInput.value = text;
  lastValidConfigText = text;
  window.localStorage.setItem(mermaidConfigStorageKey, text);
  scheduleRender();
}

function createNewDraft() {
  const nextConfig = createDefaultMermaidConfig(resolveOfficialTheme(themeSelect.value));
  const text = stringifyMermaidConfig(nextConfig);
  codeInput.value = sampleCode;
  configInput.value = text;
  lastValidConfigText = text;
  window.localStorage.setItem(mermaidConfigStorageKey, text);
  scheduleRender();
  updateStatus("success", "Draft ready", "Started a new Mermaid draft in the workspace.");
}

async function importMermaidConfig() {
  try {
    const api = getElectronApi(["openTextFile"]);
    const result = await api.openTextFile({
      filters: [{ name: "JSON", extensions: ["json"] }]
    });

    if (result.canceled) {
      return;
    }

    const parsed = parseMermaidConfigText(result.text);
    const text = stringifyMermaidConfig(parsed);
    configInput.value = text;
    lastValidConfigText = text;
    window.localStorage.setItem(mermaidConfigStorageKey, text);
    scheduleRender();
  } catch (error) {
    updateStatus("error", "Config error", normalizeError(error));
  }
}

async function exportMermaidConfig() {
  try {
    const api = getElectronApi(["saveTextFile"]);
    const parsed = parseMermaidConfigText(configInput.value);
    const text = stringifyMermaidConfig(parsed);
    const result = await api.saveTextFile({
      defaultPath: "mermaid-theme.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
      text
    });

    if (!result.canceled) {
      updateStatus("success", "Saved", `Theme JSON exported to ${result.filePath}`);
    }
  } catch (error) {
    updateStatus("error", "Config error", normalizeError(error));
  }
}

async function openProjectFile() {
  try {
    const api = getElectronApi(["openTextFile"]);
    const result = await api.openTextFile({
      filters: [
        { name: "Mermaid Project", extensions: ["mmdproj.json", "json"] }
      ]
    });

    if (result.canceled) {
      return;
    }

    const project = JSON.parse(result.text);

    if (typeof project.code !== "string") {
      throw new Error("Project file is missing a valid \"code\" field.");
    }

    if (!project.mermaidConfig || typeof project.mermaidConfig !== "object") {
      throw new Error("Project file is missing a valid \"mermaidConfig\" field.");
    }

    const configText = stringifyMermaidConfig(project.mermaidConfig);
    codeInput.value = project.code;
    configInput.value = configText;
    lastValidConfigText = configText;
    window.localStorage.setItem(mermaidConfigStorageKey, configText);
    scheduleRender();
    updateStatus("success", "Loaded", `Project loaded from ${result.filePath}`);
  } catch (error) {
    updateStatus("error", "Project error", normalizeError(error));
  }
}

async function saveProjectFile() {
  try {
    const api = getElectronApi(["saveTextFile"]);
    const mermaidConfig = parseMermaidConfigText(configInput.value);
    const project = {
      version: 1,
      code: codeInput.value,
      mermaidConfig
    };
    const result = await api.saveTextFile({
      defaultPath: "diagram.mmdproj.json",
      filters: [{ name: "Mermaid Project", extensions: ["mmdproj.json", "json"] }],
      text: `${JSON.stringify(project, null, 2)}\n`
    });

    if (!result.canceled) {
      updateStatus("success", "Saved", `Project saved to ${result.filePath}`);
    }
  } catch (error) {
    updateStatus("error", "Project error", normalizeError(error));
  }
}

function resetMermaidConfig() {
  const theme = themeSelect.value || "default";
  const nextConfig = createDefaultMermaidConfig(theme);
  const text = stringifyMermaidConfig(nextConfig);
  configInput.value = text;
  lastValidConfigText = text;
  window.localStorage.setItem(mermaidConfigStorageKey, text);
  scheduleRender();
}

function applyPreviewTheme(pptTheme) {
  const background = `#${pptTheme.canvas.background}`;
  previewFrame.style.background = background;
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

function isPptExportableSource(source) {
  return isFlowchartSource(source) || isSequenceSource(source);
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
    throw new Error("Clipboard image writing is unavailable in this app session. Fully quit and restart the app.");
  }

  const blob = await rasterizeSvgToBlob(svgMarkup, format, width, height);
  await navigator.clipboard.write([
    new ClipboardItem({
      [blob.type]: blob
    })
  ]);
}

async function rasterizeSvgToBlob(svgMarkup, format, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * 2);
  canvas.height = Math.ceil(height * 2);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }

  context.scale(2, 2);

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
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to rasterize SVG for clipboard copy."));
    image.src = url;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas export returned an empty blob."));
        return;
      }

      resolve(blob);
    }, mimeType, quality);
  });
}
