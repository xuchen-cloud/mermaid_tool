import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { buildMermaidHighlightRanges, highlightMermaidCode } from "../mermaid-highlight.js";

export const setEditorDecorationsEffect = StateEffect.define();

export const editorDecorationsField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(value, transaction) {
    let nextValue = value.map(transaction.changes);

    for (const effect of transaction.effects) {
      if (effect.is(setEditorDecorationsEffect)) {
        nextValue = effect.value;
      }
    }

    return nextValue;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  }
});

class DeletionBlockWidget extends WidgetType {
  constructor(block) {
    super();
    this.block = block;
  }

  eq(other) {
    return other.block.widgetKey === this.block.widgetKey;
  }

  toDOM() {
    const shell = document.createElement("div");
    shell.className = "cm-ai-deletion-block";

    for (const line of this.block.removedLines ?? []) {
      const row = document.createElement("div");
      row.className = "cm-ai-deletion-row";

      const number = document.createElement("span");
      number.className = "cm-ai-deletion-number";
      number.textContent = line.beforeNumber ? String(line.beforeNumber) : "";

      const text = document.createElement("span");
      text.className = "cm-ai-deletion-text";
      text.innerHTML = highlightMermaidCode(String(line.text ?? ""));

      row.append(number, text);
      shell.append(row);
    }

    return shell;
  }

  ignoreEvent() {
    return true;
  }
}

function appendLineClass(target, lineNumber, className) {
  const normalizedLineNumber = Number(lineNumber);
  if (!Number.isInteger(normalizedLineNumber) || normalizedLineNumber <= 0 || !className) {
    return;
  }

  const classList = target.get(normalizedLineNumber) ?? [];
  if (!classList.includes(className)) {
    classList.push(className);
  }
  target.set(normalizedLineNumber, classList);
}

function resolveDecorationPosition(doc, anchorDraftLine) {
  const lineCount = doc.lines || 1;
  if (anchorDraftLine > lineCount) {
    return doc.length;
  }

  const safeLine = Math.max(1, anchorDraftLine || 1);
  return doc.line(safeLine).from;
}

export function buildEditorDecorations(view, model = {}) {
  const builder = new RangeSetBuilder();
  const lineClasses = new Map();
  const highlightedLines = model.highlightedLines ?? [];
  const diffModel = model.diffModel ?? null;
  const decorations = [];
  const syntaxRanges = buildMermaidHighlightRanges(view.state.doc.toString());

  for (const range of syntaxRanges) {
    if (!(range.to > range.from) || !range.className) {
      continue;
    }

    decorations.push({
      from: range.from,
      to: range.to,
      value: Decoration.mark({
        class: range.className
      })
    });
  }

  for (const line of diffModel?.draftLineDecorations ?? []) {
    if (line.type === "add") {
      appendLineClass(lineClasses, line.lineNumber, "cm-ai-line-added");
    }
  }

  for (const lineNumber of highlightedLines) {
    appendLineClass(lineClasses, lineNumber, "cm-preview-line-highlight");
  }

  if (Number.isInteger(model.primaryHighlightedLine)) {
    appendLineClass(lineClasses, model.primaryHighlightedLine, "cm-preview-line-primary");
  }

  for (const [lineNumber, classes] of lineClasses.entries()) {
    if (lineNumber > view.state.doc.lines) {
      continue;
    }

    const line = view.state.doc.line(lineNumber);
    decorations.push({
      from: line.from,
      to: line.from,
      value: Decoration.line({
        attributes: {
          class: classes.join(" ")
        }
      })
    });
  }

  for (const block of diffModel?.deletionWidgets ?? []) {
    if (!block.removedLines?.length) {
      continue;
    }

    const position = resolveDecorationPosition(view.state.doc, block.anchorDraftLine);
    decorations.push({
      from: position,
      to: position,
      value: Decoration.widget({
        widget: new DeletionBlockWidget(block),
        block: true,
        side: -1
      })
    });
  }

  decorations.sort((left, right) => {
    if (left.from !== right.from) {
      return left.from - right.from;
    }

    const leftStartSide = Number(left.value.startSide ?? 0);
    const rightStartSide = Number(right.value.startSide ?? 0);
    if (leftStartSide !== rightStartSide) {
      return leftStartSide - rightStartSide;
    }

    if (left.to !== right.to) {
      return left.to - right.to;
    }

    return Number(left.value.endSide ?? 0) - Number(right.value.endSide ?? 0);
  });

  for (const decoration of decorations) {
    builder.add(decoration.from, decoration.to, decoration.value);
  }

  return builder.finish();
}
