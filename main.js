import { app, BrowserWindow, dialog, ipcMain, clipboard, nativeImage } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import sharp from "sharp";
import { buildPptThemeFromMermaidConfig, normalizeMermaidConfig } from "./src/mermaid-config.js";
import { parseFlowchartSource } from "./src/ppt/flowchart/parse.js";
import { layoutFlowchart } from "./src/ppt/flowchart/layout.js";
import { parseSequenceSource } from "./src/ppt/sequence/parse.js";
import { layoutSequence } from "./src/ppt/sequence/layout.js";
import { writeDiagramPptx } from "./src/ppt/export-pptx.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    const levels = ["debug", "info", "warn", "error"];
    const label = levels[level] ?? "log";
    console.log(`[renderer:${label}] ${sourceId}:${line} ${message}`);
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    console.error("[renderer:crash]", details);
  });

  win.webContents.on("did-finish-load", async () => {
    try {
      const apiKeys = await win.webContents.executeJavaScript(
        "Object.keys(window.electronAPI || {})",
        true
      );
      console.log("[renderer:api-keys]", apiKeys);

      if (process.env.MERMAID_TOOL_SELF_TEST === "1") {
        await runSelfTest(win);
      }
    } catch (error) {
      console.error("[renderer:api-keys:error]", error);
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

async function runSelfTest(win) {
  console.log("[self-test] starting raster export verification");

  const waitForSvg = async () => {
    for (let index = 0; index < 20; index += 1) {
      const hasSvg = await win.webContents.executeJavaScript(
        "Boolean(document.querySelector('#preview svg'))",
        true
      );

      if (hasSvg) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error("Timed out waiting for Mermaid SVG render.");
  };

  await waitForSvg();

  const svgMarkup = await win.webContents.executeJavaScript(
    "window.__mermaidTool.getLatestSvg()",
    true
  );
  const svgPath = path.join(os.tmpdir(), "mermaid-tool-debug.svg");
  await writeFile(svgPath, svgMarkup, "utf8");
  console.log("[self-test] svg", {
    filePath: svgPath,
    hasText: svgMarkup.includes("<text"),
    hasForeignObject: svgMarkup.includes("foreignObject"),
    hasStyleTag: svgMarkup.includes("<style")
  });

  const pngResult = await win.webContents.executeJavaScript(
    "window.__mermaidTool.debugWriteRasterFromSvg('png')",
    true
  );
  console.log("[self-test] png", pngResult);

  const jpgResult = await win.webContents.executeJavaScript(
    "window.__mermaidTool.debugWriteRasterFromSvg('jpeg')",
    true
  );
  console.log("[self-test] jpg", jpgResult);

  const clipboardResult = await win.webContents.executeJavaScript(
    "window.__mermaidTool.debugCopyRasterToClipboard('png')",
    true
  );
  console.log("[self-test] clipboard", clipboardResult);

  const clipboardFallbackResult = await win.webContents.executeJavaScript(
    "window.__mermaidTool.debugCopyRasterToClipboardFallback('png')",
    true
  );
  console.log("[self-test] clipboard-fallback", clipboardFallbackResult);

  const pptxResult = await win.webContents.executeJavaScript(
    "window.__mermaidTool.debugWritePptx()",
    true
  );
  console.log("[self-test] pptx", pptxResult);
}

ipcMain.handle("save-text-file", async (_event, options) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: options.defaultPath,
    filters: options.filters
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  await writeFile(filePath, options.text, "utf8");
  return { canceled: false, filePath };
});

ipcMain.handle("open-text-file", async (_event, options) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: options.filters
  });

  if (canceled || !filePaths?.length) {
    return { canceled: true };
  }

  const filePath = filePaths[0];
  const text = await readFile(filePath, "utf8");
  return { canceled: false, filePath, text };
});

ipcMain.handle("save-binary-file", async (_event, options) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: options.defaultPath,
    filters: options.filters
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  await writeFile(filePath, Buffer.from(options.bytes));
  return { canceled: false, filePath };
});

ipcMain.handle("save-raster-from-svg", async (_event, options) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: options.defaultPath,
    filters: options.filters
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  const bytes = await rasterizeSvg(options.svg, options.format, options.quality ?? 95);
  await writeFile(filePath, bytes);
  return { canceled: false, filePath };
});

ipcMain.handle("debug-write-raster-from-svg", async (_event, options) => {
  const targetPath =
    options.filePath ??
    path.join(os.tmpdir(), `mermaid-tool-debug.${options.format === "png" ? "png" : "jpg"}`);

  const bytes = await rasterizeSvg(options.svg, options.format, options.quality ?? 95);
  await writeFile(targetPath, bytes);
  return { filePath: targetPath, size: bytes.byteLength };
});

ipcMain.handle("copy-raster-from-svg", async (_event, options) => {
  const bytes = await rasterizeSvg(options.svg, options.format, options.quality ?? 95);
  const image = nativeImage.createFromBuffer(bytes);

  if (image.isEmpty()) {
    throw new Error("Failed to write image to clipboard.");
  }

  clipboard.writeImage(image);
  return {
    ok: true,
    format: options.format,
    availableFormats: clipboard.availableFormats()
  };
});

ipcMain.handle("save-pptx-file", async (_event, options) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: options.defaultPath,
    filters: options.filters
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  const diagram = buildDiagram(options.source, options.mermaidConfig);
  await writeDiagramPptx(diagram, filePath);
  return { canceled: false, filePath };
});

ipcMain.handle("debug-write-pptx-file", async (_event, options) => {
  const targetPath = options.filePath ?? path.join(os.tmpdir(), "mermaid-tool-debug.pptx");
  const diagram = buildDiagram(options.source, options.mermaidConfig);
  await writeDiagramPptx(diagram, targetPath);
  return { filePath: targetPath };
});

async function rasterizeSvg(svg, format, quality) {
  const input = Buffer.from(svg, "utf8");
  const image = sharp(input, { density: 192 });

  if (format === "png") {
    return image.png().toBuffer();
  }

  return image.flatten({ background: "#ffffff" }).jpeg({ quality }).toBuffer();
}

function buildDiagram(source, mermaidConfigInput) {
  const mermaidConfig = normalizeMermaidConfig(mermaidConfigInput);
  const pptTheme = buildPptThemeFromMermaidConfig(mermaidConfig);

  if (/^\s*sequenceDiagram\b/i.test(source)) {
    const parsed = parseSequenceSource(source);
    return layoutSequence({
      ...parsed,
      source
    }, pptTheme.sequence);
  }

  const parsed = parseFlowchartSource(source);
  return layoutFlowchart({
    ...parsed,
    source
  }, pptTheme.flowchart);
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
