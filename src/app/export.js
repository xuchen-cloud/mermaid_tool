import { convertMermaidToDrawioXml } from "../drawio/drawio-host.js";
import { buildDiagramPptxBytes } from "../ppt/export-pptx.js";
import { isTauriEnvironment } from "../platform/desktop-api.js";
import { app } from "./context.js";
import { clipboardFormatStorageKey } from "./constants.js";
import {
  dirname,
  getCurrentDocumentTitle,
  isMermaidDocumentKind,
  normalizeError,
  t,
  updateStatus,
  updateStatusByKey
} from "./common.js";
import {
  buildPptDiagramFromDocument,
  isPptExportableSource
} from "./mermaid-document.js";
import { isSameOrDescendantPath } from "./utils.js";

export function initializeExportModule() {
  app.dom.copyCodeButton.addEventListener("click", () => void copyCodeToClipboard());
  app.dom.copyClipboardButton.addEventListener("click", () => void copyRasterToClipboard());
  app.dom.exportButton.addEventListener("click", () => toggleExportMenu());
  app.dom.exportMenu.addEventListener("keydown", (event) =>
    handleMenuKeydown(event, app.dom.exportMenu, app.dom.exportMenuItems, () => {
      setExportMenuOpen(false);
      app.dom.exportButton.focus({ preventScroll: true });
    })
  );
  app.dom.exportDrawioButton.addEventListener("click", async () => {
    setExportMenuOpen(false);
    await exportDrawio();
  });
  app.dom.exportPptxButton.addEventListener("click", async () => {
    setExportMenuOpen(false);
    await exportPptx();
  });
  app.dom.exportSvgButton.addEventListener("click", async () => {
    setExportMenuOpen(false);
    await exportSvg();
  });
  app.dom.exportPngButton.addEventListener("click", async () => {
    setExportMenuOpen(false);
    await exportRaster("png");
  });
  app.dom.exportJpgButton.addEventListener("click", async () => {
    setExportMenuOpen(false);
    await exportRaster("jpeg");
  });

  app.modules.export = {
    copyCodeToClipboard,
    copyRasterToClipboard,
    exportSvg,
    exportPptx,
    exportRaster,
    exportDrawio,
    toggleExportMenu,
    setExportMenuOpen,
    renderExportMenuState,
    setExportButtonsDisabled,
    loadClipboardFormat,
    saveClipboardFormat
  };
}

async function exportSvg() {
  if (!isMermaidDocumentKind(app.state.currentDocument.kind)) {
    return;
  }

  const svgMarkup = app.modules.preview?.serializeSvg?.() ?? "";
  if (!svgMarkup) {
    return;
  }

  const api = app.desktopApi.getDesktopApi(["saveTextFile"]);
  const result = await api.saveTextFile({
    defaultPath: `${getCurrentExportBaseName()}.svg`,
    filters: [{ name: "SVG", extensions: ["svg"] }],
    text: svgMarkup
  });

  if (!result.canceled) {
    updateStatusByKey("success", "status.savedBadge", "status.svgSaved", {
      filePath: result.filePath
    });
  }
}

async function exportPptx() {
  if (!isMermaidDocumentKind(app.state.currentDocument.kind)) {
    return;
  }

  try {
    const api = app.desktopApi.getDesktopApi(["saveBinaryFile"]);
    const bytes = await buildDiagramPptxBytes(buildCurrentPptDiagram());
    const result = await api.saveBinaryFile({
      defaultPath: `${getCurrentExportBaseName()}.pptx`,
      filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
      buffer: bytes.buffer
    });

    if (!result.canceled) {
      updateStatusByKey("success", "status.savedBadge", "status.pptxSaved", {
        filePath: result.filePath
      });
    }
  } catch (error) {
    updateStatus("error", t("status.pptxErrorBadge"), normalizeError(error));
  }
}

async function copyCodeToClipboard() {
  if (!isMermaidDocumentKind(app.state.currentDocument.kind)) {
    return;
  }

  try {
    await navigator.clipboard.writeText(app.modules.editor?.getVisibleMermaidSource?.() ?? "");
    updateStatusByKey("success", "status.copiedBadge", "status.codeCopied");
  } catch (error) {
    updateStatus("error", t("status.clipboardErrorBadge"), normalizeError(error));
  }
}

async function copyRasterToClipboard() {
  if (!isMermaidDocumentKind(app.state.currentDocument.kind) || !app.state.latestSvg) {
    return;
  }

  const svgElement = app.modules.preview?.getPrimaryPreviewSvgElement?.();
  if (!svgElement) {
    updateStatus("error", t("status.clipboardErrorBadge"), t("error.noRenderedSvgClipboard"));
    return;
  }

  const format = loadClipboardFormat();
  const { width, height } = app.modules.preview.getSvgSize(svgElement);
  const svgMarkup = app.modules.preview.buildExportableSvg(
    svgElement,
    width,
    height,
    app.modules.preview.getRasterBackgroundColor()
  );

  try {
    if (isTauriEnvironment()) {
      await copyRasterToClipboardViaDesktop(svgMarkup, width, height);
    } else {
      await copyRasterToClipboardInRenderer(svgMarkup, format, width, height);
    }
    updateStatus("success", t("status.copiedBadge"), t("status.imageCopied", { format: format.toUpperCase() }));
  } catch (error) {
    updateStatus("error", t("status.clipboardErrorBadge"), normalizeError(error));
  }
}

async function exportRaster(format) {
  if (!isMermaidDocumentKind(app.state.currentDocument.kind) || !app.state.latestSvg) {
    return;
  }

  try {
    const api = app.desktopApi.getDesktopApi(["saveBinaryFile"]);
    const svgElement = app.modules.preview?.getPrimaryPreviewSvgElement?.();
    if (!svgElement) {
      throw new Error(t("error.noRenderedSvgExport"));
    }

    const { width, height } = app.modules.preview.getSvgSize(svgElement);
    const svgMarkup = app.modules.preview.buildExportableSvg(
      svgElement,
      width,
      height,
      app.modules.preview.getRasterBackgroundColor()
    );
    const extension = format === "png" ? "png" : "jpg";
    const blob = await rasterizeSvgToBlob(svgMarkup, format, width, height);
    const bytes = await blob.arrayBuffer();
    const result = await api.saveBinaryFile({
      defaultPath: `${getCurrentExportBaseName()}.${extension}`,
      filters: [{ name: format === "png" ? "PNG" : "JPG", extensions: [extension] }],
      buffer: bytes
    });

    if (!result.canceled) {
      updateStatus(
        "success",
        t("status.savedBadge"),
        t("status.rasterSaved", {
          format: extension.toUpperCase(),
          filePath: result.filePath
        })
      );
    }
  } catch (error) {
    updateStatus("error", t("status.exportErrorBadge"), normalizeError(error));
  }
}

async function exportDrawio() {
  try {
    if (!isMermaidDocumentKind(app.state.currentDocument.kind)) {
      return;
    }

    const source = (app.modules.editor?.getVisibleMermaidSource?.() ?? "").trim();
    if (!source) {
      return;
    }

    const xml = await convertMermaidToDrawioXml({
      source,
      title: getCurrentDocumentTitle()
    });
    const api = app.desktopApi.getDesktopApi([
      "createWorkspaceEntry",
      "writeTextFile",
      "saveTextFile"
    ]);

    if (app.state.currentDocument.path && app.state.currentWorkspace.rootPath) {
      const result = await api.createWorkspaceEntry({
        parentPath: dirname(app.state.currentDocument.path),
        kind: "file",
        fileType: "drawio",
        name: getCurrentDocumentTitle()
      });
      await api.writeTextFile({
        filePath: result.path,
        text: xml
      });
      await app.modules.workspace?.reloadDirectory?.(dirname(result.path));
      await app.modules.workspace?.openWorkspaceFile?.(result.path, { skipAutosave: true });
      updateStatusByKey("success", "status.savedBadge", "status.drawioExported", {
        filePath: result.path
      });
      return;
    }

    const result = await api.saveTextFile({
      defaultPath: `${getCurrentDocumentTitle()}.drawio`,
      filters: [{ name: "draw.io", extensions: ["drawio"] }],
      text: xml
    });

    if (result.canceled || !result.filePath) {
      return;
    }

    if (
      app.state.currentWorkspace.rootPath &&
      isSameOrDescendantPath(result.filePath, app.state.currentWorkspace.rootPath)
    ) {
      await app.modules.workspace?.openWorkspace?.(app.state.currentWorkspace.rootPath, result.filePath);
    }

    updateStatusByKey("success", "status.savedBadge", "status.drawioExported", {
      filePath: result.filePath
    });
  } catch (error) {
    updateStatus("error", t("status.exportErrorBadge"), normalizeError(error));
  }
}

function buildCurrentPptDiagram() {
  const source = getSupportedSourceForPptx();
  const document =
    app.state.currentMermaidDocument?.source === source
      ? app.state.currentMermaidDocument
      : app.documentCache.resolve(source);
  return buildPptDiagramFromDocument(document, app.state.currentPptTheme);
}

function getSupportedSourceForPptx() {
  const source = app.modules.editor?.getVisibleMermaidSource?.() ?? "";
  if (!isPptExportableSource(source)) {
    throw new Error(t("error.pptUnsupported"));
  }
  return source;
}

function getCurrentExportBaseName() {
  return getCurrentDocumentTitle() || "diagram";
}

export function renderExportMenuState() {
  const mermaidMode = isMermaidDocumentKind(app.state.currentDocument.kind);
  app.dom.exportDrawioButton.hidden = !mermaidMode;
  app.dom.exportPptxButton.hidden = !mermaidMode;
  app.dom.exportSvgButton.hidden = !mermaidMode;
  app.dom.exportPngButton.hidden = !mermaidMode;
  app.dom.exportJpgButton.hidden = !mermaidMode;

  if (!mermaidMode) {
    setExportMenuOpen(false);
  }
}

function toggleExportMenu() {
  app.modules.workspace?.closeWorkspaceContextMenu?.();
  setExportMenuOpen(app.dom.exportMenu.hidden);
}

export function setExportMenuOpen(nextOpen) {
  const isOpen = Boolean(nextOpen);
  app.dom.exportMenu.hidden = !isOpen;
  app.dom.exportButton.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    app.state.menuDismissGuardUntil = performance.now() + 180;
    app.dom.exportMenu.classList.remove("menu-animate-in");
    void app.dom.exportMenu.offsetWidth;
    app.dom.exportMenu.classList.add("menu-animate-in");
    queueMicrotask(() => {
      getVisibleMenuItems(app.dom.exportMenuItems)[0]?.focus({ preventScroll: true });
    });
  }
}

function getVisibleMenuItems(items) {
  return items.filter((item) => !item.hidden && !item.disabled);
}

function handleMenuKeydown(event, menuElement, items, closeMenu) {
  const visibleItems = getVisibleMenuItems(items);
  if (!visibleItems.length) {
    return;
  }

  const currentIndex = visibleItems.indexOf(document.activeElement);
  if (event.key === "Escape") {
    event.preventDefault();
    closeMenu();
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % visibleItems.length;
    visibleItems[nextIndex]?.focus({ preventScroll: true });
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    const nextIndex =
      currentIndex < 0
        ? visibleItems.length - 1
        : (currentIndex - 1 + visibleItems.length) % visibleItems.length;
    visibleItems[nextIndex]?.focus({ preventScroll: true });
    return;
  }

  if (event.key === "Tab") {
    closeMenu();
    return;
  }

  if ((event.key === "Enter" || event.key === " ") && menuElement.contains(event.target)) {
    event.preventDefault();
    document.activeElement?.click?.();
  }
}

export function setExportButtonsDisabled(disabled) {
  app.dom.exportButton.disabled = disabled;
  app.dom.copyClipboardButton.disabled = disabled;
  app.dom.exportDrawioButton.disabled = disabled;
  app.dom.exportPptxButton.disabled = disabled;
  app.dom.exportSvgButton.disabled = disabled;
  app.dom.exportPngButton.disabled = disabled;
  app.dom.exportJpgButton.disabled = disabled;
}

export function loadClipboardFormat() {
  const saved = window.localStorage.getItem(clipboardFormatStorageKey);
  return saved === "jpeg" ? "jpeg" : "png";
}

export function saveClipboardFormat(format) {
  window.localStorage.setItem(
    clipboardFormatStorageKey,
    format === "jpeg" ? "jpeg" : "png"
  );
}

async function copyRasterToClipboardInRenderer(svgMarkup, format, width, height) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error(t("error.clipboardWriteUnavailable"));
  }

  const { blob } = await getClipboardRasterPayload(svgMarkup, format, width, height);
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}

async function copyRasterToClipboardViaDesktop(svgMarkup, width, height) {
  const api = app.desktopApi.getDesktopApi(["copyImageToClipboard"]);
  const format = loadClipboardFormat();
  const { bytes } = await getClipboardRasterPayload(svgMarkup, format, width, height);
  await api.copyImageToClipboard({ buffer: bytes });
}

async function getClipboardRasterPayload(svgMarkup, format, width, height) {
  const cacheKey = `clipboard:${format}:${width}:${height}:${svgMarkup}`;
  if (
    app.state.clipboardRasterCache.key === cacheKey &&
    app.state.clipboardRasterCache.blob &&
    app.state.clipboardRasterCache.bytes
  ) {
    return app.state.clipboardRasterCache;
  }

  const blob = await rasterizeSvgToBlob(svgMarkup, format, width, height, { scale: 1 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  app.state.clipboardRasterCache = { key: cacheKey, blob, bytes };
  return app.state.clipboardRasterCache;
}

async function rasterizeSvgToBlob(svgMarkup, format, width, height, options = {}) {
  const scale = Math.max(0.5, Number(options.scale) || 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error(t("error.canvasContextUnavailable"));
  }

  context.scale(scale, scale);
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
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t("error.rasterizeFailed")));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(t("error.canvasBlobEmpty")));
        return;
      }

      resolve(blob);
    }, mimeType, quality);
  });
}
