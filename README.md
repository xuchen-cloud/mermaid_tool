# Mermaid Tool
<img width="1400" height="900" alt="Snipaste_2026-03-22_23-58-51" src="https://github.com/user-attachments/assets/b06b8b1e-71e6-44c5-9e7c-4a502422b0db" />

中文 | [English](#english)

## 中文

`Mermaid Tool` 是一个桌面 Mermaid 编辑器，当前默认以 `Tauri` 运行，并保留部分 `Electron` 兼容代码。
它提供实时渲染、工作目录管理、图片导出，以及可编辑 `PPTX` 导出的能力，适合日常绘制流程图、时序图和内部方案图。

### 当前功能

- 实时编辑 Mermaid 代码并即时渲染预览
- 支持工作目录（Workspace）模式管理 `.mmd` 文件
- 左侧项目树支持：
  - 新建 `.mmd` 文件
  - 新建文件夹
  - 文件/文件夹重命名
  - 删除时移动到工作目录下隐藏的 `.Archive` 文件夹
- 切换文件时自动保存当前修改
- 编辑区支持 Mermaid 语法高亮
- 编辑区支持：
  - `Tab` / `Shift + Tab` 单行与多行缩进
  - 点击预览中的 `flowchart` / `sequenceDiagram` / `pie` / `journey` / `classDiagram` / `erDiagram` / `stateDiagram` 元素后，在编辑器中高亮对应源码行
- 编辑区支持快捷键调整字号：
  - `Ctrl/Cmd +`
  - `Ctrl/Cmd -`
  - `Ctrl/Cmd 0`
- 工作区支持排序：
  - `Name`
  - `Updated`
  - `Created`
- 预览区支持：
  - 缩放
  - 鼠标悬浮时 `Cmd/Ctrl + 滚轮` 缩放
  - 鼠标悬浮时按住空格键抓手平移
  - 自适应铺满当前预览区域
  - 复制图片到剪贴板
  - 导出 `SVG`、`PNG`、`JPG`
  - 导出 `PPTX`
- 支持 Mermaid 官方主题与自定义 Mermaid config JSON
- 支持 `AI+`：
  - 在设置中开启或关闭
  - 配置 OpenAI-compatible 的 `API Base URL`、`Model`、`Token`
  - 在编辑区通过自然语言生成 Mermaid
  - 空编辑器时显示 `AI 新建`，有内容时显示 `AI 修改`
  - 生成结果直接进入主编辑器，不再弹出独立结果窗口
  - 支持流式输出，AI 返回内容时会持续写入编辑器
  - 支持基于当前图做 diff/merge 更新，并在同一编辑器中展示统一 diff 装饰
  - 支持 `Adjust` / `Accept` / `Discard` 工作流
- 设置项支持：
  - 界面语言切换（中文 / English）
  - 主题切换
  - 自定义 Mermaid JSON 配置
  - 默认剪贴板图片格式（`PNG` / `JPG`）
  - `AI+` 开关与 API 配置

### 当前支持的图类型

预览渲染：
- Mermaid 官方支持的图类型，按当前 Mermaid 版本能力为准

`PPTX` 导出：
- `flowchart` / `graph`
- `sequenceDiagram`
- `pie`
- `journey`
- `classDiagram`
- `erDiagram`
- `stateDiagram` / `stateDiagram-v2`

说明：
- `PPTX` 导出目前是“可编辑 MVP”能力，重点是可编辑而不是像素级完全一致
- `flowchart` 的完成度目前高于 `sequenceDiagram`
- `pie` / `journey` / `classDiagram` / `erDiagram` / `stateDiagram` 当前优先覆盖常见语法

### 界面说明

#### 1. Top Bar

- `Projects`：选择本地工作目录
- 右上角 `Settings`：打开设置窗口

#### 2. Workspace

- 用于浏览当前工作目录中的 Mermaid 文件
- 只展示文件夹和 `.mmd` 文件
- 支持按名称、更新时间、创建时间排序
- 支持右键菜单：
  - `New file`
  - `New folder`
  - `Rename`
  - `Delete`

#### 3. Editor

- 中间区域用于编辑 Mermaid 源码
- 顶部可修改当前文件名（仅修改 `.mmd` 前缀）
- 文件内容会自动保存
- 支持多行 `Tab` / `Shift + Tab` 缩进
- 预览点击可联动高亮对应源码行
- `AI+` 会以内联浮层方式出现在编辑器顶部
- AI 生成时，Mermaid 草稿会直接流式写入当前编辑器
- AI 修改时，新增与删除会在同一个编辑器中以 unified diff 风格展示

#### 4. Diagram Preview

- 右侧区域展示当前 Mermaid 图
- 支持 `Cmd/Ctrl + 滚轮` 缩放和空格拖动画布查看细节
- 支持导出和复制图片

### 设置说明

点击右上角 `Settings` 后可以配置：

#### Language

- `中文`
- `English`

#### Theme

- `Official`：选择 Mermaid 官方主题
  - `default`
  - `neutral`
  - `dark`
  - `forest`
  - `base`
- `Custom`：粘贴和编辑 Mermaid config JSON

#### Clipboard

- 设置默认复制图片格式：
  - `PNG`
  - `JPG`

#### AI+

- 开启或关闭 `AI+`
- 配置：
  - `API Base URL`
  - `Model`
  - `API Token`
  - `System Prompt Template`
  - `User Prompt Template`
- 未启用 `AI+` 时，设置中只显示启用开关；启用后才展开其余配置
- 支持在保存前测试 API 是否可连通，可直接使用当前输入的 token
- Prompt 模板可在设置中直接修改；用户模板支持 `{{prompt}}`、`{{mode_instruction}}`、`{{current_diagram_section}}`、`{{repair_section}}`
- 已保存的 token 会以本地加密二进制文件写入配置目录，不会明文落盘；设置中会以密码掩码态显示，而不是明文回填
- `AI+` 内联编辑器支持：
  - 从自然语言生成整张 Mermaid 图
  - 基于当前编辑器中的 Mermaid 做合并更新
  - 流式把生成结果直接写入主编辑器
  - 生成结束后通过 `Adjust`、`Accept`、`Discard` 决定是否保留结果
  - 先做本地校验；即使校验失败，仍然允许继续手改、接受或放弃

说明：
- `AI+` 当前只在 `Tauri` 运行时可用
- 请求走桌面端命令，不从前端直接发起网络请求

### 文件与保存机制

- 新建文件时会自动创建 `.mmd`
- 编辑器内容修改后会自动保存
- 切换文件时会自动保存当前文件
- 文件重命名时会保留 `.mmd` 后缀
- 删除文件/文件夹不会直接永久删除，而是移动到工作目录下隐藏的 `.Archive` 目录

### 导出说明

支持导出：

- `SVG`
- `PNG`
- `JPG`
- `PPTX`

导出时默认文件名前缀会跟随当前 `.mmd` 文件名。

### Windows 使用说明

本项目当前默认以 `Tauri` 运行；如果你需要 Windows 支持，建议优先验证 `Tauri` 构建链路。
如果你想在 Windows 电脑上使用，当前最直接的方式是源码运行：

```bash
npm install
npm start
```

前提：
- 已安装 Node.js
- Windows 环境可以正常安装依赖

说明：
- 当前仓库还没有正式发布的 Windows 安装包
- 如果后续需要双击安装版，需要额外补 Windows 打包配置

### 本地启动

```bash
npm install
npm start
```

### 回归测试

当前内置了 `flowchart PPTX` 回归样例，可执行：

```bash
npm run regression:flowchart
```

该命令会：

- 解析 `samples/flowchart` 中的 Mermaid 样例
- 运行 flowchart 布局
- 导出对应的 `.pptx`
- 生成回归摘要到 `artifacts/flowchart-regression`

### 当前限制

- `PPTX` 导出仍在持续打磨中，不保证与 SVG 预览完全一致
- `sequenceDiagram` 的 `PPTX` 保真度目前低于 `flowchart`
- 当前更适合作为本地工具和内部生产工具使用

---

## English

`Mermaid Tool` is a desktop Mermaid editor. The current default runtime is `Tauri`, while some `Electron` compatibility code remains in the repository.

### Current Features

- Edit Mermaid code with realtime preview
- Manage `.mmd` files inside a local workspace
- Workspace tree supports:
  - Create new `.mmd` files
  - Create folders
  - Rename files/folders
  - Move deleted items into a hidden `.Archive` folder under the workspace
- Auto-save when editing or switching files
- Mermaid syntax highlighting in the editor
- Editor supports:
  - single-line and multi-line indentation with `Tab` / `Shift + Tab`
  - clicking `flowchart` / `sequenceDiagram` / `pie` / `journey` / `classDiagram` / `erDiagram` / `stateDiagram` elements in Preview to highlight source lines in Editor
- Editor font size shortcuts:
  - `Ctrl/Cmd +`
  - `Ctrl/Cmd -`
  - `Ctrl/Cmd 0`
- Workspace sorting:
  - `Name`
  - `Updated`
  - `Created`
- Preview supports:
  - zoom
  - `Cmd/Ctrl + wheel` zoom while hovering
  - hand-pan with Space while hovering
  - fit-to-frame in the current preview pane
  - copy image to clipboard
  - export `SVG`, `PNG`, `JPG`
  - export `PPTX`
- Support for Mermaid official themes and custom Mermaid config JSON
- `AI+` support:
  - enable or disable it in Settings
  - configure OpenAI-compatible `API Base URL`, `Model`, and `Token`
  - generate Mermaid from natural language
  - show `AI Generate` when the editor is empty and `AI Modify` when it already has content
  - stream generated Mermaid directly into the main editor
  - update the current diagram with diff/merge-aware AI output in the same editor surface
  - use an `Adjust` / `Accept` / `Discard` review flow
- Settings support:
  - interface language switch (`中文` / `English`)
  - theme selection
  - custom Mermaid JSON config
  - default clipboard image format (`PNG` / `JPG`)
  - `AI+` toggle and API configuration

### Supported Diagram Types

Preview rendering:
- Any Mermaid diagram type supported by the current Mermaid version

`PPTX` export:
- `flowchart` / `graph`
- `sequenceDiagram`
- `pie`
- `journey`
- `classDiagram`
- `erDiagram`
- `stateDiagram` / `stateDiagram-v2`

Notes:
- `PPTX` export is currently an editable MVP
- `flowchart` support is more mature than `sequenceDiagram`
- `pie` / `journey` / `classDiagram` / `erDiagram` / `stateDiagram` support currently target common syntax only

### UI Overview

#### 1. Top Bar

- `Projects`: choose a local workspace directory
- `Settings`: open the settings dialog

#### 2. Workspace

- Browse Mermaid files in the current workspace
- Only folders and `.mmd` files are shown
- Sort by name, updated time, or created time
- Right-click actions:
  - `New file`
  - `New folder`
  - `Rename`
  - `Delete`

#### 3. Editor

- Edit Mermaid source in the center pane
- Rename the current file from the editor header
- File content is auto-saved
- Supports multi-line `Tab` / `Shift + Tab` indentation
- Preview selection can highlight matching source lines
- `AI+` appears as a compact inline dock at the top of the editor
- AI generation streams Mermaid text directly into the active editor
- AI modify mode shows unified diff-style decorations inside that same editor

#### 4. Diagram Preview

- View the rendered diagram on the right side
- Zoom with `Cmd/Ctrl + wheel` and pan with Space-drag while hovering
- Copy images and export files

### Settings

Open `Settings` from the top-right corner to configure:

#### Language

- `中文`
- `English`

#### Theme

- `Official`: choose Mermaid official themes
  - `default`
  - `neutral`
  - `dark`
  - `forest`
  - `base`
- `Custom`: paste and edit Mermaid config JSON

#### Clipboard

- Set the default copied image format:
  - `PNG`
  - `JPG`

#### AI+

- Enable or disable `AI+`
- Configure:
  - `API Base URL`
  - `Model`
  - `API Token`
  - `System Prompt Template`
  - `User Prompt Template`
- When `AI+` is disabled, Settings shows only the enable toggle; the rest of the AI fields expand only after enabling it
- Test API connectivity before saving, including with the currently typed token
- Prompt templates can be edited in Settings; the user template supports `{{prompt}}`, `{{mode_instruction}}`, `{{current_diagram_section}}`, and `{{repair_section}}`
- Saved tokens are written as a locally encrypted binary file in the app config directory and are shown back only as a masked password field
- The inline `AI+` editor supports:
  - generating a full Mermaid diagram from natural language
  - merging requested changes into the current Mermaid source
  - streaming generated text directly into the main editor
  - deciding with `Adjust`, `Accept`, or `Discard` after generation
  - continuing to edit, accept, or discard even if local Mermaid validation still fails

Notes:
- `AI+` is currently available only in the `Tauri` runtime
- Network requests go through desktop commands, not renderer-side fetch calls

### File and Save Behavior

- New files are created as `.mmd`
- Editor content is auto-saved
- Switching files auto-saves the current file
- File rename keeps the `.mmd` suffix
- Delete does not permanently remove items immediately; they are moved into a hidden `.Archive` folder

### Export

Supported export formats:

- `SVG`
- `PNG`
- `JPG`
- `PPTX`

Export dialogs use the current `.mmd` filename as the default output prefix.

### Windows Usage

The app currently defaults to `Tauri`. If you need Windows support, validate the `Tauri` build chain first.
The most direct way to use it on Windows today is to run it from source:

```bash
npm install
npm start
```

Requirements:
- Node.js installed
- A Windows environment capable of installing project dependencies

Notes:
- There is no official packaged Windows installer in this repository yet
- A proper installer build would require additional Windows packaging work

### Run Locally

```bash
npm install
npm start
```

### Regression Test

Run the local `flowchart PPTX` regression suite:

```bash
npm run regression:flowchart
```

This command will:

- parse Mermaid samples in `samples/flowchart`
- run the flowchart layout engine
- export `.pptx` artifacts
- write summaries into `artifacts/flowchart-regression`

### Current Limitations

- `PPTX` export is still under active refinement and is not pixel-identical to SVG preview
- `sequenceDiagram` `PPTX` fidelity is currently lower than `flowchart`
- The app is best suited for local/internal production use at the current stage
