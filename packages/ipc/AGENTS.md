# packages/ipc — 进程间 IPC 服务（@gitlens/ipc）

## 面包屑

`packages/ipc/` — 私有 workspace 包，不发布；依赖 `@gitlens/utils`，由 `packages/core` 合并发布。

## 模块职责

- 在 `127.0.0.1` 上创建本地 HTTP IPC 服务器，供同机其他进程（如 `gk` CLI）调用扩展能力。
- 鉴权：监听随机端口（端口 0 由 OS 分配），每次启动生成 uuid 作为 token，请求需携带 token。
- 发现（discovery）：把服务器地址/端口/token 写入临时目录 JSON 文件，供对端进程定位；同时清理崩溃残留的孤儿发现文件。

## 入口与启动

无独立入口，纯库。构建：

```bash
pnpm --filter @gitlens/ipc build    # tsc -b
```

## 对外接口

- `createIpcServer<Request, Response>()` → `Promise<IpcServer>`：`ipcAddress`/`ipcPort`/`ipcToken` 只读属性。
- `IpcServer.registerHandler(name, handler)` → `UnifiedDisposable`（路由为 `/name`，handler 接收 request + searchParams）。
- `IpcServer.dispose()`（同步）/`shutdown()`（异步等待关闭，仅测试等确定性场景用）。
- discovery：`cliDiscoveryDir`、`agentDiscoveryDir`、`getDiscoveryFileName(port)`（`gitlens-ipc-server-<ppid>-<port>.json`）、`parseDiscoveryFileName`、`writeDiscoveryFile`（0600）、`cleanupDiscoveryFile`、`sweepDiscoveryFiles`。

## 关键依赖与配置

- `sideEffects: false`，ESM；运行时仅依赖 `@gitlens/utils`。
- 无端口配置：固定 `127.0.0.1` + 随机端口，避免端口冲突与外部暴露。

## 数据模型

- `IpcDiscoveryData`：`token`/`address`/`port`/`workspacePaths` + 可选 `ideName`/`ideDisplayName`/`scheme`/`pid` + `createdAt`。未知字段被旧 `gk` 二进制忽略，保持向后兼容。
- `IpcHandler<Request, Response>`：`(request, searchParams) => Promise<Response>`。

## 测试与质量

```bash
pnpm --filter @gitlens/ipc test     # mocha --require tsx --ui tdd src/**/__tests__/**/*.test.ts
```

## 常见问题

- **发现目录是跨版本契约**：`cliDiscoveryDir`（`%TEMP%/gitkraken/gitlens`）被旧版 `gk` 扫描，任何写入其中的文件都被视为 CLI 服务器——**绝不要写入 agent-only 发现文件**。`agentDiscoveryDir` 稳定跨版本，旧窗口仍扫描，勿移动。
- **sweep 的判定**：仅当属主进程确证消失（pid `ESCRH`）或服务器不可达（非超时失败）才删除；不可达原因模糊（超时、解析错误）时保留，避免误删存活对端的文件。
- **`dispose()` 是同步的**：需要确定性拆除（测试）时用 `shutdown()`。

## 相关文件清单

- packages/ipc/package.json
- packages/ipc/src/ipcServer.ts
- packages/ipc/src/discovery.ts
- packages/ipc/src/**tests**/ipcServer.test.ts

## 精简变更记录

- 2026-08-15：初版 agent 索引创建。
