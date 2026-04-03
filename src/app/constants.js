export const sampleCode = `flowchart TD
    A[Collect ideas] --> B{Need export?}
    B -->|SVG| C[Save vector output]
    B -->|PNG/JPG| D[Rasterize from SVG]
    C --> E[Share diagram]
    D --> E
`;

export const clipboardFormatStorageKey = "mermaid-tool.clipboard-format";
export const mermaidConfigStorageKey = "mermaid-tool.mermaid-config";
export const mermaidThemeModeStorageKey = "mermaid-tool.theme-mode";
export const uiLanguageStorageKey = "mermaid-tool.ui-language";
export const workspaceRootStorageKey = "mermaid-tool.workspace-root";
export const workspaceFileStorageKey = "mermaid-tool.workspace-file";
export const workspaceSortModeStorageKey = "mermaid-tool.workspace-sort-mode";
export const editorFontSizeStorageKey = "mermaid-tool.editor-font-size";
export const workspaceSidebarCollapsedStorageKey = "mermaid-tool.workspace-sidebar-collapsed";
export const editorPaneWidthStorageKey = "mermaid-tool.editor-pane-width";
export const maskedSavedTokenValue = "saved-token-mask";
export const defaultPreviewDimensions = { width: 1200, height: 800 };
export const mermaidDeclarationPattern =
  /(^|\n)\s*(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie(?:\s+showData)?|mindmap|timeline|quadrantChart|requirementDiagram|gitGraph|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|architecture-beta|packet-beta|xychart-beta|kanban|block-beta|sankey-beta)\b/im;
export const previewWheelZoomStep = 0.02;
export const editorIndentUnit = "  ";
export const aiStreamEventName = "ai://generate-chunk";

export const defaultAiSystemPromptTemplate = `You generate Mermaid code for desktop diagram authoring.
Return Mermaid source code only.
Do not use markdown fences.
Do not add explanations.
Prefer flowchart TD unless the user clearly describes actors, messages, or lifelines that fit sequenceDiagram.
For flowchart nodes, do not use HTML tags like <br/> in labels. If a label contains parentheses or dense punctuation, use a quoted label such as A["Start (details)"].
Use ASCII node ids and keep labels human-readable.
If existing Mermaid is provided, preserve unchanged structure where possible and return the full updated Mermaid document.`;

export const defaultAiUserPromptTemplate = `User request:
{{prompt}}

{{mode_instruction}}

{{current_diagram_section}}{{repair_section}}`;

export const legacyDefaultAiDrawioSystemPromptTemplate = `You generate draw.io XML for desktop diagram authoring.
Return a complete .drawio XML document only.
The root element must be <mxfile>.
Do not use markdown fences.
Do not add explanations.
Default to compressed="false".
Preserve unaffected pages, cells, ids, geometry, and relationships whenever existing draw.io XML is provided.
Return valid XML that draw.io can open and export.`;

export const legacyDefaultAiDrawioUserPromptTemplate = `User request:
{{prompt}}

{{mode_instruction}}

{{current_diagram_section}}{{repair_section}}`;

export const defaultAiDrawioSystemPromptTemplate = `You generate native draw.io XML for desktop diagram authoring.
Return one complete .drawio XML document and nothing else.
Do not use markdown fences.
Do not add explanations.
Use <mxfile compressed="false"> as the root element.
Include at least one <diagram> page.
Each diagram page must contain one <mxGraphModel> with <root><mxCell id="0"/><mxCell id="1" parent="0"/></root>.
Every visible shape must be an mxCell with vertex="1", a valid parent, and an <mxGeometry ... as="geometry"/> that includes concrete x, y, width, and height values.
Every connector must be an mxCell with edge="1", a valid parent, source, and target, plus <mxGeometry relative="1" as="geometry"/>.
Return a non-empty, readable diagram with sensible spacing and minimal overlaps.
Use stable ASCII ids and simple built-in draw.io styles.
If you use a non-rectangular shape, include the matching perimeter style when draw.io expects one.
If existing draw.io XML is provided, preserve unaffected pages, cells, ids, geometry, and relationships whenever possible, and edit existing cells instead of recreating them unless necessary.
Do not return an empty skeleton, placeholder page, or partial fragment.
Return XML that draw.io can load, display, edit, and export.

Minimal page skeleton:
<mxfile compressed="false"><diagram id="page-1" name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`;

export const defaultAiDrawioUserPromptTemplate = `User request:
{{prompt}}

Task:
{{mode_instruction}}

Layout requirements:
- Make the diagram visually readable with a clear top-to-bottom or left-to-right flow unless the user requests another layout.
- Use concise human-readable labels.
- If the request is ambiguous, choose standard draw.io flowchart conventions and keep the result simple rather than decorative.

{{current_diagram_section}}{{repair_section}}`;
