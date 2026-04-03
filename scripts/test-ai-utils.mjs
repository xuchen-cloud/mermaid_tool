import assert from "node:assert/strict";

import {
  buildAiDrawioRequestPayload,
  buildAiRequestPayload,
  buildLineDiffSummary,
  buildUnifiedDiffModel,
  buildUnifiedDiffLines,
  hasMeaningfulDiagram,
  normalizeAiMermaidCompatibility,
  normalizeAiBaseUrl,
  resolveAiActionMode,
  sanitizeAiDrawioXml,
  sanitizeAiMermaidText,
  validateAiSettingsDraft
} from "../src/ai-utils.js";

runTest("normalizeAiBaseUrl trims and strips trailing slash", () => {
  assert.equal(normalizeAiBaseUrl(" https://api.openai.com/v1/ "), "https://api.openai.com/v1");
});

runTest("sanitizeAiMermaidText extracts fenced Mermaid", () => {
  const text = sanitizeAiMermaidText("Here you go\n```mermaid\nflowchart TD\nA-->B\n```");
  assert.equal(text, "flowchart TD\nA-->B");
});

runTest("sanitizeAiMermaidText normalizes risky flowchart labels for Mermaid parsing", () => {
  const text = sanitizeAiMermaidText(
    "flowchart TD\nA[开始：确定租房需求<br/>(预算/区域/房型/租期/是否允许宠物)] --> B[下一步]"
  );

  assert.equal(
    text,
    'flowchart TD\nA["开始：确定租房需求 / (预算/区域/房型/租期/是否允许宠物)"] --> B[下一步]'
  );
});

runTest("sanitizeAiDrawioXml extracts mxfile from fenced XML", () => {
  const text = sanitizeAiDrawioXml(
    'Here is the XML\n```xml\n<?xml version="1.0"?>\n<mxfile><diagram id="1"></diagram></mxfile>\n```'
  );

  assert.equal(text, '<mxfile><diagram id="1"></diagram></mxfile>');
});

runTest("normalizeAiMermaidCompatibility only rewrites flowchart labels", () => {
  const sequence = normalizeAiMermaidCompatibility(
    'sequenceDiagram\nAlice->>Bob: Start (details)'
  );

  assert.equal(sequence, 'sequenceDiagram\nAlice->>Bob: Start (details)');
});

runTest("validateAiSettingsDraft requires token only when enabled", () => {
  const disabled = validateAiSettingsDraft({
    enabled: false,
    baseUrl: "",
    model: "",
    token: "",
    tokenConfigured: false,
    clearToken: false
  });
  const enabled = validateAiSettingsDraft({
    enabled: true,
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    token: "",
    tokenConfigured: false,
    clearToken: false
  });

  assert.equal(disabled.valid, true);
  assert.equal(disabled.systemPromptTemplate, "");
  assert.equal(disabled.userPromptTemplate, "");
  assert.equal(enabled.valid, false);
  assert.deepEqual(enabled.missing, ["token"]);
});

runTest("buildAiRequestPayload preserves merge context for repair pass", () => {
  const payload = buildAiRequestPayload({
    prompt: "Add approval step",
    mode: "merge",
    currentCode: "flowchart TD\nA-->B",
    previousCode: "```mermaid\nflowchart TD\nA-->\n```",
    validationError: "Parse error"
  });

  assert.equal(payload.mergeMode, true);
  assert.equal(payload.currentCode, "flowchart TD\nA-->B");
  assert.equal(payload.previousCode, "flowchart TD\nA-->");
  assert.equal(payload.validationError, "Parse error");
});

runTest("buildAiDrawioRequestPayload preserves merge context for repair pass", () => {
  const payload = buildAiDrawioRequestPayload({
    prompt: "Add an approval swimlane",
    mode: "merge",
    currentXml: '<mxfile><diagram id="1"></diagram></mxfile>',
    previousXml: '```xml\n<mxfile><diagram id="2"></diagram></mxfile>\n```',
    validationError: "Invalid mxfile"
  });

  assert.equal(payload.mergeMode, true);
  assert.equal(payload.currentXml, '<mxfile><diagram id="1"></diagram></mxfile>');
  assert.equal(payload.previousXml, '<mxfile><diagram id="2"></diagram></mxfile>');
  assert.equal(payload.validationError, "Invalid mxfile");
});

runTest("buildLineDiffSummary isolates changed lines", () => {
  const diff = buildLineDiffSummary(
    "flowchart TD\nA-->B\nB-->C",
    "flowchart TD\nA-->B\nB-->D\nD-->C"
  );

  assert.equal(diff.hasChanges, true);
  assert.equal(diff.removedBlock, "B-->C");
  assert.equal(diff.addedBlock, "B-->D\nD-->C");
});

runTest("buildUnifiedDiffLines returns context, remove, and add entries", () => {
  const lines = buildUnifiedDiffLines(
    "flowchart TD\nA-->B\nB-->C",
    "flowchart TD\nA-->B\nB-->D\nD-->C"
  );

  assert.deepEqual(
    lines.map((line) => [line.type, line.beforeNumber, line.afterNumber, line.text]),
    [
      ["context", 1, 1, "flowchart TD"],
      ["context", 2, 2, "A-->B"],
      ["remove", 3, null, "B-->C"],
      ["add", null, 3, "B-->D"],
      ["add", null, 4, "D-->C"]
    ]
  );
});

runTest("buildUnifiedDiffModel exposes add decorations and anchored deletion blocks", () => {
  const model = buildUnifiedDiffModel(
    "flowchart TD\nA-->B\nB-->C",
    "flowchart TD\nA-->B\nB-->D\nD-->C"
  );

  assert.equal(model.hasChanges, true);
  assert.deepEqual(model.draftLineDecorations, [
    { lineNumber: 1, type: "context" },
    { lineNumber: 2, type: "context" },
    { lineNumber: 3, type: "add" },
    { lineNumber: 4, type: "add" }
  ]);
  assert.deepEqual(model.deletionWidgets, [
    {
      anchorDraftLine: 3,
      removedLines: [{ beforeNumber: 3, text: "B-->C" }],
      widgetKey: "3:3:B-->C"
    }
  ]);
});

runTest("buildUnifiedDiffModel anchors trailing deletions after the last draft line", () => {
  const model = buildUnifiedDiffModel(
    "flowchart TD\nA-->B\nB-->C",
    "flowchart TD\nA-->B"
  );

  assert.deepEqual(model.deletionWidgets, [
    {
      anchorDraftLine: 3,
      removedLines: [{ beforeNumber: 3, text: "B-->C" }],
      widgetKey: "3:3:B-->C"
    }
  ]);
});

runTest("resolveAiActionMode uses trimmed editor content", () => {
  assert.equal(resolveAiActionMode(""), "new");
  assert.equal(resolveAiActionMode("   \n\t"), "new");
  assert.equal(resolveAiActionMode("flowchart TD\nA-->B"), "modify");
});

runTest("hasMeaningfulDiagram ignores the untouched sample", () => {
  assert.equal(hasMeaningfulDiagram("flowchart TD\nA-->B", "flowchart TD\nA-->B"), false);
  assert.equal(hasMeaningfulDiagram("flowchart TD\nA-->C", "flowchart TD\nA-->B"), true);
});

console.log("AI utility tests passed.");

function runTest(name, callback) {
  try {
    callback();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}
