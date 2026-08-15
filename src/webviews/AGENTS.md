# src/webviews 模块文档

> 面包屑：根 [`AGENTS.md`](../../AGENTS.md) → [`src/AGENTS.md`](../AGENTS.md) ← 本文件（`src/webviews/AGENTS.md`）

## 模块职责

`src/webviews/` 是 webview 基础设施与应用：

- **宿主控制器**：`WebviewsController`（注册 panel/view/custom-editor）、`WebviewController`（单实例生命周期：ready/replay、隐藏缓冲、focus/visibility）、`webviewProvider.ts`（provider 接口）、`webviewCommandRegistrar.ts`。
- **经典 IPC**：`ipc/`（`handlerRegistry.ts` 的 `@ipcCommand`/`@ipcRequest` 装饰器、`models/ipc.js` 的 `IpcCommand`/`IpcRequest`/`IpcNotification`），核心消息定义在 `protocol.ts`。
- **Supertalk RPC**：`rpc/`（`rpcHost.ts` 宿主侧、事件可见性缓冲 `eventVisibilityBuffer.ts`）。
- **Lit 应用**：`apps/`（仅 Lit）——`apps/shared/` 公共基础（`appBase.ts`、`ipc.ts`、`rpcClient.ts`、组件/上下文），`rebase/`、`commitDetails/`、`settings/` 等应用。
- **协议**：`protocol.ts`（core IPC：ready、focus/visibility、command/execute、configuration/update、telemetry）。

## 入口与启动

- `Container` 构造 `WebviewsController` + `WebviewCommandRegistrar`（`container.ts`），随后 `Views` 经 `registerWebviewViews()` 注册 webview 视图。
- provider 模式：`registerWebviewView(descriptor, resolveProvider)` / `registerWebviewPanel` → 懒创建 `WebviewController.create()` → `resolveProvider` 返回 `WebviewProvider`。
- 生命周期：webview 加载 → `WebviewReadyRequest`（核心 IPC）→ 宿主回复 bootstrap 状态并开始 replay 缓冲消息。

## 对外接口

- `WebviewProvider<State, SerializedState, ShowingArgs>`：`includeBootstrap/includeHead/includeBody`、`onReady`、`onReconnect`（iframe 重载后宿主已自动 replay IPC 日志，仅 IPC 日志之外的副作用用它）、`onRefresh`、`getRpcServices()`、`getTelemetryContext()`。
- `WebviewViewProxy` / `WebviewPanelProxy`（`webviewsController.ts`）：`show/refresh/close`、`canReuseInstance`。
- IPC：`@ipcCommand(msgType)`（即发即弃）/ `@ipcRequest(msgType)`（自动 `host.respond`）；消息类型由 `IpcCommand`/`IpcRequest`/`IpcNotification` 实例定义（`ipc/models/ipc.js`）。
- RPC：`RpcHost`（宿主侧 expose 服务，`nestedProxies` 默认开启；supertalk Connection 不支持重复 expose，**重连需新建 Connection**）。
- webview 侧：`HostIpc`（`apps/shared/ipc.ts`）、`RpcController`/`rpcClient.ts`（`wrapServices`）、`GlWebviewApp`（Lit 基类）。

## 关键依赖与配置

- `@eamodio/supertalk` / `@eamodio/supertalk-signals`（RPC 传输与信号）、`fflate`（bootstrap 压缩，宿主 deflate / 应用 inflate）、`@gitlens/utils`。
- Lit 技术栈：`lit`、`@lit/context`、`@lit-labs/signals`（仅 `apps/` 内）。
- `constants.views.ts`（`WebviewIds`/`WebviewViewTypes` 等）、`constants.commands.ts`（`GlWebviewCommands`）。
- 配置：`UpdateConfigurationCommand`/`DidChangeConfigurationNotification` 双向同步 `Config`（见 `protocol.ts`）。

## 数据模型

- `IpcMessage`：`IpcCommand`（无响应）/ `IpcRequest`（期望响应）/ `IpcNotification`（宿主→webview 状态更新）。
- `WebviewState<WebviewIds>`（`protocol.ts`）：bootstrap 状态（webviewId/instanceId/clientId 等）。
- `SerializedState`：provider 持久化状态（经 `serializeIpcData`/`deserializeIpcData`，`src/system/ipcSerialize.js`）。
- RPC 消息：`isRpcMessage` 判定（`rpc/constants.ts`），与经典 IPC 并行传输。

## 测试与质量

- 无障碍是硬要求：焦点管理、focus trap、ARIA、tooltip 键盘可达、`--vscode-*` 颜色变量——见 `docs/accessibility.md`。
- `src/webviews/apps/**` 被 `tsconfig.node.json` 与 `tsconfig.browser.json` **同时排除**，由 webpack 单独打包（`build:webviews`）；`pnpm run check` 之外注意 webview 构建链。
- E2E 覆盖主要流程（`tests/e2e/`）。

## 常见问题

- **ready/replay 机制**：宿主收到 `WebviewReadyRequest` 后重放隐藏缓冲（`EventVisibilityBuffer`）中的 post-bootstrap IPC 日志；iframe 重载（同一 `clientId` 判定，见 `apps/shared/ipc.ts`）由 `onReconnect` 处理——**不要在 provider 里重复 push 状态**，否则消息翻倍。
- **RPC expose 时序**：`RpcHost` 延迟握手——`expose()` 必须等 `WebviewReadyRequest`，否则 ready 信号早于 webview 脚本加载而丢失。
- **RPC 重连**：supertalk `Connection` 不支持 re-expose；刷新后必须重建 Connection + endpoint。
- **`nestedProxies` 勿关**：JSON 传输会破坏嵌套 Promise/Date（如 GetOverviewBranch 的六个 lazy Promise 字段），依赖深层遍历。
- **键盘/无障碍回归**：改 `apps/shared` 组件后按 `docs/accessibility.md` 核对；自定义交互元素需 `tabindex` + Enter/Space 处理与可见焦点环。
- **`WebviewStateProvier`（原样拼写）**：`webviewProvider.ts` 中的历史命名，新代码按 `WebviewProvider` 走。

## 相关文件清单

- `src/webviews/webviewController.ts` — 控制器基类（ready/replay、隐藏缓冲、序列化）
- `src/webviews/webviewsController.ts` — panel/view 注册与 proxy
- `src/webviews/webviewProvider.ts` — provider 接口（含 `getRpcServices`）
- `src/webviews/protocol.ts` — 核心 IPC 消息定义
- `src/webviews/ipc/handlerRegistry.ts` — `@ipcCommand` / `@ipcRequest` 装饰器
- `src/webviews/rpc/rpcHost.ts` — Supertalk 宿主侧 RPC
- `src/webviews/apps/shared/appBase.ts` — Lit 应用基类（`GlWebviewApp`）
- `src/webviews/apps/shared/ipc.ts` — webview 侧 `HostIpc`（clientId/重载判定）
- `src/webviews/apps/shared/rpcClient.ts` — webview 侧 RPC 客户端
- `src/webviews/rebase/rebaseWebviewProvider.ts` — rebase 编辑器 provider 参考实现

## 精简变更记录

- 2026-08-15：创建本模块文档（初次索引，基线 `0be2fef52`）。
