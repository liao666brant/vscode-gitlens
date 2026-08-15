# src/env 模块文档

> 面包屑：根 [`AGENTS.md`](../../AGENTS.md) → [`src/AGENTS.md`](../AGENTS.md) ← 本文件（`src/env/AGENTS.md`）

## 模块职责

`src/env/` 提供**环境抽象**：同一组 API 在 Node.js（桌面）与 browser/webworker（vscode.dev）各有一套实现，通过 `@env/*` 路径别名按构建目标解析：

- `tsconfig.node.json`：`"@env/*": ["./src/env/node/*"]`
- `tsconfig.browser.json`：`"@env/*": ["./src/env/browser/*"]`

两目录文件一一对应、签名一致；**browser 端 git 为降级 stub**（`git()` 返回空 stdout、`getSupportedGitProviders()` 返回空数组），其余能力（platform、fetch、json、ipc）为真实实现。

## 入口与启动

无独立入口，由各模块按需导入。核心装配点在 `src/container.ts`：

- `Container` 构造：`IpcService`（`@env/ipc/ipcService.js`）、`GitProviderService`。
- `container.ready()` → `GitProviderService.registerProviders()` → `getSupportedGitProviders()`（`@env/providers.js`）创建 provider 实例。

## 对外接口

`@env/providers.js`（两个环境同签名）：

- `git(container, options, ...args)`：原始 git 执行；node 走 `@gitlens/git-cli` 的 `Git`（含 `git.path` 定位与 workspace 信任），browser 返回 `{ stdout: '', exitCode: 0 }` 占位。
- `getSupportedGitProviders(container, cache, register)`：node 返回 `[GlCliGitProvider, VslsGitProvider]`；browser 返回 `[]`。
- `getTelementryService()` / `setTelemetryService(service)`：遥测服务挂载点。

其余同签名 API：`platform.ts`（`isWeb`）、`resolver.ts`（`defaultResolver`）、`fetch.ts`、`json.ts`、`focusWindow.ts`、`ipc/ipcService.ts`（宿主侧 IPC 服务）、`git/squashEditor.ts`。

## 关键依赖与配置

- `@gitlens/git-cli`（`Git`、`findGitPath`）仅 node 侧使用；`git.path` 配置经 `configuration.getCore('git.path')` 读取。
- `src/system/decorators/gate.ts` 懒加载 `@env/providers.js`（webpackChunkName `__lazy__`）以**避免循环依赖**：`gate.ts → providers.ts → vslsGitProvider.ts → gate.ts`。
- browser 侧 `path` 解析到 `path-browserify`（见 `tsconfig.browser.json`）。

## 数据模型

无自有数据模型；Git provider 接口类型（`GitProvider`、`GitProviderDescriptor`）来自 `@gitlens/git/providers/*`。

## 测试与质量

- 双目标编译即测试：`tsconfig.node.json` 排除 `src/env/browser/**`，`tsconfig.browser.json` 排除 `src/env/node/**`——任何一侧签名不一致都会在对应目标编译失败。
- 构建：`pnpm run build:extension:node` / `pnpm run build:extension:web`；类型与 lint：`pnpm run check`。

## 常见问题

- **新增 API 只改了一侧**：另一目标编译报缺导出/类型不兼容；两个目录必须同步实现。
- **browser 端误用 git**：browser `git()` 永远返回空 stdout，任何依赖真实输出的路径在 web 目标会静默拿空数据；需要远程 git 能力的路径应走 provider 抽象而非裸 `git()`。
- **循环依赖**：`@env/providers.js` 被 `gate.ts` 懒加载引用，勿改为静态导入。

## 相关文件清单

- `src/env/node/providers.ts` — node 侧 provider/git/telemetry 装配
- `src/env/browser/providers.ts` — browser 侧降级 stub
- `src/env/node/git/cliGitProvider.ts` — CLI Git provider（child_process）
- `src/env/node/git/vslsGitProvider.ts` — Live Share Git provider
- `src/env/node/ipc/ipcService.ts` — node 宿主 IPC 服务
- `src/env/browser/ipc/ipcService.ts` — browser 宿主 IPC 服务
- `src/env/node/platform.ts` / `src/env/browser/platform.ts` — `isWeb` 平台判定
- `src/system/decorators/gate.ts` — 懒加载 `@env/providers.js` 的消费点
- `tsconfig.node.json` / `tsconfig.browser.json` — `@env/*` 别名映射与互斥排除

## 精简变更记录

- 2026-08-15：创建本模块文档（初次索引，基线 `0be2fef52`）。
