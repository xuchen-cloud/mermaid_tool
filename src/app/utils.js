export function basename(filePath) {
  const segments = String(filePath ?? "").split(/[/\\]/);
  return segments[segments.length - 1] || String(filePath ?? "");
}

export function dirname(filePath) {
  const segments = String(filePath ?? "").split(/[/\\]/);
  segments.pop();
  return segments.join("/") || String(filePath ?? "");
}

export function normalizeError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function reportAppError(context, error) {
  console.error(`[app-error] ${context}`, error);
}

export function retriggerAnimation(element, className, options = {}) {
  if (!element) {
    return;
  }

  const removeAfterMs = options.removeAfterMs ?? 280;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  if (removeAfterMs > 0) {
    window.setTimeout(() => {
      element.classList.remove(className);
    }, removeAfterMs);
  }
}

export function pointInsideElement(element, clientX, clientY) {
  if (!element || element.hidden) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

export function isSameOrDescendantPath(candidatePath, targetPath) {
  if (!candidatePath || !targetPath) {
    return false;
  }

  return (
    candidatePath === targetPath ||
    candidatePath.startsWith(`${targetPath}/`) ||
    candidatePath.startsWith(`${targetPath}\\`)
  );
}

export function pathSeparator(filePath) {
  return String(filePath ?? "").includes("\\") ? "\\" : "/";
}

export function isEditableElement(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}
