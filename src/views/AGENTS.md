# src/views 模块文档

> 面包屑：根 [`AGENTS.md`](../../AGENTS.md) → [`src/AGENTS.md`](../AGENTS.md) ← 本文件（`src/views/AGENTS.md`）

## 模块职责

`src/views/` 实现侧边栏树视图（branches、commits、contributors、fileHistory、lineHistory、remotes、repositories、searchAndCompare、stashes、tags）与 webview 视图（commitDetails），以及 SCM 分组视图（`ScmGroupedView`，多个视图合并进 _WeGit_ 视图）。

- `Views`（`views.ts`）：视图总装配——注册树视图、webview 视图、视图命令；响应仓库集合变化与配置变化。
- `viewBase.ts`：所有视图的公共基类（`ViewBase`）——树数据提供、refresh/reveal、分页、仓库过滤、装饰。
- `nodes/`：树节点实现；`nodes/abstract/viewNode.ts` 为节点基类。

## 入口与启动

- `Container` 构造 `Views`（`container.ts`，与 `WebviewsController` 一起创建）。
- `Views` 构造时经 `registerViews()` / `registerWebviewViews()` / `registerCommands()` 注册全部视图与命令（`registerCommand` 来自 `src/system/-webview/command.ts`）。
- 每个视图类（如 `BranchesView`）继承 `ViewBase<TreeViewTypes>`，实现 `getTreeItem`/`getChildren` 等 `TreeDataProvider` 接口。

## 对外接口

- `Views`：`onDidChangeRepositories` 驱动的刷新、`lastSelectedScmGroupedView`、视图实例访问。
- `ViewBase`：`refresh(reset)` / `refreshNode(node, reset, force)`、`reveal(...)`（含防抖等待）、`onDidChangeTreeData`、`filter`（仓库过滤）、分页（`PageableViewNode`）。
- 视图命令：`ViewCommands`（`viewCommands.ts`）与各视图注册的命令。
- 节点：`ViewNode`（`nodes/abstract/viewNode.ts`）——`getChildren`/`getTreeItem`/`refresh`/`getClipboardValue` 等。

## 关键依赖与配置

- `GitProviderService` / `GlRepository`（`src/git/`）：仓库集合与变更事件。
- `WebviewsController`（`src/webviews/`）：commitDetails 等 webview 视图注册。
- 配置：`viewsConfigKeys` / `viewsCommonConfigKeys`（`src/config.ts`）——每个视图的 `gitlens.views.*` 配置项。
- `constants.views.ts`：视图 id / 类型常量（`TreeViewIds`、`WebviewViewIds` 等）。

## 数据模型

- `ViewNode`：树节点基类（id、uri、父子关系、刷新）。
- `PageableViewNode`：可分页节点（`defaultItemLimit`/`pageItemLimit` 配置驱动）。
- `TreeViewByType` / `WebviewViewByType`：视图类型到视图类的映射（`viewBase.ts`）。
- `RepositoryFilterValue`：仓库过滤值（`constants.storage.ts`）。

## 测试与质量

- 视图逻辑以 E2E 覆盖为主（`tests/e2e/`，见根文档「测试策略」）；工具函数按所在目录规则单测。
- 质量：`pnpm run check`；新增视图需同步 `constants.views.ts` 与 `contributions.json`（views 部分）。

## 常见问题

- **refresh 与 reveal 竞争**：VS Code 对 `onDidChangeTreeData` 有 **200ms 内部防抖**（`viewBase.ts` 注释引用 microsoft/vscode#192055）；`reveal` 必须等待该防抖窗口（`onDidChangeTreeDebounceMs = 200` + `revealBufferMs = 50`），否则节点 id 注册竞态导致 reveal 失败。
- **高频事件**：selection/visibility 变更已 250ms 防抖（`onSelectionChanged`/`onVisibilityChanged`），勿绕过防抖直接订阅。
- **仓库变化刷新**：仓库增删经 `onDidChangeRepositories` 触发视图刷新；新增视图记得订阅（或经由 `ViewBase` 既有机制）。
- **webview 视图（commitDetails）**：经 `registerWebviewView` 注册（`src/webviews/commitDetails/registration.ts`），走 `WebviewsController` 生命周期，勿直接 `window.registerWebviewViewProvider`。

## 相关文件清单

- `src/views/views.ts` — 视图总装配与命令注册
- `src/views/viewBase.ts` — 视图基类（防抖/刷新/reveal/分页/过滤）
- `src/views/viewCommands.ts` — 视图命令
- `src/views/repositoriesView.ts` — Repositories 视图
- `src/views/commitsView.ts` — Commits 视图
- `src/views/scmGroupedView.ts` — SCM 分组（_WeGit_）视图
- `src/views/nodes/abstract/viewNode.ts` — 节点基类
- `src/constants.views.ts` — 视图 id/类型常量
- `src/system/-webview/vscode/views.ts` — 视图焦点等宿主工具
- `src/webviews/commitDetails/registration.ts` — commitDetails webview 视图注册

## 精简变更记录

- 2026-08-15：创建本模块文档（初次索引，基线 `0be2fef52`）。
