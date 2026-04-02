import { app } from "./context.js";
import {
  workspaceFileStorageKey,
  workspaceRootStorageKey,
  workspaceSortModeStorageKey,
  workspaceSidebarCollapsedStorageKey
} from "./constants.js";
import {
  basename,
  dirname,
  normalizeError,
  getDesktopApiOrThrow,
  getDocumentNameBase,
  isDrawioDocumentKind,
  renderDocumentState,
  setCurrentDocument,
  t,
  updateStatus,
  updateStatusByKey
} from "./common.js";
import { isSameOrDescendantPath, pointInsideElement, retriggerAnimation } from "./utils.js";
import {
  resolveDocumentKindFromPath,
  resolveWorkspaceFileTypeFromPath,
  getWorkspaceFileExtension
} from "../workspace-file-types.js";

export function initializeWorkspaceModule() {
  app.dom.projectsButton.addEventListener("click", () => void chooseWorkspaceDirectory());
  app.dom.workspaceRefreshButton.addEventListener("click", () => void refreshWorkspaceTree());
  app.dom.workspaceRail.addEventListener("click", () => toggleWorkspaceSidebar());
  app.dom.workspaceSortSelect.addEventListener("change", (event) => {
    void handleWorkspaceSortChange(event);
  });
  app.dom.newDocumentButton.addEventListener("click", () => void createWorkspaceFileAtRoot("mermaid"));
  app.dom.newDrawioDocumentButton.addEventListener("click", () => void createWorkspaceFileAtRoot("drawio"));
  app.dom.workspaceTree.addEventListener("click", (event) => {
    void handleWorkspaceTreeClick(event);
  });
  app.dom.workspaceTree.addEventListener("keydown", (event) => {
    void handleWorkspaceTreeKeydown(event);
  });
  app.dom.workspaceTree.addEventListener("contextmenu", (event) => handleWorkspaceTreeContextMenu(event));
  app.dom.workspaceContextMenu.addEventListener("keydown", (event) => handleWorkspaceContextMenuKeydown(event));
  app.dom.contextNewMermaidFileButton.addEventListener("click", () => void createWorkspaceEntryFromContext("file", "mermaid"));
  app.dom.contextNewDrawioFileButton.addEventListener("click", () => void createWorkspaceEntryFromContext("file", "drawio"));
  app.dom.contextNewFolderButton.addEventListener("click", () => void createWorkspaceEntryFromContext("directory"));
  app.dom.contextRenameButton.addEventListener("click", () => void renameWorkspaceEntryFromContext());
  app.dom.contextDeleteButton.addEventListener("click", () => void deleteWorkspaceEntryFromContext());
  app.dom.editorDocumentName.addEventListener("blur", () => {
    void renameCurrentDocumentFromInput();
  });
  document.addEventListener("pointerdown", (event) => handleGlobalPointerDown(event), true);
  window.addEventListener("mousemove", (event) => handleWorkspacePointerMove(event));
  window.addEventListener("mouseup", (event) => {
    void handleWorkspacePointerUp(event);
  });

  app.modules.workspace = {
    initializeWorkspaceState,
    chooseWorkspaceDirectory,
    refreshWorkspaceTree,
    openWorkspace,
    openWorkspaceFile,
    renderWorkspaceState,
    ensureWorkspaceSelected,
    reloadDirectory,
    closeWorkspaceContextMenu,
    applyWorkspaceSidebarState,
    toggleWorkspaceSidebar
  };
}

export async function initializeWorkspaceState() {
  const storedRoot = window.localStorage.getItem(workspaceRootStorageKey);
  if (!storedRoot) {
    renderWorkspaceState();
    return;
  }

  try {
    const preferredFile = window.localStorage.getItem(workspaceFileStorageKey);
    await openWorkspace(storedRoot, preferredFile);
  } catch (error) {
    console.warn("Failed to restore workspace:", error);
    app.state.currentWorkspace.rootPath = null;
    app.state.currentWorkspace.rootNode = null;
    app.state.currentWorkspace.nodesByPath.clear();
    app.state.currentWorkspace.childrenByPath.clear();
    app.state.currentWorkspace.loadedPaths.clear();
    app.state.currentWorkspace.expandedPaths.clear();
    renderWorkspaceState();
    app.modules.preview?.renderSampleIfIdle?.();
  }
}

export async function chooseWorkspaceDirectory() {
  try {
    if (!(await app.modules.ai?.rejectAiInlineWorkbench?.())) {
      return;
    }

    await app.modules.editor?.autoSaveCurrentDocumentIfPossible?.();
    const api = getDesktopApiOrThrow(["chooseWorkspaceDirectory"]);
    const result = await api.chooseWorkspaceDirectory({ sortMode: app.state.currentWorkspace.sortMode });
    if (result.canceled || !result.rootPath || !result.root || !result.children) {
      return;
    }

    await applyWorkspaceOpenResult(
      result.rootPath,
      result.root,
      result.children,
      window.localStorage.getItem(workspaceFileStorageKey),
      result.suggestedFilePath ?? null
    );
    updateStatusByKey("success", "status.workspaceBadge", "status.workspaceOpened", {
      path: result.rootPath
    });
  } catch (error) {
    updateStatus("error", t("status.workspaceErrorBadge"), normalizeError(error));
  }
}

export async function openWorkspace(rootPath, preferredFilePath = null) {
  const api = getDesktopApiOrThrow(["openWorkspace"]);
  const result = await api.openWorkspace({
    rootPath,
    sortMode: app.state.currentWorkspace.sortMode
  });

  await applyWorkspaceOpenResult(
    result.rootPath,
    result.root,
    result.children,
    preferredFilePath,
    result.suggestedFilePath ?? null
  );
  return true;
}

async function applyWorkspaceOpenResult(rootPath, rootNode, rootChildren, preferredFilePath, suggestedFilePath) {
  resetWorkspaceState(rootPath, rootNode);
  applyDirectoryChildren(rootPath, rootChildren);
  app.state.currentWorkspace.expandedPaths.add(rootPath);
  window.localStorage.setItem(workspaceRootStorageKey, rootPath);
  renderWorkspaceState();

  const targetFilePath = await resolveWorkspaceSelection(preferredFilePath, suggestedFilePath);
  if (targetFilePath) {
    await loadAncestorsForPath(targetFilePath);
    renderWorkspaceState();
    return openWorkspaceFile(targetFilePath, { skipAutosave: true });
  }

  app.modules.editor?.setEditorValue("", { silent: true });
  app.modules.preview?.clearPreviewSourceSelection?.({ render: false });
  app.modules.editor?.renderHighlightedCode?.();
  setCurrentDocument({
    name: "scratch.mmd",
    path: null,
    kind: "draft",
    dirty: false
  });
  app.modules.editor?.updateCursorStatus?.();
  app.modules.preview?.scheduleRender?.();
  return true;
}

function resetWorkspaceState(rootPath, rootNode) {
  app.state.currentWorkspace.rootPath = rootPath;
  app.state.currentWorkspace.rootNode = rootNode;
  app.state.currentWorkspace.nodesByPath = new Map([[rootPath, rootNode]]);
  app.state.currentWorkspace.childrenByPath = new Map();
  app.state.currentWorkspace.loadedPaths = new Set();
  app.state.currentWorkspace.expandedPaths = new Set();
  app.state.currentWorkspace.selectedPath = null;
}

function applyDirectoryChildren(directoryPath, children) {
  app.state.currentWorkspace.loadedPaths.add(directoryPath);
  const childPaths = [];

  for (const child of children ?? []) {
    app.state.currentWorkspace.nodesByPath.set(child.path, child);
    childPaths.push(child.path);
  }

  app.state.currentWorkspace.childrenByPath.set(directoryPath, childPaths);
}

async function resolveWorkspaceSelection(preferredFilePath, suggestedFilePath) {
  if (preferredFilePath && isWithinCurrentWorkspace(preferredFilePath)) {
    try {
      const api = getDesktopApiOrThrow(["readTextFile"]);
      await api.readTextFile({ filePath: preferredFilePath });
      return preferredFilePath;
    } catch {
      // Ignore and fall back to the first available workspace file.
    }
  }

  return suggestedFilePath;
}

function isWithinCurrentWorkspace(filePath) {
  const rootPath = app.state.currentWorkspace.rootPath;
  if (!rootPath || !filePath) {
    return false;
  }

  return filePath === rootPath || filePath.startsWith(`${rootPath}/`) || filePath.startsWith(`${rootPath}\\`);
}

async function loadAncestorsForPath(filePath) {
  const rootPath = app.state.currentWorkspace.rootPath;
  if (!rootPath || !filePath || !isWithinCurrentWorkspace(filePath)) {
    return;
  }

  const relative = filePath.slice(rootPath.length).replace(/^[/\\]/, "");
  if (!relative) {
    return;
  }

  const segments = relative.split(/[/\\]/);
  let currentPath = rootPath;
  app.state.currentWorkspace.expandedPaths.add(rootPath);

  for (const segment of segments.slice(0, -1)) {
    currentPath = `${currentPath}/${segment}`.replace(/\\/g, "/");
    await ensureDirectoryLoaded(currentPath);
    app.state.currentWorkspace.expandedPaths.add(currentPath);
  }
}

async function ensureDirectoryLoaded(directoryPath) {
  if (app.state.currentWorkspace.loadedPaths.has(directoryPath)) {
    return;
  }

  await reloadDirectory(directoryPath);
}

export async function reloadDirectory(directoryPath) {
  const api = getDesktopApiOrThrow(["readWorkspaceChildren"]);
  const result = await api.readWorkspaceChildren({
    directoryPath,
    sortMode: app.state.currentWorkspace.sortMode
  });
  applyDirectoryChildren(result.directoryPath, result.children);
}

export async function refreshWorkspaceTree() {
  if (!app.state.currentWorkspace.rootPath) {
    return;
  }

  try {
    await openWorkspace(app.state.currentWorkspace.rootPath, app.state.currentDocument.path);
    updateStatusByKey("success", "status.workspaceBadge", "status.workspaceRefreshed");
  } catch (error) {
    updateStatus("error", t("status.workspaceErrorBadge"), normalizeError(error));
  }
}

async function handleWorkspaceSortChange(event) {
  const nextSortMode = normalizeWorkspaceSortModeValue(event.currentTarget.value);
  if (nextSortMode === app.state.currentWorkspace.sortMode) {
    return;
  }

  app.state.currentWorkspace.sortMode = nextSortMode;
  window.localStorage.setItem(workspaceSortModeStorageKey, nextSortMode);

  if (!app.state.currentWorkspace.rootPath) {
    renderWorkspaceState();
    return;
  }

  try {
    await openWorkspace(app.state.currentWorkspace.rootPath, app.state.currentDocument.path);
    updateStatusByKey("success", "status.workspaceBadge", "status.workspaceSorted", {
      sortMode: describeWorkspaceSortMode(nextSortMode)
    });
  } catch (error) {
    updateStatus("error", t("status.workspaceErrorBadge"), normalizeError(error));
  }
}

function normalizeWorkspaceSortModeValue(sortMode) {
  return ["updated", "created"].includes(sortMode) ? sortMode : "name";
}

function describeWorkspaceSortMode(sortMode) {
  if (sortMode === "updated") {
    return t("workspace.sort.description.updated");
  }

  if (sortMode === "created") {
    return t("workspace.sort.description.created");
  }

  return t("workspace.sort.description.name");
}

export function applyWorkspaceSidebarState() {
  app.dom.workspaceMain.classList.toggle(
    "workspace-sidebar-collapsed",
    app.state.workspaceSidebarCollapsed
  );
  app.dom.workspaceRail.dataset.state = app.state.workspaceSidebarCollapsed
    ? "collapsed"
    : "expanded";
  app.dom.workspaceRail.setAttribute(
    "aria-expanded",
    String(!app.state.workspaceSidebarCollapsed)
  );
  app.dom.workspaceRail.setAttribute(
    "aria-label",
    app.state.workspaceSidebarCollapsed
      ? t("workspace.toggle.expand")
      : t("workspace.toggle.collapse")
  );
}

export function toggleWorkspaceSidebar() {
  app.state.workspaceSidebarCollapsed = !app.state.workspaceSidebarCollapsed;
  window.localStorage.setItem(
    workspaceSidebarCollapsedStorageKey,
    String(app.state.workspaceSidebarCollapsed)
  );
  applyWorkspaceSidebarState();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      app.modules.editor?.renderHighlightedCode?.();
      app.modules.preview?.fitPreviewToFrame?.({ resetViewport: true });
    });
  });
}

export function renderWorkspaceState() {
  const hasWorkspace = Boolean(app.state.currentWorkspace.rootPath);
  app.dom.newDocumentButton.disabled = !hasWorkspace;
  app.dom.newDrawioDocumentButton.disabled = !hasWorkspace;
  app.dom.workspaceRefreshButton.disabled = !hasWorkspace;
  app.dom.workspaceSortSelect.disabled = !hasWorkspace;
  app.dom.workspaceSortSelect.value = app.state.currentWorkspace.sortMode;
  app.dom.workspaceTree.innerHTML = "";
  app.dom.workspaceTree.classList.toggle(
    "workspace-tree-drop-root",
    app.state.workspaceDropTarget?.mode === "root"
  );
  app.dom.workspaceEmpty.classList.toggle(
    "workspace-tree-drop-root",
    app.state.workspaceDropTarget?.mode === "root"
  );

  if (!hasWorkspace || !app.state.currentWorkspace.rootNode) {
    app.dom.workspaceEmpty.hidden = false;
    app.dom.workspaceEmpty.textContent = t("workspace.empty.choose");
    return;
  }

  const rootChildren = getDirectoryChildren(app.state.currentWorkspace.rootPath);
  const fragment = document.createDocumentFragment();
  for (const child of rootChildren) {
    fragment.appendChild(renderWorkspaceNode(child, 0));
  }
  app.dom.workspaceTree.appendChild(fragment);

  const hasChildren = rootChildren.length > 0;
  app.dom.workspaceEmpty.hidden = hasChildren;
  if (!hasChildren) {
    app.dom.workspaceEmpty.textContent = t("workspace.empty.noFiles");
  }
}

function renderWorkspaceNode(node, depth) {
  const group = document.createElement("div");
  group.className = "tree-group";
  group.dataset.path = node.path;
  group.dataset.type = node.type;
  const isEditing = app.state.inlineRenameState?.path === node.path;

  const row = document.createElement("div");
  row.dataset.path = node.path;
  row.dataset.type = node.type;
  row.dataset.depth = String(depth);
  row.className = `tree-row ${node.type === "directory" ? "tree-row-directory" : "tree-row-file"}`;
  row.style.paddingLeft = `${10 + depth * 18}px`;
  row.setAttribute("role", "treeitem");
  row.setAttribute("aria-level", String(depth + 1));
  row.tabIndex = 0;
  if (!isEditing) {
    row.addEventListener("mousedown", (event) => handleWorkspacePointerDown(event));
  }

  if (node.type === "file" && app.state.currentDocument.path === node.path) {
    row.classList.add("tree-row-active");
    row.setAttribute("aria-selected", "true");
  } else if (node.type === "file") {
    row.setAttribute("aria-selected", "false");
  }

  if (app.state.workspaceDropTarget?.mode === "inside" && app.state.workspaceDropTarget.path === node.path) {
    row.classList.add("tree-row-drop-target");
  }

  if (node.type === "directory") {
    const expanded = app.state.currentWorkspace.expandedPaths.has(node.path);
    row.setAttribute("aria-expanded", String(expanded));
    const caret = document.createElement("span");
    caret.className = "tree-row-caret";
    caret.textContent = expanded ? "▾" : "▸";
    row.appendChild(caret);
  } else {
    const spacer = document.createElement("span");
    spacer.className = "tree-row-spacer";
    row.appendChild(spacer);
  }

  const icon = document.createElement("span");
  icon.className = "tree-row-icon";
  icon.textContent =
    node.type === "directory" ? "📁" : node.fileType === "drawio" ? "🧩" : "📄";
  row.appendChild(icon);

  if (isEditing) {
    row.classList.add("tree-row-editing");
    const editor = document.createElement("div");
    editor.className = "tree-row-inline-editor";

    const input = document.createElement("input");
    input.className = "tree-row-inline-input";
    input.type = "text";
    input.value = app.state.inlineRenameState.value;
    input.spellcheck = false;
    input.dataset.inlineRenamePath = node.path;
    input.setAttribute("aria-label", node.type === "file" ? t("rename.fileAria") : t("rename.folderAria"));
    input.addEventListener("input", (event) => {
      app.state.inlineRenameState = {
        ...app.state.inlineRenameState,
        value: event.currentTarget.value
      };
    });
    input.addEventListener("keydown", (event) => handleInlineRenameKeydown(event));
    input.addEventListener("blur", () => {
      void saveInlineRename();
    });
    editor.appendChild(input);

    if (node.type === "file") {
      const suffix = document.createElement("span");
      suffix.className = "tree-row-inline-suffix";
      suffix.textContent = getWorkspaceFileExtension(node.fileType ?? "mermaid");
      editor.appendChild(suffix);
    }

    row.appendChild(editor);
  } else {
    const label = document.createElement("span");
    label.className = "tree-row-label";
    label.textContent = node.name;
    row.appendChild(label);
  }

  group.appendChild(row);

  if (node.type === "directory" && app.state.currentWorkspace.expandedPaths.has(node.path)) {
    const children = document.createElement("div");
    children.className = "tree-children";
    children.setAttribute("role", "group");
    for (const child of getDirectoryChildren(node.path)) {
      children.appendChild(renderWorkspaceNode(child, depth + 1));
    }
    group.appendChild(children);
  }

  return group;
}

function getDirectoryChildren(directoryPath) {
  const childPaths = app.state.currentWorkspace.childrenByPath.get(directoryPath) ?? [];
  return childPaths
    .map((path) => app.state.currentWorkspace.nodesByPath.get(path))
    .filter(Boolean);
}

async function toggleDirectory(path) {
  if (app.state.currentWorkspace.expandedPaths.has(path)) {
    app.state.currentWorkspace.expandedPaths.delete(path);
    renderWorkspaceState();
    return;
  }

  await ensureDirectoryLoaded(path);
  app.state.currentWorkspace.expandedPaths.add(path);
  renderWorkspaceState();
}

async function handleWorkspaceTreeClick(event) {
  if (
    performance.now() < app.state.workspaceSuppressClickUntil ||
    performance.now() < app.state.menuDismissGuardUntil
  ) {
    return;
  }

  const row = event.target.closest(".tree-row");
  if (!row || event.target.closest(".tree-row-inline-editor")) {
    return;
  }

  closeWorkspaceContextMenu();
  app.modules.export?.setExportMenuOpen?.(false);

  const { path, type } = row.dataset;
  if (type === "directory") {
    await toggleDirectory(path);
    return;
  }

  await openWorkspaceFile(path);
}

async function handleWorkspaceTreeKeydown(event) {
  const row = event.target.closest(".tree-row");
  if (!row || event.target.closest(".tree-row-inline-editor")) {
    return;
  }

  const rows = getVisibleTreeRows();
  const index = rows.indexOf(row);
  if (event.key === "ArrowDown" && index >= 0) {
    event.preventDefault();
    rows[Math.min(rows.length - 1, index + 1)]?.focus({ preventScroll: true });
    return;
  }

  if (event.key === "ArrowUp" && index >= 0) {
    event.preventDefault();
    rows[Math.max(0, index - 1)]?.focus({ preventScroll: true });
    return;
  }

  const { path, type } = row.dataset;
  if (event.key === "ArrowRight" && type === "directory") {
    event.preventDefault();
    if (!app.state.currentWorkspace.expandedPaths.has(path)) {
      await toggleDirectory(path);
    }
    return;
  }

  if (event.key === "ArrowLeft" && type === "directory") {
    event.preventDefault();
    if (app.state.currentWorkspace.expandedPaths.has(path)) {
      await toggleDirectory(path);
    }
    return;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (type === "directory") {
      await toggleDirectory(path);
    } else {
      await openWorkspaceFile(path);
    }
  }
}

function getVisibleTreeRows() {
  return Array.from(app.dom.workspaceTree.querySelectorAll(".tree-row"));
}

function handleWorkspaceTreeContextMenu(event) {
  const row = event.target.closest(".tree-row");
  if (!app.state.currentWorkspace.rootPath) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  app.modules.export?.setExportMenuOpen?.(false);
  const rowPath = row?.dataset.path;
  const rowType = row?.dataset.type;
  app.state.contextMenuTarget = {
    path: rowPath ?? app.state.currentWorkspace.rootPath,
    type: rowType ?? "directory",
    parentPath:
      rowType === "file" && rowPath
        ? dirname(rowPath)
        : rowPath ?? app.state.currentWorkspace.rootPath
  };
  app.dom.contextRenameButton.hidden = !Boolean(rowPath);
  app.dom.contextDeleteButton.hidden = !Boolean(rowPath);
  app.dom.workspaceContextMenu.hidden = false;
  app.dom.workspaceContextMenu.style.left = `${event.clientX}px`;
  app.dom.workspaceContextMenu.style.top = `${event.clientY}px`;
  app.state.menuDismissGuardUntil = performance.now() + 600;
  app.state.workspaceSuppressClickUntil = performance.now() + 600;
  retriggerAnimation(app.dom.workspaceContextMenu, "menu-animate-in", { removeAfterMs: 0 });
  queueMicrotask(() => {
    getVisibleWorkspaceContextMenuItems()[0]?.focus({ preventScroll: true });
  });
}

function handleGlobalPointerDown(event) {
  if (event.button !== 0) {
    return;
  }

  if (performance.now() < app.state.menuDismissGuardUntil) {
    return;
  }

  if (!app.dom.workspaceContextMenu.hidden && !app.dom.workspaceContextMenu.contains(event.target)) {
    closeWorkspaceContextMenu();
  }

  if (!app.dom.exportMenu.hidden && !app.dom.exportMenu.contains(event.target) && event.target !== app.dom.exportButton) {
    app.modules.export?.setExportMenuOpen?.(false);
  }
}

export function closeWorkspaceContextMenu() {
  app.dom.workspaceContextMenu.hidden = true;
  app.state.contextMenuTarget = null;
}

function getVisibleWorkspaceContextMenuItems() {
  return app.dom.workspaceContextMenuItems.filter((item) => !item.hidden && !item.disabled);
}

function handleWorkspaceContextMenuKeydown(event) {
  const visibleItems = getVisibleWorkspaceContextMenuItems();
  if (!visibleItems.length) {
    return;
  }

  const currentIndex = visibleItems.indexOf(document.activeElement);
  if (event.key === "Escape") {
    event.preventDefault();
    closeWorkspaceContextMenu();
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
    closeWorkspaceContextMenu();
    return;
  }

  if ((event.key === "Enter" || event.key === " ") && app.dom.workspaceContextMenu.contains(event.target)) {
    event.preventDefault();
    document.activeElement?.click?.();
  }
}

function handleWorkspacePointerDown(event) {
  if (event.button !== 0 || app.state.inlineRenameState) {
    return;
  }

  const row = event.currentTarget.closest(".tree-row");
  if (!row) {
    return;
  }

  event.preventDefault();
  app.state.workspaceDragState = {
    path: row.dataset.path,
    type: row.dataset.type,
    startX: event.clientX,
    startY: event.clientY,
    active: false
  };
  setWorkspaceDropTarget(null);
}

function handleWorkspacePointerMove(event) {
  if (!app.state.workspaceDragState || !app.state.currentWorkspace.rootPath) {
    return;
  }

  const deltaX = event.clientX - app.state.workspaceDragState.startX;
  const deltaY = event.clientY - app.state.workspaceDragState.startY;
  if (!app.state.workspaceDragState.active) {
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < 6) {
      return;
    }

    app.state.workspaceDragState.active = true;
    app.state.workspaceSuppressClickUntil = performance.now() + 300;
    syncWorkspaceDragSourceClasses();
    app.dom.workspaceMain.classList.add("workspace-drag-active");
  } else {
    event.preventDefault();
  }

  const nextTarget = resolveWorkspaceDropTargetFromPoint(event.clientX, event.clientY);
  if (
    !nextTarget ||
    !canDropWorkspaceEntry(app.state.workspaceDragState.path, nextTarget.path)
  ) {
    setWorkspaceDropTarget(null);
    return;
  }

  setWorkspaceDropTarget(nextTarget);
}

async function handleWorkspacePointerUp(event) {
  if (!app.state.workspaceDragState) {
    return;
  }

  const dragState = app.state.workspaceDragState;
  const nextTarget = dragState.active
    ? resolveWorkspaceDropTargetFromPoint(event.clientX, event.clientY)
    : null;
  clearWorkspaceDragState();

  if (!dragState.active) {
    return;
  }

  if (!nextTarget || !canDropWorkspaceEntry(dragState.path, nextTarget.path)) {
    return;
  }

  try {
    await moveWorkspaceEntryToTarget(dragState.path, nextTarget.path);
  } catch (error) {
    updateStatus("error", t("status.moveErrorBadge"), normalizeError(error));
  }
}

function clearWorkspaceDragState() {
  app.state.workspaceDragState = null;
  setWorkspaceDropTarget(null);
  syncWorkspaceDragSourceClasses();
  app.dom.workspaceMain.classList.remove("workspace-drag-active");
}

function setWorkspaceDropTarget(nextTarget) {
  const previousKey = app.state.workspaceDropTarget
    ? `${app.state.workspaceDropTarget.mode}:${app.state.workspaceDropTarget.path}:${app.state.workspaceDropTarget.anchorPath ?? ""}`
    : "";
  const nextKey = nextTarget
    ? `${nextTarget.mode}:${nextTarget.path}:${nextTarget.anchorPath ?? ""}`
    : "";
  if (previousKey === nextKey) {
    return;
  }

  app.state.workspaceDropTarget = nextTarget;
  syncWorkspaceDropTargetClasses();
}

function syncWorkspaceDropTargetClasses() {
  app.dom.workspaceTree.classList.toggle(
    "workspace-tree-drop-root",
    app.state.workspaceDropTarget?.mode === "root"
  );
  app.dom.workspaceEmpty.classList.toggle(
    "workspace-tree-drop-root",
    app.state.workspaceDropTarget?.mode === "root"
  );

  for (const row of app.dom.workspaceTree.querySelectorAll(".tree-row.tree-row-drop-target")) {
    row.classList.remove("tree-row-drop-target");
  }

  for (const group of app.dom.workspaceTree.querySelectorAll(".tree-group.tree-group-drop-target")) {
    group.classList.remove("tree-group-drop-target");
  }

  if (!app.state.workspaceDropTarget) {
    return;
  }

  let targetPath = null;
  let targetMode = null;
  if (app.state.workspaceDropTarget.mode === "inside") {
    targetPath = app.state.workspaceDropTarget.path;
    targetMode = "inside";
  } else if (app.state.workspaceDropTarget.mode === "sibling") {
    targetPath = app.state.workspaceDropTarget.path;
    targetMode = "sibling";
  }

  if (!targetPath) {
    return;
  }

  if (targetPath === app.state.currentWorkspace.rootPath) {
    app.dom.workspaceTree.classList.add("workspace-tree-drop-root");
    app.dom.workspaceEmpty.classList.add("workspace-tree-drop-root");
    return;
  }

  if (targetMode === "inside") {
    const rowSelector = `.tree-row[data-path="${CSS.escape(targetPath)}"]`;
    app.dom.workspaceTree.querySelector(rowSelector)?.classList.add("tree-row-drop-target");
  }

  const groupSelector = `.tree-group[data-path="${CSS.escape(targetPath)}"][data-type="directory"]`;
  app.dom.workspaceTree.querySelector(groupSelector)?.classList.add("tree-group-drop-target");
}

function syncWorkspaceDragSourceClasses() {
  for (const row of app.dom.workspaceTree.querySelectorAll(".tree-row.tree-row-dragging-source")) {
    row.classList.remove("tree-row-dragging-source");
  }

  if (!app.state.workspaceDragState?.active || !app.state.workspaceDragState.path) {
    return;
  }

  const selector = `.tree-row[data-path="${CSS.escape(app.state.workspaceDragState.path)}"]`;
  app.dom.workspaceTree.querySelector(selector)?.classList.add("tree-row-dragging-source");
}

function resolveWorkspaceDropTargetFromPoint(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  const row = element?.closest(".tree-row");
  if (row?.dataset.type === "directory") {
    return {
      mode: "inside",
      path: row.dataset.path
    };
  }

  if (row) {
    return {
      mode: "sibling",
      path: dirname(row.dataset.path),
      anchorPath: row.dataset.path
    };
  }

  if (
    pointInsideElement(app.dom.workspaceTree, clientX, clientY) ||
    pointInsideElement(app.dom.workspaceEmpty, clientX, clientY)
  ) {
    return {
      mode: "root",
      path: app.state.currentWorkspace.rootPath
    };
  }

  return null;
}

function canDropWorkspaceEntry(sourcePath, targetParentPath) {
  if (!sourcePath || !targetParentPath) {
    return false;
  }

  if (sourcePath === targetParentPath) {
    return false;
  }

  if (dirname(sourcePath) === targetParentPath) {
    return false;
  }

  return !isSameOrDescendantPath(targetParentPath, sourcePath);
}

async function moveWorkspaceEntryToTarget(sourcePath, targetParentPath) {
  const affectsCurrentDocument = isSameOrDescendantPath(
    app.state.currentDocument.path,
    sourcePath
  );
  if (affectsCurrentDocument) {
    await app.modules.editor?.autoSaveCurrentDocumentIfPossible?.();
  }

  const api = getDesktopApiOrThrow(["moveWorkspaceEntry"]);
  const result = await api.moveWorkspaceEntry({
    path: sourcePath,
    targetParentPath,
    rootPath: app.state.currentWorkspace.rootPath
  });

  const preferredPath =
    remapMovedPath(app.state.currentDocument.path, sourcePath, result.path) ??
    app.state.currentDocument.path;
  await openWorkspace(app.state.currentWorkspace.rootPath, preferredPath);
  updateStatusByKey("success", "status.movedBadge", "status.workspaceMoved", {
    name: basename(sourcePath)
  });
}

function remapMovedPath(originalPath, sourcePath, targetPath) {
  if (!originalPath) {
    return null;
  }

  if (originalPath === sourcePath) {
    return targetPath;
  }

  if (!isSameOrDescendantPath(originalPath, sourcePath)) {
    return originalPath;
  }

  return `${targetPath}${originalPath.slice(sourcePath.length)}`;
}

async function createWorkspaceFileAtRoot(fileType) {
  if (!(await ensureWorkspaceSelected())) {
    return;
  }

  app.state.contextMenuTarget = {
    path: app.state.currentWorkspace.rootPath,
    type: "directory",
    parentPath: app.state.currentWorkspace.rootPath
  };
  await createWorkspaceEntryFromContext("file", fileType);
}

async function createWorkspaceEntryFromContext(kind, fileType = "mermaid") {
  if (!app.state.contextMenuTarget) {
    return;
  }

  const targetParentPath = app.state.contextMenuTarget.parentPath;
  closeWorkspaceContextMenu();

  try {
    const api = getDesktopApiOrThrow(["createWorkspaceEntry"]);
    const result = await api.createWorkspaceEntry({
      parentPath: targetParentPath,
      kind,
      fileType
    });

    await reloadDirectory(targetParentPath);
    app.state.currentWorkspace.expandedPaths.add(targetParentPath);
    renderWorkspaceState();

    if (result.kind === "file") {
      await openWorkspaceFile(result.path, { skipAutosave: true });
    }

    updateStatusByKey("success", "status.createdBadge", "status.workspaceCreated", {
      name: basename(result.path)
    });
  } catch (error) {
    updateStatus("error", t("status.workspaceErrorBadge"), normalizeError(error));
  }
}

async function renameWorkspaceEntryFromContext() {
  if (!app.state.contextMenuTarget?.path) {
    return;
  }

  const target = { ...app.state.contextMenuTarget };
  closeWorkspaceContextMenu();
  const currentName = basename(target.path);
  app.state.inlineRenameState = {
    path: target.path,
    type: target.type,
    value: target.type === "file" ? getDocumentNameBase(currentName) : currentName
  };
  renderWorkspaceState();
  queueMicrotask(() => {
    const selector = `[data-inline-rename-path="${CSS.escape(target.path)}"]`;
    const input = app.dom.workspaceTree.querySelector(selector);
    input?.focus();
    input?.select();
  });
}

async function deleteWorkspaceEntryFromContext() {
  if (!app.state.contextMenuTarget?.path) {
    return;
  }

  const target = { ...app.state.contextMenuTarget };
  closeWorkspaceContextMenu();

  try {
    const deletingCurrentFile = app.state.currentDocument.path === target.path;
    if (deletingCurrentFile) {
      await app.modules.editor?.autoSaveCurrentDocumentIfPossible?.();
    }

    const api = getDesktopApiOrThrow(["deleteWorkspaceEntry"]);
    await api.deleteWorkspaceEntry({
      path: target.path,
      rootPath: app.state.currentWorkspace.rootPath
    });

    await reloadDirectory(dirname(target.path));
    renderWorkspaceState();

    if (deletingCurrentFile) {
      setCurrentDocument({
        name: "scratch.mmd",
        path: null,
        kind: "draft",
        dirty: false
      });
      app.modules.editor?.setEditorValue("", { silent: true });
      app.modules.preview?.scheduleRender?.();
    }

    updateStatusByKey("success", "status.archivedBadge", "status.workspaceArchived", {
      name: basename(target.path)
    });
  } catch (error) {
    updateStatus("error", t("status.deleteErrorBadge"), normalizeError(error));
  }
}

function handleInlineRenameKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    void saveInlineRename();
  }

  if (event.key === "Escape") {
    event.preventDefault();
    cancelInlineRename();
  }
}

function cancelInlineRename() {
  app.state.inlineRenameState = null;
  renderWorkspaceState();
}

async function saveInlineRename() {
  if (!app.state.inlineRenameState?.path) {
    return;
  }

  const target = { ...app.state.inlineRenameState };
  const nextName =
    target.type === "file" ? getDocumentNameBase(target.value.trim()) : target.value.trim();
  if (!nextName) {
    return;
  }

  try {
    const api = getDesktopApiOrThrow(["renameWorkspaceEntry"]);
    const result = await api.renameWorkspaceEntry({
      path: target.path,
      nextName
    });

    app.state.inlineRenameState = null;
    await reloadDirectory(dirname(target.path));
    renderWorkspaceState();

    if (app.state.currentDocument.path === target.path) {
      setCurrentDocument({
        name: basename(result.path),
        path: result.path
      });
    }

    updateStatusByKey("success", "status.renamedBadge", "status.workspaceRenamed", {
      name: basename(result.path)
    });
  } catch (error) {
    cancelInlineRename();
    updateStatus("error", t("status.renameErrorBadge"), normalizeError(error));
  }
}

async function renameCurrentDocumentFromInput() {
  if (!app.state.currentDocument.path) {
    return;
  }

  const nextName = getDocumentNameBase(app.dom.editorDocumentName.value.trim());
  if (!nextName) {
    app.dom.editorDocumentName.value = getDocumentNameBase(app.state.currentDocument.name);
    return;
  }

  try {
    await app.modules.editor?.autoSaveCurrentDocumentIfPossible?.();
    const api = getDesktopApiOrThrow(["renameWorkspaceEntry"]);
    const result = await api.renameWorkspaceEntry({
      path: app.state.currentDocument.path,
      nextName
    });

    await reloadDirectory(dirname(app.state.currentDocument.path));
    setCurrentDocument({
      name: basename(result.path),
      path: result.path
    });
    renderWorkspaceState();
    updateStatusByKey("success", "status.renamedBadge", "status.workspaceFileRenamed", {
      name: basename(result.path)
    });
  } catch (error) {
    app.dom.editorDocumentName.value = getDocumentNameBase(app.state.currentDocument.name);
    updateStatus("error", t("status.renameErrorBadge"), normalizeError(error));
  }
}

export async function ensureWorkspaceSelected() {
  if (app.state.currentWorkspace.rootPath) {
    return true;
  }

  await chooseWorkspaceDirectory();
  return Boolean(app.state.currentWorkspace.rootPath);
}

export async function openWorkspaceFile(filePath, options = {}) {
  try {
    if (!(await app.modules.ai?.rejectAiInlineWorkbench?.({ focusButton: false }))) {
      return false;
    }

    if (!options.skipAutosave) {
      await app.modules.editor?.autoSaveCurrentDocumentIfPossible?.();
    }

    const api = getDesktopApiOrThrow(["readTextFile"]);
    const result = await api.readTextFile({ filePath });
    app.modules.preview?.clearPreviewSourceSelection?.({ render: false });
    const nextKind = resolveDocumentKindFromPath(result.filePath);

    if (isDrawioDocumentKind(nextKind)) {
      app.modules.editor?.setEditorValue("", { silent: true });
      setCurrentDocument({
        name: basename(result.filePath),
        path: result.filePath,
        kind: nextKind,
        dirty: false
      });
      app.state.currentWorkspace.selectedPath = result.filePath;
      app.modules.editor?.renderHighlightedCode?.();
      app.modules.editor?.updateCursorStatus?.();
      const drawioEditor = app.modules.editor?.ensureDrawioEditor?.();
      await drawioEditor?.openDocument({
        filePath: result.filePath,
        xml: result.text,
        title: getDocumentNameBase(basename(result.filePath))
      });
    } else {
      app.modules.editor?.setEditorValue(result.text, { silent: true });
      app.modules.editor?.renderHighlightedCode?.();
      app.modules.editor?.updateCursorStatus?.();
      setCurrentDocument({
        name: basename(result.filePath),
        path: result.filePath,
        kind: nextKind,
        dirty: false
      });
      app.state.currentWorkspace.selectedPath = result.filePath;
      app.modules.preview?.scheduleRender?.();
    }

    renderWorkspaceState();
    return true;
  } catch (error) {
    updateStatus("error", t("status.fileErrorBadge"), normalizeError(error));
    return false;
  }
}
