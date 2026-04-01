export const WORKSPACE_FILE_TYPES = Object.freeze({
  mermaid: Object.freeze({
    id: "mermaid",
    extension: ".mmd",
    documentKind: "mermaid-file"
  }),
  drawio: Object.freeze({
    id: "drawio",
    extension: ".drawio",
    documentKind: "drawio-file"
  })
});

export const DEFAULT_WORKSPACE_FILE_TYPE = "mermaid";
export const DEFAULT_MERMAID_FILE_CONTENT = "flowchart TD\n";

export function normalizeWorkspaceFileType(fileType) {
  return fileType === "drawio" ? "drawio" : DEFAULT_WORKSPACE_FILE_TYPE;
}

export function getWorkspaceFileTypeConfig(fileType) {
  return WORKSPACE_FILE_TYPES[normalizeWorkspaceFileType(fileType)];
}

export function getWorkspaceFileExtension(fileType) {
  return getWorkspaceFileTypeConfig(fileType).extension;
}

export function getDocumentKindForWorkspaceFileType(fileType) {
  return getWorkspaceFileTypeConfig(fileType).documentKind;
}

export function getWorkspaceFileTypeForDocumentKind(kind) {
  return kind === WORKSPACE_FILE_TYPES.drawio.documentKind ? "drawio" : "mermaid";
}

export function isSupportedWorkspaceFileName(name) {
  return Boolean(resolveWorkspaceFileTypeFromName(name));
}

export function resolveWorkspaceFileTypeFromName(name) {
  const normalizedName = String(name ?? "").toLowerCase();

  if (normalizedName.endsWith(WORKSPACE_FILE_TYPES.drawio.extension)) {
    return WORKSPACE_FILE_TYPES.drawio.id;
  }

  if (normalizedName.endsWith(WORKSPACE_FILE_TYPES.mermaid.extension)) {
    return WORKSPACE_FILE_TYPES.mermaid.id;
  }

  return null;
}

export function resolveWorkspaceFileTypeFromPath(filePath) {
  const segments = String(filePath ?? "").split(/[/\\]/);
  return resolveWorkspaceFileTypeFromName(segments[segments.length - 1] ?? "");
}

export function resolveDocumentKindFromPath(filePath) {
  const fileType = resolveWorkspaceFileTypeFromPath(filePath);
  return fileType ? getDocumentKindForWorkspaceFileType(fileType) : "draft";
}

export function stripSupportedWorkspaceExtension(name) {
  const value = String(name ?? "");
  const fileType = resolveWorkspaceFileTypeFromName(value);

  if (!fileType) {
    return value;
  }

  return value.slice(0, -getWorkspaceFileExtension(fileType).length);
}

export function ensureWorkspaceFileName(name, fileType) {
  const normalizedName = String(name ?? "").trim();
  const extension = getWorkspaceFileExtension(fileType);

  if (normalizedName.toLowerCase().endsWith(extension)) {
    return normalizedName;
  }

  return `${normalizedName}${extension}`;
}
