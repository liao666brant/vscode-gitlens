# src/system 模块文档

> 面包屑：根 [`AGENTS.md`](../../AGENTS.md) → [`src/AGENTS.md`](../AGENTS.md) ← 本文件（`src/system/AGENTS.md`）

## 模块职责

`src/system/` 是工具库，四个职责分区：

- `utils/`：宿主与 webview 共享的工具（webview 可用）。
- `utils/-webview/`：**仅扩展宿主可用**的工具（`configuration`、`command`、`storage`、`context`、`vscode/` 包装等）——名字里的 `-webview` 即标记，webview 应用不得导入。
- `decorators/`：运行时行为装饰器（`@command`、`@gate` 等宿主侧实现；`@memoize`/`@info` 等基础实现来自 `@gitlens/utils`）。
- `rpc/`：Supertalk RPC 的宿主侧辅助（`handlers`、`abortSignalHandler`、`logger`）。

## 入口与启动

无独立入口，各模块按需导入：

- `configuration`：`Container` 构造时经 `Configuration.configure(context)` 订阅 `onDidChangeConfiguration`；`Container.instance.config` 在初始化前也可读。
- `registerCommand` / `executeCommand`：`extension.ts` 与 `commands.ts` 注册入口。
- `Storage`：`extension.ts` 创建后传入 `Container.create()`。

## 对外接口

- `Configuration`（`-webview/configuration.ts`）：类型化读取 `gitlens.*`（`get`/`getAll`/`getCore`/`getAny`）、`onDidChange`/`onDidChangeAny`、`applyOverrides`（测试用）。
- `registerCommand` / `executeCommand` / `executeCoreCommand`（`-webview/command.ts`）。
- `Storage`（`-webview/storage.ts`）：`get`/`store`/`delete`（user/workspace 作用域）。
- `setContext` / `getContext`（`-webview/context.ts`）。
- 装饰器：`@command`（`decorators/command.ts`，类装饰器）、`@gate`（`decorators/gate.ts`）、`@debug`/`@trace` 宿主侧封装。
- `rpc/handlers.ts`：Date/Map/Set/RegExp 等 RPC 传输 handler。

## 关键依赖与配置

- `@gitlens/utils`（`packages/utils`）：`debounce`、`iterable`、`event`、`logger`、基础装饰器（`memoize`、`log`、`gate`）等。
- `@eamodio/supertalk` / `@eamodio/supertalk-signals`：RPC 实现（经 `rpc/` 封装）。
- `src/config.ts`：`Config` / `ConfigPath` 类型（`configuration` 的类型参数源）。
- `src/constants.ts`：`extensionPrefix`（`gitlens`）。

## 数据模型

- `Config` / `ConfigPath` / `ConfigPathValue`（`src/config.ts`）：配置路径的类型映射，`Configuration.get` 的泛型依据。
- `IpcMessage` 等 IPC 模型定义在 `src/webviews/ipc/models/`，经 `system/ipcSerialize.ts` 序列化。

## 测试与质量

- 单元测试：`src/system/__tests__/`。
- 质量：`pnpm run check`；`-webview/` 与 `rpc/` 的改动注意 host/webview 边界（webview 构建不得引入）。

## 常见问题

- **`utils/-webview/` 被 webview 导入**：该目录只编译进宿主目标；webview 应用（`src/webviews/apps/`）导入它会构建失败。共享逻辑放 `utils/`。
- **`@gate` 死锁**：`@gitlens/utils` 的 gate 默认 5 分钟超时（根文档「装饰器系统」）；宿主侧 `gate.ts` 在死锁时经懒加载 `@env/providers.js` 上报遥测——勿改为静态导入（循环依赖）。
- **`getScopedLogger` 时序**：带日志装饰器的方法必须在任何 `await` 之前调用 `getScopedLogger`（浏览器限制）。
- **`Configuration` overrides**：`applyOverrides` 仅用于测试/配置预览，`clearOverrides` 会保留 `onChange` 到微任务后，勿依赖 override 的持久性。

## 相关文件清单

- `src/system/-webview/configuration.ts` — 类型化配置读取（宿主）
- `src/system/-webview/command.ts` — 命令注册与执行（宿主）
- `src/system/-webview/storage.ts` — 存储服务（宿主）
- `src/system/-webview/context.ts` — VS Code 上下文键（宿主）
- `src/system/decorators/gate.ts` — gate 封装 + 死锁遥测
- `src/system/decorators/command.ts` — `@command` 类装饰器
- `src/system/rpc/handlers.ts` — Supertalk 默认 handlers
- `src/system/ipcSerialize.ts` — IPC 数据序列化
- `src/system/webview.ts` — webview 命令链接等共享工具
- `src/config.ts` — `Config` / `ConfigPath` 类型源

## 精简变更记录

- 2026-08-15：创建本模块文档（初次索引，基线 `0be2fef52`）。
