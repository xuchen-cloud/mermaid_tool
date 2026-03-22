# Mermaid Tool

Desktop Mermaid renderer with realtime preview, image export, and an in-progress editable PPTX flowchart exporter.

## Features

- Edit Mermaid code in a desktop UI
- Render diagrams in realtime
- Export `SVG`, `PNG`, and `JPG`
- Export editable `PPTX` for Mermaid `flowchart` diagrams

## Run

```bash
npm install
npm start
```

## Flowchart Regression

Run the local regression corpus for the flowchart PPT exporter:

```bash
npm run regression:flowchart
```

The command will:

- Parse each Mermaid sample in `samples/flowchart`
- Run the flowchart layout engine
- Export a `.pptx` artifact for each sample
- Write `summary.json` and `summary.md` to `artifacts/flowchart-regression`

## Notes

- This repository is currently focused on the editor, preview, and image export flow.
- `flowchart` PPT export is supported as an editable MVP.
- `sequenceDiagram` PPT export has not been implemented yet.
