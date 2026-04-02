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
