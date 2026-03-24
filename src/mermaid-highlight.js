const DIAGRAM_DECLARATIONS = [
  "architecture-beta",
  "block-beta",
  "classDiagram",
  "erDiagram",
  "flowchart",
  "gitGraph",
  "gantt",
  "graph",
  "journey",
  "kanban",
  "mindmap",
  "packet-beta",
  "pie",
  "quadrantChart",
  "radar-beta",
  "requirementDiagram",
  "sankey-beta",
  "sequenceDiagram",
  "stateDiagram-v2",
  "stateDiagram",
  "timeline",
  "xychart-beta",
  "C4Component",
  "C4Container",
  "C4Context",
  "C4Deployment",
  "C4Dynamic",
  "zenuml"
];

const DECLARATIONS_BY_LENGTH = [...DIAGRAM_DECLARATIONS].sort((left, right) => right.length - left.length);
const DIAGRAM_DECLARATION_SET = new Set(DIAGRAM_DECLARATIONS.map((item) => item.toLowerCase()));

const KEYWORDS = new Set(
  [
    "accdescr",
    "accdescrmultiline",
    "acctitle",
    "action",
    "activate",
    "actor",
    "alt",
    "and",
    "architecture",
    "auto",
    "autonumber",
    "axisformat",
    "bar",
    "box",
    "break",
    "call",
    "class",
    "classdef",
    "click",
    "contains",
    "create",
    "critical",
    "cssclass",
    "dateformat",
    "deactivate",
    "default",
    "destroy",
    "direction",
    "else",
    "end",
    "enum",
    "gantt",
    "group",
    "icon",
    "interface",
    "intersection",
    "junction",
    "linkstyle",
    "loop",
    "mindmap",
    "namespace",
    "note",
    "of",
    "opt",
    "option",
    "over",
    "par",
    "participant",
    "pie",
    "quadrantchart",
    "rect",
    "requirement",
    "section",
    "service",
    "state",
    "style",
    "subgraph",
    "task",
    "then",
    "title",
    "todaymarker"
  ]
);

const BUILTIN_WORDS = new Set(["TB", "TD", "BT", "LR", "RL"]);
const LITERAL_WORDS = new Set(["false", "null", "on", "off", "true"]);
const IDENTIFIER_AFTER_KEYWORDS = new Set([
  "action",
  "activate",
  "actor",
  "class",
  "classdef",
  "click",
  "create",
  "cssclass",
  "deactivate",
  "destroy",
  "group",
  "interface",
  "junction",
  "namespace",
  "of",
  "participant",
  "requirement",
  "section",
  "service",
  "state",
  "style",
  "subgraph"
]);
const PROPERTY_WORDS = new Set([
  "accdescr",
  "acctitle",
  "axisformat",
  "callback",
  "click",
  "color",
  "dateformat",
  "descr",
  "description",
  "fill",
  "font-family",
  "font-size",
  "height",
  "href",
  "icon",
  "label",
  "link",
  "pos",
  "shape",
  "stroke",
  "stroke-dasharray",
  "stroke-width",
  "text",
  "tickinterval",
  "title",
  "type",
  "width",
  "x-axis",
  "y-axis"
]);

const OPERATOR_TOKENS = [
  "<<-->>",
  "<<->>",
  "<==>",
  "<-->",
  "<-.->",
  "-->>",
  "->>",
  "-.->",
  "==>",
  "-->",
  "---",
  "~~~",
  ":::",
  "==",
  "--",
  "..",
  "=>",
  "->"
];

const RELATIONSHIP_PATTERN = /^(?:[|}{ox*+]+[-.=]+[|}{ox*+<>]+|<?[-.=]+[|}{ox*+]+|[|}{ox*+]+[-.=<>]+>?)/u;
const PROPERTY_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*/u;
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*/u;
const NUMBER_PATTERN = /^-?\d+(?:\.\d+)?(?:ms|s|m|h|d|w|%|px|em|rem)?\b/u;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{3,8}\b/u;
const PUNCTUATION_PATTERN = /^[\[\]\(\)\{\},:;.!?]/u;
const BRACKET_PAIRS = new Map([
  ["[", "]"],
  ["(", ")"],
  ["{", "}"]
]);

export function highlightMermaidCode(source) {
  const state = {
    diagramType: null
  };

  return source
    .split("\n")
    .map((line) => highlightLine(line, state))
    .join("\n");
}

function highlightLine(line, state) {
  if (line.length === 0) {
    return "";
  }

  const indentMatch = line.match(/^\s*/u);
  const indent = indentMatch?.[0] ?? "";
  const content = line.slice(indent.length);

  if (/^(%%)(?!\{)|^\/\//u.test(content)) {
    return `${escapeHtml(indent)}${span("token-comment", content)}`;
  }

  const tokens = [];
  if (indent) {
    tokens.push({ type: null, value: indent });
  }

  let index = indent.length;
  const declaration = readDiagramDeclaration(content);
  const context = {
    expectIdentifier: false,
    lineHasDiagramDeclaration: Boolean(declaration),
    previousKeyword: null,
    previousSignificantType: null
  };

  if (declaration) {
    state.diagramType = declaration.toLowerCase();
    tokens.push({ type: "token-declaration", value: declaration });
    index += declaration.length;
    context.previousSignificantType = "token-declaration";
  }

  while (index < line.length) {
    const slice = line.slice(index);

    const whitespaceMatch = slice.match(/^\s+/u);
    if (whitespaceMatch) {
      tokens.push({ type: null, value: whitespaceMatch[0] });
      index += whitespaceMatch[0].length;
      continue;
    }

    if (slice.startsWith("%%{")) {
      const directiveEnd = slice.indexOf("}%%");
      const directive = directiveEnd >= 0 ? slice.slice(0, directiveEnd + 3) : slice;
      tokens.push({ type: "token-directive", value: directive });
      index += directive.length;
      context.previousSignificantType = "token-directive";
      continue;
    }

    if (slice.startsWith("%%") || slice.startsWith("//")) {
      tokens.push({ type: "token-comment", value: slice });
      break;
    }

    const quoted = readQuotedString(slice);
    if (quoted) {
      tokens.push({ type: "token-string", value: quoted });
      index += quoted.length;
      context.expectIdentifier = false;
      context.previousKeyword = null;
      context.previousSignificantType = "token-string";
      continue;
    }

    const operator = readOperator(slice);
    if (operator) {
      tokens.push({ type: "token-arrow", value: operator });
      index += operator.length;
      context.expectIdentifier = true;
      context.previousKeyword = null;
      context.previousSignificantType = "token-arrow";
      continue;
    }

    const relationshipMatch = slice.match(RELATIONSHIP_PATTERN);
    if (relationshipMatch) {
      tokens.push({ type: "token-arrow", value: relationshipMatch[0] });
      index += relationshipMatch[0].length;
      context.expectIdentifier = true;
      context.previousKeyword = null;
      context.previousSignificantType = "token-arrow";
      continue;
    }

    const label = readPipeLabel(slice);
    if (label) {
      tokens.push({ type: "token-pipe", value: "|" });
      if (label.text.length > 0) {
        tokens.push({ type: "token-label", value: label.text });
      }
      tokens.push({ type: "token-pipe", value: "|" });
      index += label.length;
      context.expectIdentifier = false;
      context.previousKeyword = null;
      context.previousSignificantType = "token-label";
      continue;
    }

    const colorMatch = slice.match(HEX_COLOR_PATTERN);
    if (colorMatch) {
      tokens.push({ type: "token-color", value: colorMatch[0] });
      index += colorMatch[0].length;
      context.previousSignificantType = "token-color";
      continue;
    }

    const numberMatch = slice.match(NUMBER_PATTERN);
    if (numberMatch) {
      tokens.push({ type: "token-number", value: numberMatch[0] });
      index += numberMatch[0].length;
      context.previousSignificantType = "token-number";
      continue;
    }

    const propertyMatch = slice.match(PROPERTY_PATTERN);
    if (propertyMatch) {
      const propertyWord = propertyMatch[0];
      const propertyNextCharacter = getNextNonWhitespaceCharacter(slice.slice(propertyWord.length));

      if (PROPERTY_WORDS.has(propertyWord.toLowerCase()) && propertyNextCharacter === ":") {
        tokens.push({ type: "token-property", value: propertyWord });
        index += propertyWord.length;
        context.expectIdentifier = false;
        context.previousKeyword = null;
        context.previousSignificantType = "token-property";
        continue;
      }
    }

    const bracketText = readBracketText(slice, context);
    if (bracketText) {
      tokens.push(...bracketText.tokens);
      index += bracketText.length;
      context.expectIdentifier = false;
      context.previousKeyword = null;
      context.previousSignificantType = "token-punctuation";
      continue;
    }

    const punctuationMatch = slice.match(PUNCTUATION_PATTERN);
    if (punctuationMatch) {
      tokens.push({ type: "token-punctuation", value: punctuationMatch[0] });
      index += punctuationMatch[0].length;

      if (
        punctuationMatch[0] === ":" &&
        (state.diagramType === "sequencediagram" || state.diagramType === "erdiagram")
      ) {
        tokens.push(...readTextTail(line.slice(index)));
        break;
      }

      context.previousSignificantType = "token-punctuation";
      continue;
    }

    const identifierMatch = slice.match(IDENTIFIER_PATTERN);
    if (identifierMatch) {
      const word = identifierMatch[0];
      const nextNonWhitespace = getNextNonWhitespaceCharacter(slice.slice(word.length));
      const type = classifyWord(word, nextNonWhitespace, context, state);

      tokens.push({ type, value: word });
      index += word.length;

      if (type === "token-keyword") {
        const lowered = word.toLowerCase();
        context.expectIdentifier = IDENTIFIER_AFTER_KEYWORDS.has(lowered);
        context.previousKeyword = lowered;
      } else if (type === "token-property" || type === "token-declaration") {
        context.expectIdentifier = false;
        context.previousKeyword = null;
      } else if (type === "token-arrow") {
        context.expectIdentifier = true;
        context.previousKeyword = null;
      } else {
        context.expectIdentifier = false;
        context.previousKeyword = null;
      }

      context.previousSignificantType = type ?? "text";
      continue;
    }

    tokens.push({ type: null, value: slice[0] });
    index += 1;
  }

  return tokens.map(renderToken).join("");
}

function readDiagramDeclaration(content) {
  for (const declaration of DECLARATIONS_BY_LENGTH) {
    if (!content.startsWith(declaration)) {
      continue;
    }

    const nextCharacter = content[declaration.length];
    if (!nextCharacter || /\s/u.test(nextCharacter)) {
      return declaration;
    }
  }

  return null;
}

function readPipeLabel(slice) {
  if (!slice.startsWith("|")) {
    return null;
  }

  const endIndex = slice.indexOf("|", 1);
  if (endIndex < 0) {
    return null;
  }

  return {
    length: endIndex + 1,
    text: slice.slice(1, endIndex)
  };
}

function readBracketText(slice, context) {
  if (!BRACKET_PAIRS.has(slice[0])) {
    return null;
  }

  if (context.previousSignificantType !== "token-identifier") {
    return null;
  }

  const tokens = [];
  let textStart = 0;
  const stack = [];

  for (let index = 0; index < slice.length; index += 1) {
    const character = slice[index];

    if (character === '"' || character === "'" || character === "`") {
      const quoted = readQuotedString(slice.slice(index));
      if (!quoted) {
        continue;
      }

      index += quoted.length - 1;
      continue;
    }

    if (BRACKET_PAIRS.has(character)) {
      flushPlainText(tokens, slice.slice(textStart, index));
      tokens.push({ type: "token-punctuation", value: character });
      stack.push(BRACKET_PAIRS.get(character));
      textStart = index + 1;
      continue;
    }

    if (stack.length > 0 && character === stack[stack.length - 1]) {
      flushPlainText(tokens, slice.slice(textStart, index));
      tokens.push({ type: "token-punctuation", value: character });
      stack.pop();
      textStart = index + 1;

      if (stack.length === 0) {
        return {
          length: index + 1,
          tokens
        };
      }
    }
  }

  return null;
}

function readQuotedString(slice) {
  const quote = slice[0];
  if (!quote || !['"', "'", "`"].includes(quote)) {
    return null;
  }

  let index = 1;
  while (index < slice.length) {
    const character = slice[index];
    if (character === "\\") {
      index += 2;
      continue;
    }

    if (character === quote) {
      return slice.slice(0, index + 1);
    }

    index += 1;
  }

  return slice;
}

function readOperator(slice) {
  for (const operator of OPERATOR_TOKENS) {
    if (slice.startsWith(operator)) {
      return operator;
    }
  }

  return null;
}

function getNextNonWhitespaceCharacter(value) {
  const match = value.match(/\S/u);
  return match ? match[0] : "";
}

function classifyWord(word, nextNonWhitespace, context, state) {
  const lowered = word.toLowerCase();

  if (BUILTIN_WORDS.has(word)) {
    return "token-builtin";
  }

  if (LITERAL_WORDS.has(lowered)) {
    return "token-literal";
  }

  if (PROPERTY_WORDS.has(lowered) && nextNonWhitespace === ":") {
    return "token-property";
  }

  if (DIAGRAM_DECLARATION_SET.has(lowered)) {
    return "token-declaration";
  }

  if (KEYWORDS.has(lowered) || isDiagramSpecificKeyword(lowered, state.diagramType)) {
    return "token-keyword";
  }

  if (context.expectIdentifier) {
    return "token-identifier";
  }

  if (nextNonWhitespace && "[({".includes(nextNonWhitespace)) {
    return "token-identifier";
  }

  if (nextNonWhitespace && "-<=.|".includes(nextNonWhitespace)) {
    return "token-identifier";
  }

  if (context.previousSignificantType === "token-arrow") {
    return "token-identifier";
  }

  if (context.previousKeyword && IDENTIFIER_AFTER_KEYWORDS.has(context.previousKeyword)) {
    return "token-identifier";
  }

  if (context.lineHasDiagramDeclaration && /^[A-Z][A-Za-z0-9_-]*$/u.test(word)) {
    return "token-identifier";
  }

  return null;
}

function isDiagramSpecificKeyword(keyword, diagramType) {
  if (!diagramType) {
    return false;
  }

  if (diagramType === "flowchart" || diagramType === "graph") {
    return ["down", "left", "right", "up"].includes(keyword);
  }

  if (diagramType === "sequencediagram") {
    return ["left", "right"].includes(keyword);
  }

  if (diagramType === "classdiagram") {
    return ["annotation", "composition", "dependency", "extends", "implements", "inheritance"].includes(keyword);
  }

  if (diagramType === "gantt") {
    return ["active", "after", "crit", "done", "excludes", "milestone", "weekday"].includes(keyword);
  }

  if (diagramType === "gitgraph") {
    return ["branch", "checkout", "cherry-pick", "commit", "merge", "reset"].includes(keyword);
  }

  if (diagramType === "journey") {
    return ["done", "crit", "active"].includes(keyword);
  }

  if (diagramType === "pie") {
    return ["showdata"].includes(keyword);
  }

  if (diagramType === "requirementdiagram") {
    return ["copies", "derives", "refines", "satisfies", "traces", "verifies"].includes(keyword);
  }

  return false;
}

function readTextTail(value) {
  const tokens = [];
  let index = 0;

  while (index < value.length) {
    const quoted = readQuotedString(value.slice(index));
    if (quoted) {
      tokens.push({ type: "token-string", value: quoted });
      index += quoted.length;
      continue;
    }

    let nextIndex = index;
    while (nextIndex < value.length && !['"', "'", "`"].includes(value[nextIndex])) {
      nextIndex += 1;
    }

    flushPlainText(tokens, value.slice(index, nextIndex));
    index = nextIndex;
  }

  return tokens;
}

function flushPlainText(tokens, value) {
  if (!value) {
    return;
  }

  tokens.push({ type: null, value });
}

function renderToken(token) {
  if (!token.type) {
    return escapeHtml(token.value);
  }

  return span(token.type, token.value);
}

function span(className, value) {
  return `<span class="${className}">${escapeHtml(value)}</span>`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
