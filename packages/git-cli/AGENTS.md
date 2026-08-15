# packages/git-cli — CLI Git 实现（@gitlens/git-cli）

## 面包屑

`packages/git-cli/` — 私有 workspace 包，不发布；依赖 `@gitlens/git`（接口/模型）与 `@gitlens/utils`（含 `env/node/exec` 进程执行），由 `packages/core` 合并发布。

## 模块职责

- `GitProvider` 的 Node-only CLI 实现：通过 `child_process` 执行真实 git 命令。
- git 二进制定位与版本探测：`findGitPath`（PATH 与平台特定位置搜索、`--version` 探测）。
- 命令执行与排队：`exec/` 下 `run`/`gitQueue`/feature 能力查询（`features.ts` 的 CLI 侧）。
- 输出解析器：`parsers/` 把 `git log`/`status`/`blame`/`reflog` 等文本输出解析为模型对象。
- 装配入口：`createCliGitService` 一键创建带 CLI provider 的 `GitService` 单例。

**边界**：git-cli 仅限 Node 环境（依赖 `node:child_process` 等），**不得进入 browser/webworker 构建**。

## 入口与启动

```typescript
const git = createCliGitService({ context });
const repo = git.forRepo('/path/to/repo')!;
await repo.branches.getBranches();
git.dispose(); // 清理 provider、cache 与模块级状态
```

构建：`pnpm --filter @gitlens/git-cli build`（tsc -b）。

## 对外接口

- `createCliGitService(options)`：`gitPath?`/`locator?`/`context`/`gitOptions?`/`cache?`/`watchingProvider?` → 已注册全部路径的 `GitService`。
- `CliGitProvider`（`CliGitProviderOptions`：`cache`/`context`/`locator`/`git`/`gitOptions`），实现 `GitProvider` + `CliGitProviderInternal`（暴露 `isTrackedWithDetails` 供内部 sub-provider 调用）。
- `exec/exec.ts`：re-export `@gitlens/utils/env/node/exec.js` 的 `run`/`runSpawn`/`RunError`/`CancelledRunError`/`findExecutable`/`fsExists`/`getWindowsShortPath` + `isWindows`。
- `exec/locator.ts`：`findGitPath`、`GitLocation { path, version }`、`UnableToFindGitError`、`InvalidGitConfigError`（git 配置损坏时抛出）。
- sub-provider：`providers/` 下 branches/commits/status/diff/graph/refs/remotes/revision/staging/stash/tags/worktrees/blame/operations/patch/pausedOperations。

## 关键依赖与配置

- `sideEffects: false`，ESM；运行时依赖 `@gitlens/git`、`@gitlens/utils`。
- 解析器依赖 git 输出格式与 version gating：`exec/features.ts` 按探测到的 git 版本决定启用哪些命令参数（如 porcelain-v2、`stash push --staged`）。
- `gitOptions` 可配置超时、trust、队列、钩子；`gitQueue` 序列化命令执行。

## 数据模型

- `GitLocation`：`path` + `version`（探测结果，供 feature gating）。
- `ParsedCommit`/`LogParsedEntry*`：由 `commitsMapping`（`%H`/`%aN`/`%aE`/`%at`/`%cN`/`%cE`/`%ct`/`%P`/`%D`/`%B`）驱动；`getCommitsLogParser(includeFiles, inFileRange?)` 返回带文件/统计的解析器变体。

## 测试与质量

```bash
pnpm --filter @gitlens/git-cli test            # 单元测试，忽略 integration
pnpm --filter @gitlens/git-cli test:integration  # 需真实 git 环境
```

- 集成测试位于 `src/**/__tests__/integration/`，依赖真实 git 二进制与仓库。

## 常见问题

- **解析器改动必须回归**：输出解析依赖 git 输出格式与版本；加参数需同时更新 feature gating（`exec/features.ts`），否则低版本 git 上命令失败。
- **找不到 git / 配置损坏**：`UnableToFindGitError`（未找到二进制）与 `InvalidGitConfigError`（`--version` 报 bad config）是两个不同的失败路径，`findGitPath` 会先尝试解析路径再退回搜索。
- **不要引入 browser 依赖**：本包被合并进 core 后仍在 webworker 目标之外，导入任何 browser 专用模块会破坏构建边界。

## 相关文件清单

- packages/git-cli/package.json
- packages/git-cli/src/cliGitProvider.ts
- packages/git-cli/src/service.ts
- packages/git-cli/src/exec/exec.ts
- packages/git-cli/src/exec/locator.ts
- packages/git-cli/src/exec/git.ts
- packages/git-cli/src/exec/features.ts
- packages/git-cli/src/parsers/logParser.ts
- packages/git-cli/src/**tests**/integration

## 精简变更记录

- 2026-08-15：初版 agent 索引创建。
