# Tauri 迁移验证记录

本文档记录 `codex/tauri-migration` 分支当前阶段的迁移验证结果。

## 1. 验证环境

- 仓库路径：`/Users/xuchen/mermaid_tool`
- 迁移分支：`codex/tauri-migration`
- 平台：macOS Apple Silicon
- Rust 工具链：`rustup` stable
- Tauri CLI：`@tauri-apps/cli`

## 2. 构建架构确认

当前迁移后的桌面结构为：

- 前端 UI：继续复用现有 `index.html + styles.css + src/renderer.js`
- 桌面能力：通过 `src/platform/desktop-api.js` 统一走 Electron/Tauri 适配层
- Tauri 命令层：`src-tauri/src/commands.rs`
- 导出逻辑：
  - PNG/JPG：浏览器端栅格化 + `saveBinaryFile`
  - Clipboard：浏览器端 Clipboard API
  - PPTX：浏览器端 `PptxGenJS` 生成二进制 + `saveBinaryFile`

## 3. 前端资源验证

### 3.1 精简前端构建

命令：

```bash
npm run build:tauri-frontend
```

结果：

- 成功生成 `dist-tauri`
- 生成文件：
  - `dist-tauri/index.html`
  - `dist-tauri/styles.css`
  - `dist-tauri/src/renderer.js`
  - `dist-tauri/package.json`

体积：

- `dist-tauri`: `3.4M`

结论：

- Tauri 不再直接使用项目根目录作为前端资源目录
- 已经避免把整个仓库和前端开发结构直接暴露给打包阶段

## 4. 前端逻辑验证

### 4.1 JS 语法检查

命令：

```bash
node --check scripts/build-tauri-frontend.mjs
node --check src/platform/desktop-api.js
node --check src/renderer.js
node --check src/ppt/export-pptx.js
```

结果：

- 全部通过

### 4.2 Mermaid 相关自动化测试

命令：

```bash
npm run test:flowchart-parse
npm run test:sequence-parse
npm run test:highlight
npm run regression:flowchart
npm run test:pptx-bytes
```

结果：

- `test:flowchart-parse`：PASS
- `test:sequence-parse`：PASS
- `test:highlight`：PASS
- `regression:flowchart`：PASS
- `test:pptx-bytes`：PASS

关键输出：

- `flowchart bytes: 57045`
- `sequence bytes: 55626`

结论：

- Flowchart 解析、Sequence 解析、Mermaid 语法高亮正常
- Flowchart 回归导出未退化
- 浏览器端 PPTX 二进制生成链路可用

## 5. Rust / Tauri 命令层验证

### 5.1 cargo check

命令：

```bash
PATH="$(brew --prefix rustup)/bin:$PATH" cargo check --manifest-path src-tauri/Cargo.toml
```

结果：

- PASS

### 5.2 cargo test

命令：

```bash
PATH="$(brew --prefix rustup)/bin:$PATH" cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
```

结果：

- PASS

当前 Rust 单元测试覆盖：

- 工作区树过滤隐藏文件和非 `.mmd`
- 自动补全文件名序号
- 删除移动到隐藏 `.Archive`
- 新建默认 `.mmd` 文件
- 重命名保留 `.mmd` 后缀
- 在工作区内移动文件

## 6. Tauri 运行验证

### 6.1 开发态启动

命令：

```bash
npm run tauri:dev
```

结果：

- PASS
- `beforeDevCommand` 成功执行 `npm run build:tauri-frontend`
- `target/debug/app` 成功启动

### 6.2 发布态构建

命令：

```bash
npm run tauri:build
```

结果：

- PASS
- 产物：
  - `/Users/xuchen/mermaid_tool/src-tauri/target/release/bundle/macos/Mermaid Tool.app`
  - `/Users/xuchen/mermaid_tool/src-tauri/target/release/bundle/dmg/Mermaid Tool_0.1.0_aarch64.dmg`

产物体积：

- `.app`: `9.1M`
- `.dmg`: `4.0M`

## 7. 功能点状态

### 7.1 已迁移并经过自动化/构建验证

- 工作区目录选择命令层已迁移
- 工作区树扫描已迁移
- 新建文件 / 新建文件夹已迁移
- 重命名已迁移
- 删除到 `.Archive` 已迁移
- 文件读写已迁移
- Flowchart 预览链路已保留
- SequenceDiagram 预览链路已保留
- PNG/JPG 导出已切到前端栅格化 + Tauri 保存
- PPTX 导出已切到前端字节生成 + Tauri 保存

### 7.2 已在本机完成运行级验证

- Tauri dev 能启动
- Tauri release 能构建出 macOS 应用与 DMG

### 7.3 仍建议补的真机验证

以下项目虽然代码链路已迁移完成，但仍建议在 GUI 真机上点按一次确认：

- 工作区目录选择与文件树交互
- 点击文件切换与自动保存
- 图片复制到剪贴板
- PNG/JPG/SVG/PPTX 导出对话框体验
- Preview 缩放与空格抓手
- Settings 中主题与默认复制格式

## 8. Windows 说明

当前迁移已经完成到 Tauri，架构上更适合 Windows 分发。

但本次验证是在 macOS 上完成的，因此：

- Tauri 应用主结构已经具备 Windows 迁移基础
- 尚未在 Windows 真机上产出 `.msi` / `.exe`
- 建议下一步在 Windows 环境或 CI 中执行：

```bash
npm install
npm run tauri:build
```

并补一轮以下验证：

- 工作区文件系统行为
- Clipboard 图像复制
- PNG/JPG 导出
- PPTX 导出
- 打开生成的 PowerPoint 文件

## 9. 当前结论

本分支已经完成：

- 从 Electron 主进程能力向 Tauri 命令层的核心迁移
- 前端资源精简打包
- Tauri 开发态启动验证
- Tauri 发布态构建验证
- Flowchart / Sequence / 高亮 / PPTX 关键链路自动验证

当前可以将 `codex/tauri-migration` 视为：

- **迁移主链已打通**
- **macOS 构建已验证**
- **进入 Windows 真机验证与交互细节收口阶段**
