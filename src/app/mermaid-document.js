import { layoutClassDiagram } from "../ppt/class/layout.js";
import { parseClassSource } from "../ppt/class/parse.js";
import { layoutFlowchart } from "../ppt/flowchart/layout.js";
import { layoutErDiagram } from "../ppt/er/layout.js";
import { parseErSource } from "../ppt/er/parse.js";
import { layoutJourney } from "../ppt/journey/layout.js";
import { parseJourneySource } from "../ppt/journey/parse.js";
import { layoutPie } from "../ppt/pie/layout.js";
import { parsePieSource } from "../ppt/pie/parse.js";
import { layoutStateDiagram } from "../ppt/state/layout.js";
import { parseStateSource } from "../ppt/state/parse.js";
import { layoutSequence } from "../ppt/sequence/layout.js";
import { parseSequenceSource } from "../ppt/sequence/parse.js";
import { parseFlowchartSource } from "../ppt/flowchart/parse.js";

export function isFlowchartSource(source) {
  return /^\s*(flowchart|graph)\b/i.test(source);
}

export function isSequenceSource(source) {
  return /^\s*sequenceDiagram\b/i.test(source);
}

export function isPieSource(source) {
  return /^\s*pie(?:\s+showData)?\b/i.test(source);
}

export function isJourneySource(source) {
  return /^\s*journey\b/i.test(source);
}

export function isClassSource(source) {
  return /^\s*classDiagram(?:-v2)?\b/i.test(source);
}

export function isErSource(source) {
  return /^\s*erDiagram\b/i.test(source);
}

export function isStateSource(source) {
  return /^\s*stateDiagram(?:-v2)?\b/i.test(source);
}

export function isPptExportableSource(source) {
  return (
    isFlowchartSource(source) ||
    isSequenceSource(source) ||
    isPieSource(source) ||
    isJourneySource(source) ||
    isClassSource(source) ||
    isErSource(source) ||
    isStateSource(source)
  );
}

function createParsedMermaidDocument(source) {
  const normalizedSource = String(source ?? "");

  if (isStateSource(normalizedSource)) {
    return {
      type: "state",
      source: normalizedSource,
      parsed: parseStateSource(normalizedSource)
    };
  }

  if (isClassSource(normalizedSource)) {
    return {
      type: "class",
      source: normalizedSource,
      parsed: parseClassSource(normalizedSource)
    };
  }

  if (isErSource(normalizedSource)) {
    return {
      type: "er",
      source: normalizedSource,
      parsed: parseErSource(normalizedSource)
    };
  }

  if (isFlowchartSource(normalizedSource)) {
    return {
      type: "flowchart",
      source: normalizedSource,
      parsed: parseFlowchartSource(normalizedSource)
    };
  }

  if (isSequenceSource(normalizedSource)) {
    return {
      type: "sequence",
      source: normalizedSource,
      parsed: parseSequenceSource(normalizedSource)
    };
  }

  if (isPieSource(normalizedSource)) {
    return {
      type: "pie",
      source: normalizedSource,
      parsed: parsePieSource(normalizedSource)
    };
  }

  if (isJourneySource(normalizedSource)) {
    return {
      type: "journey",
      source: normalizedSource,
      parsed: parseJourneySource(normalizedSource)
    };
  }

  return {
    type: "unknown",
    source: normalizedSource,
    parsed: null
  };
}

export function createMermaidDocumentCache() {
  const cache = new Map();

  return {
    resolve(source) {
      const key = String(source ?? "");
      if (cache.has(key)) {
        return cache.get(key);
      }

      const document = createParsedMermaidDocument(key);
      cache.set(key, document);
      return document;
    },
    clear() {
      cache.clear();
    }
  };
}

export function buildPptDiagramFromDocument(document, pptTheme) {
  if (!document || document.type === "unknown" || !document.parsed) {
    throw new Error("PPT export currently supports Flowchart, Sequence, Pie, Journey, Class, ER, and State diagrams only.");
  }

  if (document.type === "state") {
    return layoutStateDiagram(document.parsed, pptTheme);
  }

  if (document.type === "er") {
    return layoutErDiagram(document.parsed, pptTheme.flowchart);
  }

  if (document.type === "class") {
    return layoutClassDiagram(document.parsed, pptTheme.flowchart);
  }

  if (document.type === "journey") {
    return layoutJourney(document.parsed, pptTheme);
  }

  if (document.type === "pie") {
    return layoutPie(document.parsed, pptTheme);
  }

  if (document.type === "sequence") {
    return layoutSequence({
      ...document.parsed,
      source: document.source
    }, pptTheme.sequence);
  }

  return layoutFlowchart({
    ...document.parsed,
    source: document.source
  }, pptTheme.flowchart);
}
