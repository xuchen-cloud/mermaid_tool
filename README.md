# Mermaid Tool
<img width="1400" height="900" alt="Snipaste_2026-03-22_23-58-51" src="https://github.com/user-attachments/assets/b06b8b1e-71e6-44c5-9e7c-4a502422b0db" />

中文 | [English](#english)

## 中文

`Mermaid Tool` 是一个基于 `Electron` 的桌面 Mermaid 编辑器。
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
  - 点击预览中的 `flowchart` / `sequenceDiagram` 元素后，在编辑器中高亮对应源码行
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
- 设置项支持：
  - 界面语言切换（中文 / English）
  - 主题切换
  - 自定义 Mermaid JSON 配置
  - 默认剪贴板图片格式（`PNG` / `JPG`）

### 当前支持的图类型

预览渲染：
- Mermaid 官方支持的图类型，按当前 Mermaid 版本能力为准

`PPTX` 导出：
- `flowchart` / `graph`
- `sequenceDiagram`

说明：
- `PPTX` 导出目前是“可编辑 MVP”能力，重点是可编辑而不是像素级完全一致
- `flowchart` 的完成度目前高于 `sequenceDiagram`

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

本项目基于 `Electron`，架构上支持 Windows。
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

`Mermaid Tool` is an `Electron`-based desktop Mermaid editor with realtime preview, workspace-based file management, image export, and editable `PPTX` export.

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
  - clicking `flowchart` / `sequenceDiagram` elements in Preview to highlight source lines in Editor
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
- Settings support:
  - interface language switch (`中文` / `English`)
  - theme selection
  - custom Mermaid JSON config
  - default clipboard image format (`PNG` / `JPG`)

### Supported Diagram Types

Preview rendering:
- Any Mermaid diagram type supported by the current Mermaid version

`PPTX` export:
- `flowchart` / `graph`
- `sequenceDiagram`

Notes:
- `PPTX` export is currently an editable MVP
- `flowchart` support is more mature than `sequenceDiagram`

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

The app is built on `Electron`, so the architecture is compatible with Windows.
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
