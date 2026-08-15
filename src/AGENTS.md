# src 模块文档

> 面包屑：根 [`AGENTS.md`](../AGENTS.md) ← 本文件（`src/AGENTS.md`）→ 子模块：[`env/`](env/AGENTS.md) · [`git/`](git/AGENTS.md) · [`commands/`](commands/AGENTS.md) · [`views/`](views/AGENTS.md) · [`system/`](system/AGENTS.md) · [`webviews/`](webviews/AGENTS.md)

## 模块职责

`src/` 是 WeGit 扩展宿主的全部源码（Node 与 browser/webworker 双目标）。职责包括：

- **入口与装配**：`extension.ts` 的 `activate()` 与 `deactivate()`；`container.ts` 的 `Container`（Service Locator 单例，装配全部服务）。
- **Git 桥接**：`git/` 对 `packages/git`（`@gitlens/git`）的宿主桥接（SCM 集成、仓库发现、GitUri、声明合并）。
- **交互层**：`commands/`（命令）、`views/`（树视图）、`webviews/`（webview 宿主与 Lit apps）、`statusbar/`、`quickpicks/`、`annotations/`、`trackers/` 等。
- **基础设施**：`system/`（工具库）、`telemetry/`、`env/`（环境抽象）、`constants*`（命令/视图/遥测常量）。

## 入口与启动

激活链路（见根文档「架构总览」）：

1. `extension.activate()`：`Logger.configure` → 预发布过期检查 → `Container.create()`。
2. `once(container.onReady)`：`registerCommands()`（`src/commands.ts` 副作用导入注册全部命令）+ 注册 Action Runner。
3. `await container.ready()`：`GitProviderService.registerProviders()`（经 `@env/providers.js` 的 `getSupportedGitProviders` 获取环境 provider）。
4. 返回 `new Api(container)`（`GitLensApi`，见 `src/api/api.ts`）。

## 对外接口

- `activate(context)` / `deactivate()`：VS Code 扩展生命周期入口。
- `GitLensApi`（`src/api/gitlens.d.ts` 定义、`api/api.ts` 实现）：`registerActionRunner()` 等扩展 API。
- 命令：`GlCommands` 联合类型（`src/constants.commands.ts` + `src/constants.commands.generated.ts`），经 `system/-webview/command.ts` 的 `registerCommand` 注册。
- `Container.instance`：全局服务访问点（未初始化时经 Proxy 抛出错误，仅 `config` 可提前访问）。

## 关键依赖与配置

- **包依赖**：`@gitlens/utils`、`@gitlens/ipc`、`@gitlens/git`、`@gitlens/git-cli`（`packages/*`）；`@env/*` 按构建目标解析到 `src/env/{node,browser}`。
- **编译目标**：`tsconfig.node.json`（排除 `src/env/browser/**`）与 `tsconfig.browser.json`（排除 `src/env/node/**`）；两者都排除 `src/webviews/apps/**`（由 webpack 单独打包）。
- **配置**：`configuration`（`system/-webview/configuration.ts`）提供类型化 `Config` 读取（`gitlens.*` 前缀）。

## 数据模型

- `GitUri`（`git/gitUri.ts`）：扩展 VS Code `Uri`，携带 `repoPath`/`sha`/`submoduleSha`；`gitlens://` 形式经 authority 编码。
- `GlRepository`（`git/models/repository.ts`）：继承 `@gitlens/git` 的 `Repository`，`id` 为仓库比较键。
- `ViewNode`（`views/nodes/abstract/viewNode.ts`）：树视图节点基类。
- `GlCommands`/`GlWebviewCommands`：命令 id 类型源。

## 测试与质量

- 单元测试与源码同目录（`__tests__/*.test.ts`），已有 `commands/__tests__`、`git/__tests__`、`system/__tests__`；运行见根文档「测试策略」。
- 质量：`pnpm run check`（oxlint 类型感知）与 `pnpm run pretty:check`；构建 `pnpm run build` / `pnpm run watch`。

## 常见问题

- **`@env` 双路径缺失**：新增环境 API 时两个目录都必须实现同签名，否则对应目标编译失败；browser 端 git 为降级 stub（空 stdout、空 provider 列表），勿在共享路径假设真实 git 存在。
- **`src/webviews/apps/**` 不被两个 tsconfig 编译\*\*：apps 由 webpack 单独打包，类型检查与 lint 需经对应构建链。
- **导入规则**：相对导入恒带 `.js` 扩展名（ESM）；禁止 default 导出；纯类型导入用 `import type`。
- **`Container` 未初始化**：`Container.instance` 在任何服务创建前只允许访问 `config`；其余访问会抛错。

## 相关文件清单

- `src/extension.ts` — 扩展入口与激活逻辑
- `src/container.ts` — Container 服务装配（Service Locator）
- `src/commands.ts` — 命令副作用注册清单
- `src/constants.commands.ts` — 命令 id 类型（引用 generated）
- `src/constants.commands.generated.ts` — 由 contributions.json 生成的命令常量
- `src/config.ts` — 全部 `gitlens.*` 配置类型
- `src/api/api.ts` — GitLensApi 实现
- `tsconfig.node.json` / `tsconfig.browser.json` — 双目标编译配置（含 `@env/*` 映射）
- `package.json` — 扩展清单、scripts、activationEvents

## 精简变更记录

- 2026-08-15：创建本模块文档（初次索引，基线 `0be2fef52`）。
