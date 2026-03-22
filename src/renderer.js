import mermaid from "../node_modules/mermaid/dist/mermaid.esm.min.mjs";

const sampleCode = `flowchart TD
    A[Collect ideas] --> B{Need export?}
    B -->|SVG| C[Save vector output]
    B -->|PNG/JPG| D[Rasterize from SVG]
    C --> E[Share diagram]
    D --> E
`;

const codeInput = document.querySelector("#code-input");
const preview = document.querySelector("#preview");
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

let renderTimer;
let latestSvg = "";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  theme: "default",
  suppressErrorRendering: true,
  htmlLabels: false
});

window.addEventListener("error", (event) => {
  console.error("window error:", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("unhandled rejection:", event.reason);
});

console.log("preload api keys:", Object.keys(window.electronAPI || {}));

codeInput.value = sampleCode;
clipboardFormatSelect.value = loadClipboardFormat();

codeInput.addEventListener("input", () => {
  updateStatus("rendering", "Rendering", "Updating preview...");
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => {
    renderDiagram(codeInput.value);
  }, 220);
});

clipboardFormatSelect.addEventListener("change", () => {
  saveClipboardFormat(clipboardFormatSelect.value);
  updateStatus(
    "success",
    "Clipboard",
    `Clipboard export format set to ${clipboardFormatSelect.value.toUpperCase()}.`
  );
});

copyClipboardButton.addEventListener("click", () => copyRasterToClipboard());
exportPptxButton.addEventListener("click", () => exportPptx());
exportSvgButton.addEventListener("click", () => exportSvg());
exportPngButton.addEventListener("click", () => exportRaster("png"));
exportJpgButton.addEventListener("click", () => exportRaster("jpeg"));

renderDiagram(sampleCode);

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
      format === "jpeg" ? "#ffffff" : null
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
      format === "jpeg" ? "#ffffff" : null
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
      format === "jpeg" ? "#ffffff" : null
    );

    await copyRasterToClipboardInRenderer(svgMarkup, format, width, height);
    return { ok: true, format };
  },
  debugWritePptx: async () => {
    const api = getElectronApi(["debugWritePptxFile"]);
    const source = getFlowchartSourceForPptx();
    return api.debugWritePptxFile({ source });
  }
};

async function renderDiagram(source) {
  try {
    const id = `mermaid-${crypto.randomUUID()}`;
    const { svg, bindFunctions } = await mermaid.render(id, source);

    preview.innerHTML = svg;
    bindFunctions?.(preview);
    latestSvg = serializeSvg();
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
    const source = getFlowchartSourceForPptx();
    const result = await api.savePptxFile({
      defaultPath: "diagram.pptx",
      filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
      source
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
    format === "jpeg" ? "#ffffff" : null
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
      format === "jpeg" ? "#ffffff" : null
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

function getFlowchartSourceForPptx() {
  if (!isFlowchartSource(codeInput.value)) {
    throw new Error("PPT export currently supports Flowchart diagrams only.");
  }

  return codeInput.value;
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
