# src/commands 模块文档

> 面包屑：根 [`AGENTS.md`](../../AGENTS.md) → [`src/AGENTS.md`](../AGENTS.md) ← 本文件（`src/commands/AGENTS.md`）

## 模块职责

`src/commands/` 实现全部命令：单个命令文件（`*.ts`）与子目录（`git/`、`ghpr/`、`quick-wizard/`、`signing/`）。每个命令文件在模块顶层完成注册（副作用），`src/commands.ts` 统一导入它们。

命令 id 的**唯一事实源**是 `contributions.json`（`contributes/commands` 等），生成链路：`pnpm run generate:contributions`（写入 `package.json`）与 `pnpm run generate:commandTypes`（生成 `src/constants.commands.generated.ts` 的 `ContributedCommands`），再由 `src/constants.commands.ts` 汇总为 `GlCommands` 联合类型。

## 入口与启动

- `src/extension.ts` 导入 `src/commands.ts`（副作用）；`once(container.onReady)` 后 `registerCommands(container)`（`src/system/-webview/command.ts`）执行实际注册。
- 注册形态：
  - `@command(...)` 类装饰器 + `createCommandDecorator`（`src/system/decorators/command.ts`）；
  - 继承 `GlCommandBase` / `ActiveEditorCommand` / `EditorCommand`（`commandBase.ts`），构造函数内 `registerCommand` / `registerTextEditorCommand`。

## 对外接口

- 命令基类：`GlCommandBase`（普通命令）、`ActiveEditorCommand`（`expectsEditor: true`，先解析编辑器与 URI 再 `execute(editor, uri, ...)`）、`ActiveEditorCachedCommand`（记录 `getLastCommand()`）、`EditorCommand`（文本编辑器命令，带 `TextEditorEdit`）。
- 命令上下文：`parseCommandContext(command, options, ...args)`（`commandContext.utils.ts`）→ `CommandContext`（`commandContext.ts`）。
- `GlCommands` / `GlWebviewCommands` / `GlCommandsDeprecated`（`constants.commands.ts`）：命令 id 类型。
- `executeCommand` / `registerCommand`（`src/system/-webview/command.ts`）。

## 关键依赖与配置

- `src/constants.commands.ts` + `src/constants.commands.generated.ts` + `contributions.json`（id 源，见上）。
- `src/system/-webview/command.ts`（注册/执行）、`commandContext.ts`（上下文解析）。
- `Container`（经 `registerCommands(container)` 注入服务）。
- webview 侧命令：`createWebviewCommandLink`（`src/system/webview.ts`）与 `GlWebviewCommands` 后缀拼接。

## 数据模型

- `CommandContext`（`commandContext.ts`）：解析后的命令执行上下文（editor、uri、scm、state 等）。
- `CommandContextParsingOptions`（`commandContext.utils.ts`）：上下文解析选项（如 `expectsEditor`）。

## 测试与质量

- 单元测试：`src/commands/__tests__/`。
- 质量：`pnpm run check`；新增命令后必须重新生成 `package.json` contributions 与命令类型（见根文档「关键规则」）。

## 常见问题

- **命令 id 手写字符串**：一律使用 `GlCommands` 常量（generated 文件导出）；先在 `contributions.json` 声明，再跑 `generate:commandTypes`，否则类型缺失。
- **命令重复注册**：命令类在模块顶层 `new` 即注册；`src/commands.ts` 已副作用导入，勿再手动实例化。
- **`ActiveEditorCommand` 未在编辑器上下文**：`expectsEditor` 解析失败时行为取决于 `parseCommandContext`；扩展命令执行场景（无活动编辑器）请选用 `GlCommandBase`。
- **废弃命令**：`GlCommandsDeprecated` 用于旧 id 兼容，新增命令不应再创建废弃 id。

## 相关文件清单

- `src/commands.ts` — 命令副作用注册清单（extension.ts 导入）
- `src/commands/commandBase.ts` — `GlCommandBase` / `ActiveEditorCommand` / `EditorCommand`
- `src/commands/commandContext.ts` — `CommandContext`
- `src/commands/commandContext.utils.ts` — `parseCommandContext`
- `src/commands/copyCurrentBranch.ts` — 简单命令参考
- `src/commands/gitWizard.ts` — 复杂多命令参考
- `src/constants.commands.ts` — `GlCommands` 联合类型
- `src/constants.commands.generated.ts` — 生成命令常量（勿手改）
- `contributions.json` — 命令/菜单/键位 id 源
- `src/system/-webview/command.ts` — `registerCommand` / `executeCommand`

## 精简变更记录

- 2026-08-15：创建本模块文档（初次索引，基线 `0be2fef52`）。
