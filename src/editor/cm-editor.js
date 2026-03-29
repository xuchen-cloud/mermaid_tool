import { Compartment, EditorSelection, EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { lineNumbers, drawSelection, EditorView, keymap } from "@codemirror/view";

import {
  buildEditorDecorations,
  editorDecorationsField,
  setEditorDecorationsEffect
} from "./cm-ai-diff.js";
import { mermaidEditorTheme } from "./cm-mermaid-theme.js";

export function createCodeEditorAdapter(host, options = {}) {
  let suppressCallbacks = false;
  let view = null;
  const editableCompartment = new Compartment();
  const readOnlyCompartment = new Compartment();

  const emitSelection = () => {
    if (!view || suppressCallbacks) {
      return;
    }

    const range = view.state.selection.main;
    options.onSelectionChange?.({
      start: range.from,
      end: range.to
    });
  };

  const emitDocValue = () => {
    if (!view || suppressCallbacks) {
      return;
    }

    options.onChange?.(view.state.doc.toString());
  };

  view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: String(options.initialValue ?? ""),
      extensions: [
        EditorView.lineWrapping,
        editableCompartment.of(EditorView.editable.of(options.editable !== false)),
        readOnlyCompartment.of(EditorState.readOnly.of(options.editable === false)),
        lineNumbers(),
        history(),
        drawSelection(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        mermaidEditorTheme,
        editorDecorationsField,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            emitDocValue();
          }

          if (update.docChanged || update.selectionSet) {
            emitSelection();
          }
        }),
        EditorView.domEventHandlers({
          keydown(event) {
            options.onKeydown?.(event);
            return event.defaultPrevented;
          },
          blur() {
            if (!suppressCallbacks) {
              options.onBlur?.();
            }
            return false;
          }
        })
      ]
    })
  });

  host.style.setProperty("--editor-font-size", `${options.fontSize ?? 13}px`);

  return {
    getValue() {
      return view.state.doc.toString();
    },
    setValue(nextValue, options = {}) {
      const normalizedValue = String(nextValue ?? "");
      if (normalizedValue === view.state.doc.toString()) {
        if (options.selection) {
          this.setSelection(options.selection.start, options.selection.end);
        }
        return;
      }

      suppressCallbacks = true;
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: normalizedValue
        },
        selection: options.selection
          ? EditorSelection.range(
              options.selection.start ?? 0,
              options.selection.end ?? options.selection.start ?? 0
            )
          : undefined
      });
      suppressCallbacks = false;
      if (!options.silent) {
        emitDocValue();
        emitSelection();
      }
    },
    setSelection(start, end = start) {
      suppressCallbacks = true;
      view.dispatch({
        selection: EditorSelection.range(start ?? 0, end ?? start ?? 0),
        scrollIntoView: true
      });
      suppressCallbacks = false;
      emitSelection();
    },
    getSelection() {
      const range = view.state.selection.main;
      return {
        start: range.from,
        end: range.to
      };
    },
    focus(options = {}) {
      view.focus();
      if (!options.preventScroll) {
        view.scrollDOM.scrollIntoView?.();
      }
    },
    setEditable(isEditable) {
      suppressCallbacks = true;
      view.dispatch({
        effects: [
          editableCompartment.reconfigure(EditorView.editable.of(Boolean(isEditable))),
          readOnlyCompartment.reconfigure(EditorState.readOnly.of(!isEditable))
        ]
      });
      suppressCallbacks = false;
    },
    scrollToLine(lineNumber) {
      const line = view.state.doc.line(Math.max(1, Math.min(lineNumber, view.state.doc.lines)));
      view.dispatch({
        effects: EditorView.scrollIntoView(line.from, {
          y: "center"
        })
      });
    },
    setDecorations(model) {
      view.dispatch({
        effects: setEditorDecorationsEffect.of(buildEditorDecorations(view, model))
      });
    },
    setFontSize(fontSize) {
      host.style.setProperty("--editor-font-size", `${fontSize}px`);
    },
    getScrollElement() {
      return view.scrollDOM;
    },
    destroy() {
      view.destroy();
    }
  };
}
