const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  chooseWorkspaceDirectory: () => ipcRenderer.invoke("choose-workspace-directory"),
  readWorkspaceTree: (options) => ipcRenderer.invoke("read-workspace-tree", options),
  createWorkspaceEntry: (options) => ipcRenderer.invoke("create-workspace-entry", options),
  readTextFile: (options) => ipcRenderer.invoke("read-text-file", options),
  saveTextFile: (options) => ipcRenderer.invoke("save-text-file", options),
  writeTextFile: (options) => ipcRenderer.invoke("write-text-file", options),
  openTextFile: (options) => ipcRenderer.invoke("open-text-file", options),
  saveBinaryFile: ({ defaultPath, filters, buffer }) =>
    ipcRenderer.invoke("save-binary-file", {
      defaultPath,
      filters,
      bytes: Array.from(new Uint8Array(buffer))
    }),
  saveRasterFromSvg: (options) => ipcRenderer.invoke("save-raster-from-svg", options),
  debugWriteRasterFromSvg: (options) =>
    ipcRenderer.invoke("debug-write-raster-from-svg", options),
  copyRasterFromSvg: (options) => ipcRenderer.invoke("copy-raster-from-svg", options),
  savePptxFile: (options) => ipcRenderer.invoke("save-pptx-file", options),
  debugWritePptxFile: (options) => ipcRenderer.invoke("debug-write-pptx-file", options)
});
