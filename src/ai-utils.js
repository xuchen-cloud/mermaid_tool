const MERMAID_DECLARATION_PATTERN =
  /^\s*(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie(?:\s+showData)?|mindmap|timeline|quadrantChart|requirementDiagram|gitGraph|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|architecture-beta|packet-beta|xychart-beta|kanban|block-beta|sankey-beta)\b/i;

export function normalizeAiBaseUrl(value) {
  return String(value ?? "").trim().replace(/\/+$/u, "");
}

export function sanitizeAiMermaidText(value) {
  let text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  const fencedMatch = text.match(/```(?:mermaid)?\s*([\s\S]*?)```/iu);
  if (fencedMatch?.[1]) {
    text = fencedMatch[1].trim();
  }

  const lines = text.split(/\r?\n/u);
  const startIndex = lines.findIndex((line) => MERMAID_DECLARATION_PATTERN.test(line));
  if (startIndex > 0) {
    text = lines.slice(startIndex).join("\n").trim();
  }

  return text;
}

export function hasMeaningfulDiagram(source, sampleCode = "") {
  const normalizedSource = String(source ?? "").trim();
  if (!normalizedSource) {
    return false;
  }

  const normalizedSample = String(sampleCode ?? "").trim();
  return !normalizedSample || normalizedSource !== normalizedSample;
}

export function validateAiSettingsDraft(draft) {
  const enabled = Boolean(draft?.enabled);
  const normalized = {
    enabled,
    baseUrl: normalizeAiBaseUrl(draft?.baseUrl),
    model: String(draft?.model ?? "").trim(),
    token: String(draft?.token ?? "").trim(),
    tokenConfigured: Boolean(draft?.tokenConfigured),
    clearToken: Boolean(draft?.clearToken)
  };
  const missing = [];

  if (enabled && !normalized.baseUrl) {
    missing.push("baseUrl");
  }

  if (enabled && !normalized.model) {
    missing.push("model");
  }

  const hasTokenAfterSave =
    Boolean(normalized.token) || (normalized.tokenConfigured && !normalized.clearToken);

  if (enabled && !hasTokenAfterSave) {
    missing.push("token");
  }

  return {
    ...normalized,
    valid: missing.length === 0,
    missing
  };
}

export function buildAiRequestPayload({
  prompt,
  mode,
  currentCode,
  previousCode,
  validationError
}) {
  const normalizedPrompt = String(prompt ?? "").trim();
  const mergeMode = mode === "merge";
  const normalizedCurrentCode = mergeMode ? String(currentCode ?? "").trim() : "";
  const normalizedPreviousCode = sanitizeAiMermaidText(previousCode);
  const normalizedValidationError = String(validationError ?? "").trim();

  return {
    prompt: normalizedPrompt,
    mergeMode,
    currentCode: normalizedCurrentCode || null,
    previousCode: normalizedPreviousCode || null,
    validationError: normalizedValidationError || null
  };
}

export function buildLineDiffSummary(currentCode, nextCode) {
  const before = splitLines(currentCode);
  const after = splitLines(nextCode);
  let prefix = 0;

  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const removed = before.slice(prefix, before.length - suffix);
  const added = after.slice(prefix, after.length - suffix);
  const hasChanges = removed.length > 0 || added.length > 0;

  return {
    hasChanges,
    prefixCount: prefix,
    suffixCount: suffix,
    removedCount: removed.length,
    addedCount: added.length,
    removedBlock: removed.join("\n"),
    addedBlock: added.join("\n")
  };
}

function splitLines(value) {
  const text = String(value ?? "");
  if (!text) {
    return [];
  }

  return text.replace(/\r\n/gu, "\n").split("\n");
}
