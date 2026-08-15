# packages/git — Git 抽象层（@gitlens/git）

## 面包屑

`packages/git/` — 私有 workspace 包，不发布；依赖 `@gitlens/utils`，由 `packages/core` 合并发布。具体实现（CLI）在 `packages/git-cli`。

## 模块职责

- Git provider 接口与路由：定义 `GitProvider` 契约，`GitService` 按路径把请求路由到已注册 provider。
- 仓库级服务：`RepositoryService` 与按仓库缓存的 sub-provider 代理（自动注入 repoPath）。
- 领域模型：Commit/Branch/Status/Diff/Stash/Tag/Remote 等（`models/`）。
- 功能能力表：`features.ts` 定义 Git 功能特性及其最低 git 版本。
- remote matcher：内置 GitHub/GitLab/Bitbucket/Azure DevOps/Gerrit/Gitea/Google Source 等 provider 的 URL 匹配与配置合并。
- 纯解析器：diff/rebase todo 解析（`parsers/`），供 git-cli 等复用。
- 文件 watching：`watching/` 提供仓库文件监听接口与 watch service。

**边界**：`GitService` 不负责仓库发现与生命周期（open/close、监听管理是应用层职责），它信任调用方传入的仓库路径。

## 入口与启动

无独立入口，纯库。构建：`pnpm --filter @gitlens/git build`（tsc -b）。典型用法：

```typescript
const service = GitService.createSingleton();
service.register(cliProvider, path => true);
const repo = service.forRepo('/path/to/repo');
await repo.branches.getBranches();
```

## 对外接口

- `GitService`：`createSingleton(watchingProvider?)`、`register(provider, canHandle)`、`forRepo(repoPath)`、`getRepositoryInfo`、`validateRepo`、`onDidChangeProviders`、`dispose`（拆除模块级 resolver）。
- `RepositoryService`：各领域 sub-provider 访问器（`branches`/`commits`/`status`/`diff`/`graph` 等）与 repo 元信息。
- `GitProvider` 接口：核心 sub-provider 必需（branches/commits/config/contributors/diff/graph/refs/remotes/revision/status/tags），CLI-only 可选（blame/ops/patch/pausedOps/staging/stash/worktrees）。
- 模型：`GitCommit`（`@loggable`/`@serializable`，`is()`/`isStash()`/`getPreviousSha()`）、`GitBranch`、`GitFileChange`、`GitStatusFile` 等。
- remote：`RemoteProviderMatcher`、`RemoteProviderConfig`（`domain`/`regex`/`protocol`/`name`/`urls`）。

## 关键依赖与配置

- `sideEffects: false`，ESM；运行时依赖 `@gitlens/utils`、`ignore`。
- `context.ts`：`GitServiceContext` 携带 host 提供的配置/事件总线/集成等钩子。
- features：`gitMinimumVersion = '2.7.2'`；`gitFeaturesByVersion` 把 `git:*` 功能名映射到最低版本（如 `git:status:porcelain-v2` → 2.11）。

## 数据模型

- `GitProviderDescriptor`（provider 标识）、`ValidateRepoResult`（`valid+safe` / `valid+unsafe(dubious ownership)` / `invalid` 三态）。
- `GitCommitFileset`：`files`（未加载时为 `undefined`）+ `filtered`（pathspec 过滤结果）。
- `GitFeatures` 字符串联合：以 `git:` 前缀开头的功能名（`checkout:pathspec-from-file`、`merge-tree`、`stash:push:staged`、`worktrees` 等）。

## 测试与质量

```bash
pnpm --filter @gitlens/git test    # mocha --require tsx --ui tdd src/**/__tests__/**/*.test.ts
```

## 常见问题

- **不在此包实现 CLI 执行**：命令执行在 `packages/git-cli`；此包只定义接口/路由/模型/解析。
- **`GitService` 单例**：`createSingleton` 重复调用会抛错；`dispose` 会清理模块级 repository resolver（影响 `getRepositoryService()` 全局访问）。
- **`@memoize` 连拒绝的 Promise 也缓存**：模型上使用 memoize 的取值若失败需 `invalidateMemoized()` 清除。
- **修改 provider 接口**：需同步审计 `packages/git-cli` 的 `CliGitProvider` 实现与 `GitProviderDescriptor` 注册处。

## 相关文件清单

- packages/git/package.json
- packages/git/src/providers/provider.ts
- packages/git/src/service.ts
- packages/git/src/repositoryService.ts
- packages/git/src/features.ts
- packages/git/src/context.ts
- packages/git/src/models/commit.ts
- packages/git/src/remotes/matcher.ts
- packages/git/src/parsers/diffParser.ts
- packages/git/src/watching/watchService.ts

## 精简变更记录

- 2026-08-15：初版 agent 索引创建。
