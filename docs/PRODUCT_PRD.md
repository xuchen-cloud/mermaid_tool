# Mermaid Tool PRD

## 1. Document Info

- Product name: `Mermaid Tool`
- Product stage: Desktop MVP evolving toward a complete authoring product
- Platform: Desktop app (`Electron`)
- Primary input: Mermaid source code
- Primary outputs: Live diagram preview, image export, editable PPTX export

## 2. Product Vision

`Mermaid Tool` is a desktop diagram authoring product for users who need to write Mermaid, preview it instantly, manage diagram files locally, apply official Mermaid themes/configurations, and export diagrams in presentation-friendly formats including editable PowerPoint.

The target end state is not just a demo renderer. It is a complete productivity tool with:

- A stable workspace shell
- File/project organization
- Template-driven authoring
- Theme/config management
- Reliable export workflows
- A polished editor and preview experience

## 3. Background and Current State

### 3.1 Current implemented capabilities

- Mermaid code editing
- Live preview rendering
- Export: `SVG`, `PNG`, `JPG`
- Clipboard image copy
- Official Mermaid theme/config JSON editing
- Save/open project JSON with Mermaid code + config
- Editable `PPTX` export for `flowchart`
- `sequenceDiagram` editable `PPTX` MVP

### 3.2 Current product gaps

Compared with the target high-fidelity design, the current app still lacks:

- A complete application shell with top navigation and workspace navigation
- File explorer and multi-file workflow
- Template library and archive/history entry points
- Clear editing toolbars and action grouping
- Better preview controls like zoom/fullscreen/reset-fit
- Structured export menu UX
- Polished empty/loading/error states
- Product-level status bar and editor diagnostics
- Full consistency between theme/config state and project/workspace state
- Stronger document lifecycle features: create, rename, duplicate, archive, recent files

## 4. Target Users

### 4.1 Core users

- Product managers creating workflow and system diagrams
- Solution architects and engineers writing technical diagrams
- Operations / customer success teams exporting diagrams into decks and docs
- Internal platform teams creating reusable Mermaid templates

### 4.2 User goals

- Quickly create or edit Mermaid files
- Preview changes immediately
- Manage multiple diagram files locally
- Apply approved themes/configs consistently
- Export diagrams for documents and presentations
- Reopen and continue work without losing project context

## 5. Product Goals

### 5.1 Primary goals

- Make Mermaid editing fast and reliable on desktop
- Reduce export friction for documentation and presentations
- Turn current renderer into a complete usable product shell
- Preserve visual consistency across preview and exports

### 5.2 Non-goals for this phase

- Cloud collaboration
- Multi-user real-time editing
- AI-generated Mermaid from natural language
- Web version
- Perfect parity with all Mermaid diagram types

## 6. High-Fidelity Analysis

The provided high-fidelity implies the following product structure:

### 6.1 App shell

- Top navigation with product identity
- Primary navigation areas: `Editor`, `Templates`, `Archive`
- Secondary actions: settings, profile/account

### 6.2 Left sidebar / project explorer

- Local workspace metaphor
- New file creation
- Folder and file hierarchy
- Persistent navigation entry points
- Help and status sections

### 6.3 Main workspace

- Split pane layout: editor left, preview right
- Editor header with current file name and copy-code action
- Preview header with export/copy actions
- Diagram canvas with visual controls
- Bottom status bar with render state and cursor diagnostics

### 6.4 UX direction

- Productized desktop tool, not a one-screen utility
- Workspace-first mental model
- Higher information density
- Consistent action placement
- Stronger affordance around files, projects, templates, status

## 7. Product Scope

## 7.1 Functional modules

1. Application shell
2. Workspace and file explorer
3. Editor
4. Preview and canvas tools
5. Theme/config management
6. Export center
7. Template library
8. Archive/history
9. Status and diagnostics
10. Settings and preferences

## 8. Functional Requirements

### 8.1 Application shell

#### Goal

Provide a stable desktop product structure for navigation and persistent workflows.

#### Requirements

- Top navigation bar with product name
- Primary app sections:
  - Editor
  - Templates
  - Archive
- Global actions:
  - Settings
  - About/help
  - Optional account entry placeholder
- Responsive desktop layout with resizable regions

#### Acceptance criteria

- User can switch between core product areas without leaving the app
- App shell remains stable while content areas update

### 8.2 Workspace and file explorer

#### Goal

Support multi-file local authoring instead of single-document editing.

#### Requirements

- Local workspace explorer in left sidebar
- Create new `.mmd` file
- Open existing `.mmd` file
- Save current `.mmd` file
- Rename file
- Duplicate file
- Delete/archive file
- Recent files list
- Remember last opened workspace or files

#### Acceptance criteria

- User can manage multiple Mermaid documents from within the app
- Last working context is restored on next launch

### 8.3 Editor

#### Goal

Deliver a reliable writing/editing experience for Mermaid source.

#### Requirements

- Dedicated editor pane
- Current file name shown in editor header
- Copy code action
- Line/column status
- Syntax-friendly editing behavior
- Optional future enhancement:
  - Monaco/CodeMirror based syntax highlighting
  - diagram type snippets
  - formatting helpers

#### Acceptance criteria

- Editing is smooth for medium and large Mermaid files
- Cursor position and edit status are visible

### 8.4 Preview and canvas tools

#### Goal

Provide a polished preview area suitable for inspection and export preparation.

#### Requirements

- Dedicated preview pane
- Live render status
- Zoom in / zoom out
- Fit to screen
- Fullscreen preview
- Pan/scroll support for large diagrams
- Empty state
- Render error state with actionable messages

#### Acceptance criteria

- User can inspect large diagrams without losing orientation
- Failed render states are clearly shown and recoverable

### 8.5 Theme and Mermaid config management

#### Goal

Make official Mermaid theme/config workflows first-class and reusable.

#### Requirements

- Theme picker for official Mermaid themes
- Mermaid config JSON editor
- Import config JSON
- Export config JSON
- Reset config to defaults
- Theme/config persisted in project file
- Preview, image export, and PPT export use the current config where supported

#### Acceptance criteria

- User can switch between official Mermaid themes instantly
- Project reopen restores both Mermaid code and active config

### 8.6 Export center

#### Goal

Unify copy and export actions into a coherent workflow.

#### Requirements

- Group export actions in preview header
- Support:
  - Copy image
  - Export SVG
  - Export PNG
  - Export JPG
  - Export PPTX
- Optional export dropdown instead of many separate buttons
- Remember last used export settings
- Clear success/error feedback

#### Acceptance criteria

- Export actions are discoverable and consistent
- User understands what format will be exported before clicking

### 8.7 PPTX export

#### Goal

Keep editable export as a differentiated product feature.

#### Requirements

- `flowchart` editable export remains stable
- `sequenceDiagram` editable export improves from MVP to usable beta
- Theme/config style mapping applied where feasible
- Export validation messaging when unsupported syntax is used

#### Acceptance criteria

- `flowchart` exports are editable and visually stable
- `sequenceDiagram` exports are usable for common scenarios

### 8.8 Template library

#### Goal

Help users start from common diagram patterns faster.

#### Requirements

- Templates section in top nav
- Built-in templates grouped by type:
  - flowchart
  - sequenceDiagram
  - architecture
  - org/process
- Preview template before applying
- Create new document from template

#### Acceptance criteria

- User can start a new file from a built-in template in 1-2 clicks

### 8.9 Archive and history

#### Goal

Reduce clutter and support retrieval of old diagrams.

#### Requirements

- Archive view for removed/inactive files
- Optional recent export history
- Restore archived file

#### Acceptance criteria

- User can remove files from active workspace without losing them permanently

### 8.10 Status and diagnostics

#### Goal

Expose useful system/editor feedback without clutter.

#### Requirements

- Footer status bar
- Render state:
  - idle
  - rendering
  - rendered
  - error
- Render performance metric
- Cursor line/column
- File encoding placeholder
- Optional dirty state indicator

#### Acceptance criteria

- User can tell if the preview is up to date
- User can diagnose render issues faster

### 8.11 Settings and preferences

#### Goal

Support stable user-level preferences across sessions.

#### Requirements

- Default export format
- Clipboard copy format
- Last selected theme/config behavior
- Workspace restore behavior
- Optional UI density / panel width preferences

#### Acceptance criteria

- Preferences persist across relaunches

## 9. UX and UI Requirements

### 9.1 Design direction

- Professional desktop app rather than a toy utility
- Clean, structured, technical but approachable
- Strong visual hierarchy
- Compact but readable controls

### 9.2 Layout requirements

- Persistent top nav
- Persistent left explorer
- Two-column main workspace
- Sticky headers for editor and preview panes
- Persistent bottom status bar

### 9.3 Interaction requirements

- Clear active state for selected section/file
- Hover/pressed states for interactive controls
- Contextual empty states
- Non-blocking success notifications for export/save
- Recoverable error messages

## 10. Non-functional Requirements

### 10.1 Performance

- Editor input should remain responsive for medium Mermaid files
- Render should feel near-real-time for common diagrams
- Export should complete without UI freezing for typical diagrams

### 10.2 Reliability

- No silent export failure
- No config loss on restart
- Project open/save must be resilient to malformed JSON with clear error messaging

### 10.3 Maintainability

- Separate shell/navigation UI from editor/preview logic
- Separate Mermaid config state from file/project state
- Keep export logic isolated from UI components

## 11. Requirement Breakdown by Priority

### 11.1 P0: Product completion baseline

- App shell
- File explorer
- Open/save `.mmd`
- New file flow
- Theme/config panel polish
- Unified export toolbar
- Status bar
- Preview zoom/fit/fullscreen
- Better error states

### 11.2 P1: Product usability and workflow depth

- Templates module
- Archive/recent files
- Rename/duplicate/delete file
- Save project/workspace session
- Sequence export polish
- Export dropdown with remembered preferences

### 11.3 P2: Advanced workflow enhancements

- Search/filter templates
- Multi-tab editing
- Diff/history view
- Batch export
- Keyboard shortcut system
- Workspace settings panel

## 12. Development Plan

### Phase 1: Product shell and file workflow

#### Objective

Turn the current single-screen tool into a multi-area desktop product.

#### Deliverables

- Top nav
- Left file explorer
- Main split-pane shell
- Status bar
- File CRUD basics
- Recent files

#### Suggested tasks

1. Build layout shell components
2. Introduce app-level navigation state
3. Add file model and workspace state store
4. Wire open/save/new flows
5. Persist recent files and last active file

### Phase 2: Editor and preview polish

#### Objective

Bring editing and preview UX closer to the high-fidelity target.

#### Deliverables

- Editor header
- Preview header
- Canvas controls
- Empty/loading/error states
- Better action grouping

#### Suggested tasks

1. Refactor current editor into pane component
2. Refactor preview into pane component
3. Add zoom/fit/fullscreen controls
4. Add render status lifecycle
5. Add copy code and preview utility actions

### Phase 3: Theme/config and export productization

#### Objective

Make theme/config and export flows feel complete and coherent.

#### Deliverables

- Polished config panel
- Theme selector integration
- Import/export config UX
- Export dropdown / modal
- Success/error toasts

#### Suggested tasks

1. Reorganize config panel UI
2. Add JSON validation feedback
3. Normalize export action design
4. Persist user export preferences
5. Verify theme parity across preview and exports

### Phase 4: Templates and archive

#### Objective

Increase speed to first value and improve document lifecycle.

#### Deliverables

- Templates section
- Built-in template packs
- Archive section
- Restore flow

#### Suggested tasks

1. Define template metadata format
2. Build template gallery UI
3. Create starter template set
4. Add archive state and restore flow

### Phase 5: PPTX quality and advanced productivity

#### Objective

Strengthen the product's differentiation and professional usability.

#### Deliverables

- Flowchart PPT export refinement
- Sequence export refinement
- Shortcut system
- Multi-tab or multi-file enhancements

#### Suggested tasks

1. Improve sequence layout and style fidelity
2. Add unsupported-syntax diagnostics
3. Add keyboard shortcuts
4. Evaluate multi-tab editing architecture

## 13. Suggested Sprint Breakdown

### Sprint 1

- App shell
- Left explorer
- File open/save/new
- Status bar scaffold

### Sprint 2

- Editor/preview headers
- Canvas controls
- Export toolbar redesign
- Empty/error states

### Sprint 3

- Theme/config panel redesign
- Import/export config polish
- Persisted preferences
- Workspace restore

### Sprint 4

- Templates module
- Archive module
- File lifecycle operations

### Sprint 5

- PPTX quality pass
- Sequence export improvements
- Regression coverage expansion

## 14. Technical Implications

### Recommended architecture additions

- App-level store for:
  - navigation
  - workspace/files
  - active document
  - theme/config
  - preferences
- Separate modules for:
  - `workspace`
  - `templates`
  - `archive`
  - `status`
- Shared document model:
  - file metadata
  - Mermaid source
  - Mermaid config
  - derived preview state

### Suggested persistence layers

- Local JSON for project/document files
- Local app preferences store
- Recent files index
- Template metadata bundle

## 15. Risks and Open Questions

### Risks

- UI shell refactor may touch many existing renderer assumptions
- Mermaid preview and PPT export parity will always be partial
- `sequenceDiagram` editable export still needs more stability work
- File explorer/workspace state can become complex without a clear document model

### Open questions

- Is workspace rooted in a real local folder or app-managed virtual project list?
- Should templates be read-only source files or JSON descriptors with categories and previews?
- Should archive mean soft-delete from workspace or a separate local storage area?
- Is multi-tab editing required in v1 or after product shell stabilization?

## 16. Recommendation

The immediate next step should be to prioritize product shell completion before adding more diagram-specific capabilities.

Recommended order:

1. App shell + workspace/file explorer
2. Editor/preview polish and export toolbar redesign
3. Theme/config UX hardening
4. Templates and archive
5. PPTX quality improvements

This gives the product a complete, durable structure and prevents future UI work from repeatedly fighting the current single-screen layout.
