# Electron -> Tauri 迁移计划

## 1. 目标

将当前基于 Electron 的 Mermaid 桌面工具迁移为基于 Tauri 的桌面应用，目标是：

- 显著减小安装包体积
- 提升 Windows 启动速度与内存表现
- 保持现有用户可见功能完整可用
- 保持现有 HTML/CSS/JS UI 主体尽可能复用
- 保持图片导出与 PPTX 导出能力不丢失

本计划以当前 `main` 分支功能为迁移基线。

> 当前执行中的迁移实现已经收敛为：
> `前端复用 + Tauri 命令层 + 前端生成导出二进制`
>
> 也就是说，本轮不再优先引入 Node sidecar，而是优先复用：
> - 浏览器端 SVG -> PNG/JPG 栅格化
> - 浏览器端 PptxGenJS 二进制生成
> - Tauri 仅负责文件系统、对话框与工作区命令

## 2. 当前功能基线

### 2.1 编辑与预览

- Mermaid 代码编辑
- Mermaid 语法高亮
- 自动保存
- 预览区实时渲染
- 预览区缩放、适应窗口、空格抓手平移
- 预览区源码定位高亮

### 2.2 工作区

- 选择工作目录
- 目录树显示，仅展示 `.mmd`
- 新建文件 / 新建文件夹
- 文件拖拽移动
- 文件 / 文件夹重命名
- 删除移动到隐藏 `.Archive`
- 记住上次工作区与上次文件

### 2.3 导出

- 复制图片到剪贴板
- 导出 SVG / PNG / JPG
- 导出 PPTX
- 图片 / PPTX 默认文件名前缀跟随当前 `.mmd`

### 2.4 设置

- 官方 Mermaid 主题
- 自定义 Mermaid config JSON
- 默认图片复制格式
- 中英文界面

### 2.5 PPTX

- Flowchart 可编辑导出
- SequenceDiagram MVP 导出

## 3. 迁移策略

## 3.1 总体架构

迁移后分为三层：

1. `前端 UI 层`
- 继续复用现有 `index.html + styles.css + src/renderer.js`
- 将 `window.electronAPI` 访问替换为统一的桌面适配层

2. `Tauri 原生命令层`
- 负责目录选择、读写文件、工作区树、移动/重命名/归档
- 负责偏好设置持久化
- 负责窗口与路径等桌面能力

3. `浏览器导出层`
- 复用当前 JS 的 Flowchart / Sequence PPT 布局与导出逻辑
- 浏览器端生成 PPTX 二进制
- 浏览器端将 SVG 栅格化为 PNG/JPG
- Tauri 负责保存文件与本地目录操作

## 3.2 为什么先采用“前端导出 + Tauri 存盘”

当前项目的导出链本身主要是 JS 逻辑：

- `PptxGenJS` 可以直接在浏览器端生成二进制
- SVG 栅格化在浏览器端已有可用实现

因此本次迁移优先采用：

- Tauri 负责主应用壳、文件系统和对话框
- 前端继续负责导出数据生成
- Tauri 仅负责保存这些生成好的字节流

这样可以：

- 最大化复用现有前端逻辑
- 降低 Rust 重写成本
- 在不引入 sidecar 的前提下先完成主迁移

## 4. 模块映射

### 4.1 Electron -> Tauri 命令映射

| 当前 Electron IPC | 迁移后 |
| --- | --- |
| `chooseWorkspaceDirectory` | Tauri command + dialog plugin |
| `readWorkspaceTree` | Rust command |
| `createWorkspaceEntry` | Rust command |
| `renameWorkspaceEntry` | Rust command |
| `moveWorkspaceEntry` | Rust command |
| `deleteWorkspaceEntry` | Rust command |
| `readTextFile` | Rust command |
| `saveTextFile` | Rust command + save dialog |
| `writeTextFile` | Rust command |
| `openTextFile` | Rust command + open dialog |
| `saveBinaryFile` | Rust command + save dialog |
| `saveRasterFromSvg` | 前端栅格化 + `saveBinaryFile` |
| `copyRasterFromSvg` | 前端 Clipboard API |
| `savePptxFile` | 前端生成 PPTX bytes + `saveBinaryFile` |

### 4.2 可直接复用模块

- `src/mermaid-config.js`
- `src/mermaid-highlight.js`
- `src/ppt/flowchart/*`
- `src/ppt/sequence/*`
- `src/ppt/export-pptx.js`
- 绝大部分 `index.html`
- 绝大部分 `styles.css`

### 4.3 需要替换的模块

- `main.js`
- `preload.cjs`
- `window.electronAPI` 调用点
- Electron 启动脚本与打包配置

## 5. 迁移步骤

### Phase 0: 准备

- 新建 `codex/tauri-migration` 分支
- 记录当前功能基线
- 引入迁移计划与验证清单

### Phase 1: 工程壳迁移

- 初始化 `src-tauri`
- 接入 Tauri 前端加载当前静态页面
- 保留 npm 前端工程
- 增加开发与构建脚本

### Phase 2: 接口抽象

- 新增 `src/platform/desktop-api.js`
- 前端统一通过 `desktopApi` 调用桌面能力
- Electron 调用路径逐步替换为平台抽象

### Phase 3: 文件系统与工作区

- 在 Rust 中实现：
  - 工作目录选择
  - 树扫描
  - 新建文件 / 文件夹
  - 重命名
  - 移动
  - 删除到 `.Archive`
  - 读写 `.mmd`

### Phase 4: 设置与状态持久化

- 工作区路径
- 上次打开文件
- 主题模式
- Mermaid config
- Editor 字号
- Sidebar 折叠状态
- Pane 宽度

### Phase 5: 导出迁移

- 将 PNG/JPG 导出切到前端栅格化
- 将图片复制切到前端 Clipboard API
- 将 PPTX 导出切到前端二进制生成 + `saveBinaryFile`

### Phase 6: 前端联调

- 替换所有 Electron API 调用
- 预览渲染、导出、工作区、设置全部跑通

### Phase 7: 打包与验证

- Tauri 开发模式验证
- macOS 本机构建
- Windows 打包配置准备
- 功能清单回归

## 6. 验证清单

### 6.1 工作区

- [ ] 选择工作目录
- [ ] 树中仅显示 `.mmd`
- [ ] 新建 `.mmd`
- [ ] 新建文件夹
- [ ] 文件切换自动保存
- [ ] 文件重命名
- [ ] 文件夹重命名
- [ ] 拖拽移动
- [ ] 删除移动到 `.Archive`

### 6.2 编辑器

- [ ] Mermaid 高亮
- [ ] 自动保存
- [ ] Ctrl/Cmd +/-/0 字号
- [ ] 文件名原位修改

### 6.3 预览

- [ ] 默认 fit 完整显示且居中
- [ ] 放大 / 缩小 / fit
- [ ] 空格抓手平移
- [ ] Preview 选中映射源码

### 6.4 设置

- [ ] 官方主题切换
- [ ] 自定义 JSON
- [ ] 默认复制图片格式
- [ ] 界面语言切换

### 6.5 导出

- [ ] Copy Image
- [ ] SVG 导出
- [ ] PNG 导出
- [ ] JPG 导出
- [ ] PPTX 导出
- [ ] 默认文件名前缀与 `.mmd` 同名

### 6.6 图类型

- [ ] Flowchart 预览
- [ ] Flowchart PPTX
- [ ] SequenceDiagram 预览
- [ ] SequenceDiagram PPTX MVP

## 7. 风险

### 7.1 工具链风险

- 当前环境未预装 Rust
- Tauri 构建链需要额外系统依赖

### 7.2 浏览器导出风险

- 浏览器 Clipboard API 在不同平台 WebView 行为可能不同
- 浏览器端 SVG 栅格化对复杂 Mermaid 图可能存在兼容差异

### 7.3 功能保真风险

- PPTX 功能高度依赖现有 JS 导出链
- 浏览器端 PPTX 二进制生成与 Electron 下行为仍需逐项比对

## 8. 执行原则

- 每完成一个清晰的迁移 issue，单独提交
- 每次提交前至少执行：
  - `node --check`
  - `git diff --check`
  - 当前可用回归脚本
- 所有 Electron 相关调用替换完之前，不删除旧实现，先平滑切换

## 9. 本次迁移的完成标准

满足以下条件，视为迁移完成：

- Tauri 开发版可启动
- 不再依赖 Electron 启动应用
- 工作区、编辑、预览、设置、导出全链路可用
- Flowchart 回归通过
- 核心 Sequence 用例可导出
- README 补充 Tauri 运行与打包说明
