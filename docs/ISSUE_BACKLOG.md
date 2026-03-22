# Mermaid Tool Issue Backlog

## Scope

This backlog is based on [PRODUCT_PRD.md](/Users/xuchen/mermaid_tool/docs/PRODUCT_PRD.md), with the following modules explicitly excluded for now:

- `Templates`
- `Archive`

Current focus:

- Application shell
- Workspace and file workflow
- Editor and preview polish
- Theme/config workflow hardening
- Export workflow polish
- Status and diagnostics
- Settings/preferences
- PPTX quality improvement

## Milestone Plan

### Milestone 1: Product Shell

Goal: turn the current single-screen tool into a structured desktop product.

### Milestone 2: Workspace and Editor UX

Goal: support real multi-file local workflows and a more polished editing experience.

### Milestone 3: Preview and Export UX

Goal: make rendering, preview inspection, and export actions product-grade.

### Milestone 4: Theme/Config Completion

Goal: make official Mermaid theme/config workflows stable, visible, and recoverable.

### Milestone 5: PPTX and Quality

Goal: improve editable export quality and add regression coverage.

## Epic A: App Shell

### A1. Build top navigation shell

- Priority: `P0`
- Type: `feature`
- Goal: introduce a persistent top navigation with product identity and primary sections.
- Scope:
  - Product title/logo area
  - Nav items for `Editor`
  - Placeholder entries for future sections can remain hidden or disabled
  - Settings entry point
- Acceptance criteria:
  - App has a persistent top bar
  - Active section state is visually clear
  - Current editor workspace survives shell navigation changes

### A2. Build left workspace sidebar

- Priority: `P0`
- Type: `feature`
- Goal: provide a persistent file/workspace navigation area.
- Scope:
  - Workspace title
  - New file action
  - File tree/list region
  - Footer utility items like help/status
- Acceptance criteria:
  - Sidebar remains visible while editing/previewing
  - File switching starts from the sidebar

### A3. Refactor renderer into shell + panes layout

- Priority: `P0`
- Type: `refactor`
- Goal: split current renderer into app shell, editor pane, preview pane, and status bar regions.
- Scope:
  - Extract current flat layout
  - Define reusable pane header structure
  - Make layout resizable-ready
- Acceptance criteria:
  - Editor and preview live in clearly separated panes
  - Layout structure can support future navigation/workspace features

## Epic B: Workspace and File Workflow

### B1. Add document model for local Mermaid files

- Priority: `P0`
- Type: `feature`
- Goal: manage `.mmd` files and project metadata consistently.
- Scope:
  - Active file path
  - File display name
  - Dirty state
  - Associated Mermaid config
- Acceptance criteria:
  - App can represent open documents consistently
  - Dirty and saved states are tracked

### B2. Support create/open/save/save-as for `.mmd`

- Priority: `P0`
- Type: `feature`
- Goal: support native Mermaid file workflow beyond project JSON.
- Scope:
  - New file
  - Open `.mmd`
  - Save current file
  - Save as
- Acceptance criteria:
  - User can create and persist standard Mermaid source files
  - Saving does not require using project JSON only

### B3. Add recent files and restore last session

- Priority: `P1`
- Type: `feature`
- Goal: reduce friction when reopening the app.
- Scope:
  - Recent files list
  - Restore last active file/workspace on launch
- Acceptance criteria:
  - Relaunch returns the user to their most recent working context

### B4. Add rename/duplicate/delete file actions

- Priority: `P1`
- Type: `feature`
- Goal: support basic file lifecycle from the UI.
- Scope:
  - Rename current file
  - Duplicate file
  - Remove file from workspace
- Acceptance criteria:
  - Common file operations are available without leaving the app

### B5. Add unsaved changes protection

- Priority: `P0`
- Type: `feature`
- Goal: prevent data loss when switching files or closing the app.
- Scope:
  - Dirty state prompt on file switch
  - Dirty state prompt on app close
- Acceptance criteria:
  - Unsaved work is never discarded silently

## Epic C: Editor Experience

### C1. Add editor header and file context

- Priority: `P0`
- Type: `feature`
- Goal: make the editor pane feel like a productized code workspace.
- Scope:
  - Current file name
  - Dirty indicator
  - Copy code action
- Acceptance criteria:
  - File context is always visible above the editor

### C2. Upgrade editing surface

- Priority: `P1`
- Type: `feature`
- Goal: improve editing quality for medium and large Mermaid files.
- Scope:
  - Evaluate `CodeMirror` or `Monaco`
  - Syntax highlighting
  - Better selection/scroll behavior
  - Optional line numbers
- Acceptance criteria:
  - Editing experience is materially better than plain textarea

### C3. Add editor diagnostics in status bar

- Priority: `P1`
- Type: `feature`
- Goal: expose cursor and file state information.
- Scope:
  - Line/column
  - Encoding placeholder
  - Dirty/render state summary
- Acceptance criteria:
  - Status bar reflects current editor state in real time

## Epic D: Preview and Canvas

### D1. Add preview pane header and grouped actions

- Priority: `P0`
- Type: `feature`
- Goal: organize copy/export controls into a stable preview toolbar.
- Scope:
  - Preview title
  - Copy image control
  - Export control grouping
  - Current clipboard format visibility
- Acceptance criteria:
  - Preview actions are grouped and easy to scan

### D2. Add zoom, fit, and fullscreen controls

- Priority: `P0`
- Type: `feature`
- Goal: improve diagram inspection for large or dense diagrams.
- Scope:
  - Zoom in
  - Zoom out
  - Fit to viewport
  - Fullscreen preview
- Acceptance criteria:
  - User can inspect large diagrams without relying only on browser scroll

### D3. Add empty/loading/error render states

- Priority: `P0`
- Type: `feature`
- Goal: make render lifecycle understandable and recoverable.
- Scope:
  - Empty state when code is blank
  - Loading/rendering indicator
  - Error panel with actionable message
- Acceptance criteria:
  - Render failure is visible and understandable

### D4. Add pane resizing support

- Priority: `P1`
- Type: `feature`
- Goal: let users allocate more space to code or preview.
- Scope:
  - Drag-to-resize editor/preview split
- Acceptance criteria:
  - Pane sizes can be adjusted and persisted

## Epic E: Theme and Mermaid Config

### E1. Polish official theme picker UX

- Priority: `P0`
- Type: `feature`
- Goal: make official Mermaid themes easy to discover and switch.
- Scope:
  - Cleaner theme selector placement
  - Better labels and defaults
  - Preview of current theme state
- Acceptance criteria:
  - Theme switching feels first-class, not secondary/debug-only

### E2. Improve config JSON editor usability

- Priority: `P0`
- Type: `feature`
- Goal: make Mermaid config JSON editing safer and easier.
- Scope:
  - Validation feedback
  - Parse error display
  - Reset-to-default clarity
  - Import/export affordances
- Acceptance criteria:
  - Invalid JSON is clearly flagged
  - User can recover from config mistakes quickly

### E3. Persist theme/config at file and app levels

- Priority: `P1`
- Type: `feature`
- Goal: define stable persistence rules for Mermaid config.
- Scope:
  - File-level config
  - App-level default config
  - Last-used theme fallback behavior
- Acceptance criteria:
  - Config restoration is predictable across reopen flows

### E4. Add supported-config mapping documentation in UI

- Priority: `P1`
- Type: `feature`
- Goal: clarify what config affects preview only vs also affects PPT export.
- Scope:
  - Inline help text or tooltip
  - Clear note on PPT style mapping limits
- Acceptance criteria:
  - User understands why some Mermaid config behavior may not fully replicate in PPT

## Epic F: Export Workflow

### F1. Replace many export buttons with export menu/dropdown

- Priority: `P0`
- Type: `feature`
- Goal: simplify preview toolbar and reduce visual noise.
- Scope:
  - One export entry point
  - Format options inside menu
  - Copy image remains separate or grouped
- Acceptance criteria:
  - Export toolbar is cleaner than the current many-button layout

### F2. Add export success/error notifications

- Priority: `P0`
- Type: `feature`
- Goal: make export outcomes visible without relying on terminal logs.
- Scope:
  - Success toast
  - Failure toast/dialog with useful message
- Acceptance criteria:
  - User gets clear feedback after every export attempt

### F3. Remember export preferences

- Priority: `P1`
- Type: `feature`
- Goal: reduce repeated export setup.
- Scope:
  - Last export format
  - Last clipboard format
  - Optional output path memory
- Acceptance criteria:
  - Common export workflow requires fewer repeated choices

### F4. Add export validation for unsupported PPT syntax

- Priority: `P1`
- Type: `feature`
- Goal: warn before or during PPT export when syntax is only partially supported.
- Scope:
  - Flowchart unsupported syntax warnings
  - Sequence unsupported syntax warnings
- Acceptance criteria:
  - PPT export failures are actionable, not vague

## Epic G: Status and Diagnostics

### G1. Add bottom status bar

- Priority: `P0`
- Type: `feature`
- Goal: provide lightweight system/editor/render feedback.
- Scope:
  - Render state
  - Render timing
  - Cursor line/column
  - File encoding placeholder
- Acceptance criteria:
  - Bottom status bar is always visible and updates live

### G2. Add render performance diagnostics

- Priority: `P1`
- Type: `feature`
- Goal: expose enough metrics to debug slow renders.
- Scope:
  - Last render duration
  - Optional node/edge count when available
- Acceptance criteria:
  - User can tell when rendering is slow or stale

## Epic H: Settings and Preferences

### H1. Add settings surface

- Priority: `P1`
- Type: `feature`
- Goal: move app-level preferences out of scattered controls.
- Scope:
  - Default export format
  - Clipboard format
  - Restore last workspace toggle
  - UI density or panel behavior placeholders
- Acceptance criteria:
  - Stable app preferences are managed in one place

### H2. Persist UI layout preferences

- Priority: `P2`
- Type: `feature`
- Goal: keep product layout consistent across sessions.
- Scope:
  - Sidebar open/collapsed
  - Pane split ratio
  - Last active section
- Acceptance criteria:
  - Relaunch feels like returning to the same workspace

## Epic I: PPTX Quality

### I1. Improve flowchart export parity

- Priority: `P1`
- Type: `quality`
- Goal: continue reducing gap between preview and editable PPTX.
- Scope:
  - Edge label styling
  - Shape padding and typography
  - Theme mapping consistency
- Acceptance criteria:
  - Existing regression corpus stays green
  - Visual parity improves measurably on sample set

### I2. Improve sequenceDiagram export quality

- Priority: `P1`
- Type: `quality`
- Goal: make sequence export usable for more real-world diagrams.
- Scope:
  - Fragment styling (`alt`, `opt`, `loop`, `else`)
  - Self-call geometry
  - Message label placement
  - Participant footer/header balance
  - Title styling
- Acceptance criteria:
  - Common business sequence diagrams export without major layout defects

### I3. Expand regression coverage

- Priority: `P1`
- Type: `quality`
- Goal: prevent layout and export regressions while product UI evolves.
- Scope:
  - Add sequence sample corpus
  - Add export validation scripts
  - Add threshold checks for styles/geometry where feasible
- Acceptance criteria:
  - Core export paths have repeatable local regression coverage

## Recommended Delivery Order

### Wave 1

- A1
- A2
- A3
- B1
- B2
- B5
- D1
- D3
- G1

### Wave 2

- C1
- D2
- E1
- E2
- F1
- F2

### Wave 3

- B3
- B4
- C2
- D4
- E3
- F3
- G2
- H1

### Wave 4

- F4
- I1
- I2
- I3
- H2

## Suggested First Sprint

The best first sprint is:

1. `A3` Refactor renderer into shell + panes layout
2. `A1` Build top navigation shell
3. `A2` Build left workspace sidebar
4. `B1` Add document model for local Mermaid files
5. `B2` Support create/open/save/save-as for `.mmd`
6. `G1` Add bottom status bar

Reason:

- It establishes the target product structure early
- It avoids repeated UI rewrites
- It makes later config/export/editor polish much easier to place correctly
