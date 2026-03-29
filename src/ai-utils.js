const MERMAID_DECLARATION_PATTERN =
  /^\s*(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie(?:\s+showData)?|mindmap|timeline|quadrantChart|requirementDiagram|gitGraph|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|architecture-beta|packet-beta|xychart-beta|kanban|block-beta|sankey-beta)\b/i;
const FLOWCHART_DECLARATION_PATTERN = /^\s*(?:flowchart|graph)\b/i;

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

  return normalizeAiMermaidCompatibility(text);
}

export function normalizeAiMermaidCompatibility(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  if (!FLOWCHART_DECLARATION_PATTERN.test(text)) {
    return text;
  }

  return text
    .split(/\r?\n/u)
    .map((line, index) => (index === 0 ? line : normalizeFlowchartNodeLabels(line)))
    .join("\n");
}

export function hasMeaningfulDiagram(source, sampleCode = "") {
  const normalizedSource = String(source ?? "").trim();
  if (!normalizedSource) {
    return false;
  }

  const normalizedSample = String(sampleCode ?? "").trim();
  return !normalizedSample || normalizedSource !== normalizedSample;
}

export function resolveAiActionMode(source) {
  return String(source ?? "").trim() ? "modify" : "new";
}

export function validateAiSettingsDraft(draft) {
  const enabled = Boolean(draft?.enabled);
  const normalized = {
    enabled,
    baseUrl: normalizeAiBaseUrl(draft?.baseUrl),
    model: String(draft?.model ?? "").trim(),
    systemPromptTemplate: String(draft?.systemPromptTemplate ?? "").trim(),
    userPromptTemplate: String(draft?.userPromptTemplate ?? "").trim(),
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
  validationError,
  requestToken
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
    validationError: normalizedValidationError || null,
    requestToken: Number.isInteger(requestToken) ? requestToken : null
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

export function buildUnifiedDiffLines(currentCode, nextCode) {
  const before = splitLines(currentCode);
  const after = splitLines(nextCode);
  const lcs = buildLcsMatrix(before, after);
  const diffLines = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  let beforeLineNumber = 1;
  let afterLineNumber = 1;

  while (beforeIndex < before.length && afterIndex < after.length) {
    if (before[beforeIndex] === after[afterIndex]) {
      diffLines.push({
        type: "context",
        beforeNumber: beforeLineNumber,
        afterNumber: afterLineNumber,
        text: after[afterIndex]
      });
      beforeIndex += 1;
      afterIndex += 1;
      beforeLineNumber += 1;
      afterLineNumber += 1;
      continue;
    }

    if (lcs[beforeIndex + 1][afterIndex] >= lcs[beforeIndex][afterIndex + 1]) {
      diffLines.push({
        type: "remove",
        beforeNumber: beforeLineNumber,
        afterNumber: null,
        text: before[beforeIndex]
      });
      beforeIndex += 1;
      beforeLineNumber += 1;
      continue;
    }

    diffLines.push({
      type: "add",
      beforeNumber: null,
      afterNumber: afterLineNumber,
      text: after[afterIndex]
    });
    afterIndex += 1;
    afterLineNumber += 1;
  }

  while (beforeIndex < before.length) {
    diffLines.push({
      type: "remove",
      beforeNumber: beforeLineNumber,
      afterNumber: null,
      text: before[beforeIndex]
    });
    beforeIndex += 1;
    beforeLineNumber += 1;
  }

  while (afterIndex < after.length) {
    diffLines.push({
      type: "add",
      beforeNumber: null,
      afterNumber: afterLineNumber,
      text: after[afterIndex]
    });
    afterIndex += 1;
    afterLineNumber += 1;
  }

  return diffLines;
}

export function buildUnifiedDiffModel(currentCode, nextCode) {
  const diffLines = buildUnifiedDiffLines(currentCode, nextCode);
  const after = splitLines(nextCode);
  const draftLineDecorations = [];
  const deletionWidgets = [];
  let pendingRemoved = [];

  const flushRemoved = (anchorLine) => {
    if (!pendingRemoved.length) {
      return;
    }

    deletionWidgets.push({
      anchorDraftLine: anchorLine,
      removedLines: pendingRemoved,
      widgetKey: `${anchorLine}:${pendingRemoved
        .map((line) => `${line.beforeNumber ?? ""}:${line.text}`)
        .join("|")}`
    });
    pendingRemoved = [];
  };

  for (const line of diffLines) {
    if (line.type === "remove") {
      pendingRemoved.push({
        beforeNumber: line.beforeNumber,
        text: line.text
      });
      continue;
    }

    flushRemoved(line.afterNumber ?? after.length + 1);

    if (line.afterNumber) {
      draftLineDecorations.push({
        lineNumber: line.afterNumber,
        type: line.type
      });
    }
  }

  flushRemoved(after.length + 1);

  return {
    hasChanges: diffLines.some((line) => line.type !== "context"),
    diffLines,
    hunks: buildDiffHunks(diffLines),
    draftLineDecorations,
    deletionWidgets
  };
}

function normalizeFlowchartNodeLabels(line) {
  return line.replace(
    /(\b[A-Za-z_][A-Za-z0-9_]*\s*)\[([^\]\n"]*[()<>][^\]\n"]*)\]/gu,
    (_, prefix, label) => {
      const normalizedLabel = normalizeFlowchartLabelText(label);
      return `${prefix}["${escapeMermaidQuotedLabel(normalizedLabel)}"]`;
    }
  );
}

function normalizeFlowchartLabelText(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/giu, " / ")
    .replace(/\s+/gu, " ")
    .trim();
}

function escapeMermaidQuotedLabel(value) {
  return String(value ?? "").replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
}

function buildDiffHunks(diffLines) {
  const hunks = [];
  let currentHunk = null;

  for (const line of diffLines) {
    if (line.type === "context") {
      if (currentHunk) {
        currentHunk.lines.push(line);
      }
      continue;
    }

    if (!currentHunk) {
      currentHunk = { lines: [] };
      hunks.push(currentHunk);
    }

    currentHunk.lines.push(line);
  }

  return hunks;
}

function buildLcsMatrix(before, after) {
  const matrix = Array.from({ length: before.length + 1 }, () =>
    Array(after.length + 1).fill(0)
  );

  for (let beforeIndex = before.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = after.length - 1; afterIndex >= 0; afterIndex -= 1) {
      if (before[beforeIndex] === after[afterIndex]) {
        matrix[beforeIndex][afterIndex] = matrix[beforeIndex + 1][afterIndex + 1] + 1;
      } else {
        matrix[beforeIndex][afterIndex] = Math.max(
          matrix[beforeIndex + 1][afterIndex],
          matrix[beforeIndex][afterIndex + 1]
        );
      }
    }
  }

  return matrix;
}

function splitLines(value) {
  const text = String(value ?? "");
  if (!text) {
    return [];
  }

  return text.replace(/\r\n/gu, "\n").split("\n");
}
