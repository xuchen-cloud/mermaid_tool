import { EditorView } from "@codemirror/view";

export const mermaidEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--text)",
    backgroundColor: "#ffffff",
    fontFamily: "\"SF Mono\", Menlo, Consolas, monospace",
    fontSize: "var(--editor-font-size, 13px)",
    lineHeight: "1.6"
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "inherit"
  },
  ".cm-content, .cm-gutter": {
    fontFamily: "inherit",
    fontSize: "inherit",
    lineHeight: "inherit"
  },
  ".cm-content": {
    padding: "12px 0 12px 0"
  },
  ".cm-line": {
    padding: "0 10px 0 0"
  },
  ".cm-gutters": {
    border: "0",
    backgroundColor: "rgba(249, 251, 255, 0.9)",
    color: "#8b96aa",
    paddingLeft: "2px",
    paddingRight: "2px"
  },
  ".cm-lineNumbers .cm-gutterElement": {
    minWidth: "24px",
    padding: "0 4px 0 0",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent"
  },
  ".cm-focused": {
    outline: "none"
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(63, 91, 216, 0.18) !important"
  },
  ".cm-cursor": {
    borderLeftColor: "var(--text)"
  }
});
