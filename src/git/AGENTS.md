# src/git 模块文档

> 面包屑：根 [`AGENTS.md`](../../AGENTS.md) → [`src/AGENTS.md`](../AGENTS.md) ← 本文件（`src/git/AGENTS.md`）

## 模块职责

`src/git/` 是 **`packages/git`（`@gitlens/git`）的宿主桥接层**。纯 Git 数据能力（模型、sub-providers、缓存、watch 服务）由包提供；本模块负责宿主侧集成：

- `GlGitProvider` 接口（`gitProvider.ts`）：环境相关的 VS Code 集成——SCM 仓库、URI 工具（revision/working uri）、仓库发现、可见性与跟踪。Git 操作（branches/commits 等 sub-providers）**不**经此接口，而是经 `getRepoService()` 访问包级 `RepositoryService`。
- `GitProviderService`（`gitProviderService.ts`）：管理多 provider（node: CLI + Live Share；browser: 无）与打开的仓库，发出 `onDidChangeProviders` / `onDidChangeRepositories` 事件。
- `GitRepositoryService`（`gitRepositoryService.ts`）：每仓库的宿主侧服务，通过**接口+类声明合并**吸收包级 `RepositoryService` 的全部 sub-provider（`this.branches`、`this.commits` 等）。
- `GitUri`（`gitUri.ts`）、`GlRepository`（`models/repository.ts`）、`fsProvider.ts`（`gitlens://` 文件系统 provider）。

## 入口与启动

- `Container` 构造 `GitProviderService`（`container.ts`）。
- `container.ready()` → `GitProviderService.registerProviders()` → `@env/providers.js` 的 `getSupportedGitProviders()`（node 返回 `[GlCliGitProvider, VslsGitProvider]`）。
- 仓库发现/打开后，每个仓库构建 `GlRepository` 与 `GitRepositoryService`。

## 对外接口

- `GitProviderService`：`onDidChangeProviders`、`onDidChangeRepositories`、`openRepositories`、`getRepository()`、`getRepoService()`、`getRevisionUriFromGitUri()`、`watchService` 等。
- `GlGitProvider`（见 `gitProvider.ts`）：`ensureRegistered()`、`discoverRepositories()`、`addRepository()`、`getRevisionUri()`、`getScmRepository()` 等；`createUnsafeGit` 仅 CLI 类 provider 实现。
- `GitRepositoryService`：`watch()`（filesystem 变更事件，含未打开仓库场景）、`excludeIgnoredUris()`、`createUnsafeGit()`（逃生舱，命名即劝退）、`config` 等。
- `GitUri`：`fromFile` / `fromRepoPath` / `fromUri`、`getRevisionUriFromGitUri` 转换、`documentUri` / `workingFileUri`。

## 关键依赖与配置

- `@gitlens/git`：`RepositoryService`、`Repository`、`Cache`、watch 服务、模型与工具函数。
- `@gitlens/git-cli`（经 `src/env/node/` 间接）：git 可执行文件定位。
- `EventBus`（`src/eventBus.ts`）：`git:repo:change`、`git:cache:reset` 等事件路由。
- 配置：`configuration`（`git.path` 等核心项经 `getCore`）。

## 数据模型

- `GlRepository`（`models/repository.ts`）：继承 `@gitlens/git` 的 `Repository`；`id` 为 `RepoComparisonKey`；持有 watch 租约（打开时 `watch()`，关闭释放）。
- `RepositoryChangeEvent` / `RepositoryWorkingTreeChangeEvent`（自包级 re-export）。
- `GitCommitish`（`gitUri.ts`）：`{ repoPath, sha?, fileName? }`。
- `ScmRepository`（`gitProvider.ts`）：VS Code SCM 仓库宿主形态。

## 测试与质量

- 单元测试：`src/git/__tests__/`（与源码同目录）。
- 质量：`pnpm run check`；双目标编译验证（`tsconfig.node.json` / `tsconfig.browser.json`）。

## 常见问题

- **`GitRepositoryService` 的声明合并与描述符拷贝不可随意删**：`interface GitRepositoryService extends RepositoryService {}`（接口声明合并）加上构造时 `Object.getOwnPropertyDescriptors(repoService)` 的逐属性拷贝（跳过 `skipOverlappingProperties`：`path/provider/getAbsoluteUri/exec/run`），是 sub-provider（`this.branches` 等）能被 TypeScript 识别且懒加载解析的关键。删除任意一侧都会破坏类型或运行时。
- **未打开仓库的 `onDidChange` 是死的**：未打开的 `GlRepository` 不持 watch 租约；需要仓库/工作区变更事件的调用方（如 Graph 的 secondary-worktree WIP）必须走 `GitRepositoryService.watch()`。
- **浏览器环境无 provider**：`getSupportedGitProviders()` 返回空数组，`src/git` 内共享逻辑不得假设 provider 存在。
- **裸 git 调用**：能用 typed sub-provider（带缓存/取消/签名感知）就不要 `createUnsafeGit()`；后者仅供 compose/rebase 等库逃生。

## 相关文件清单

- `src/git/gitProvider.ts` — `GlGitProvider` 接口与 `ScmRepository`
- `src/git/gitProviderService.ts` — provider/仓库管理、事件与缓存
- `src/git/gitRepositoryService.ts` — 声明合并 + sub-provider 描述符吸收
- `src/git/gitUri.ts` — `GitUri` 双形态（file:// 属性 / gitlens:// authority）
- `src/git/models/repository.ts` — `GlRepository`
- `src/git/fsProvider.ts` — `gitlens://` 文件系统 provider
- `src/git/integrations/integrations.ts` — 远程托管/issue tracker 集成
- `src/git/actions/pausedOperation.ts` — 暂停操作（rebase 冲突等）动作
- `src/repositories.ts` — `Repositories` 集合与 `RepoComparisonKey`
- `src/env/node/providers.ts` — provider 装配（CLI + Live Share）

## 精简变更记录

- 2026-08-15：创建本模块文档（初次索引，基线 `0be2fef52`）。
