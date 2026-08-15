# packages/core — 发布包（@liao666brant/core-wegit）

## 面包屑

`packages/core/` — 唯一对外发布的 npm 包（`@liao666brant/core-wegit`），把四个私有 workspace 包合并为单一可分发产物。

## 模块职责

- 将 `@gitlens/utils`、`@gitlens/ipc`、`@gitlens/git`、`@gitlens/git-cli` 四个私包合并进 `packages/core/dist/`（JS）与 `packages/core/src/`（TS 源码）。
- 重写跨包导入：把 `@gitlens/<pkg>/<path>` specifier 改写为合并后的相对路径（`.js`/`.d.ts`/源码/sourcemap `sources`）。
- 生成发布用 `package.json`：从各子包合并 `exports` 映射与运行时依赖（剥离 workspace 引用），合并 LICENSE。
- `prepack` 钩子确保 `pnpm pack`/发布前重新执行 bundle。

**关键约束**：`packages/core/src` 与 `packages/core/dist` 均为生成物，**禁止手改**；改动应落在源私包，再运行 bundle 重新生成。

## 入口与启动

```bash
pnpm --filter @liao666brant/core-wegit build   # = node scripts/bundle.mjs
pnpm --filter @liao666brant/core-wegit prepack  # 发布前自动执行同一脚本
```

bundle 流程（`scripts/bundle.mjs`）：清理 dist/src/LICENSE → 拷贝四个子包树 → 重写 specifier 与 sourcemap → 拷贝 LICENSE → 生成 exports/依赖合并 → 写回 package.json。

## 对外接口

- `exports` 子路径全部以 `./<subpkg>/...` 形式暴露：`./utils/*.js`、`./utils/decorators/*.js`、`./utils/env/node/exec.js`、`./ipc/*.js`、`./git/*.js`（含 `git/models`/`git/providers`/`git/remotes`/`git/utils`/`git/watching`/`git/parsers`）、`./git-cli/*.js`（含 `git-cli/exec`/`git-cli/parsers`/`git-cli/providers`）。
- `#env/*.js` 条件映射：node → `dist/utils/env/node/*`，其余 → `dist/utils/env/browser/*`。
- `files`：`dist`、`src`、`LICENSE`、`README.md`、`CHANGELOG.md`；`engines.node >= 22.12.0`。

## 关键依赖与配置

- `sideEffects: false`，ESM。
- 发布运行时依赖（合并自子包 + 自有）：`@octokit/graphql`、`@octokit/request`、`@octokit/request-error`、`@octokit/types`、`fast-string-truncated-width`、`ignore`、`vscode-uri`。
- `scripts/clean` 删除 `dist`、`src`、`LICENSE` 与 `*.tgz`。

## 数据模型

未发现（本包无领域数据模型，仅为打包层）。

## 测试与质量

- 无单元测试；质量保障 = bundle 后产物可通过类型检查与构建（根 `pnpm run build`）。
- 发布前核对：`dist/` 无残留 `@gitlens/` 裸 specifier、exports 与子包一致、依赖无 workspace 引用。

## 常见问题

- **手改了 `core/src` 或 `core/dist`**：下次 bundle 会被整体删除重建，改动丢失——一律改源私包。
- **新增子包导出路径**：需在源私包 `exports` 添加，bundle 会从子包 `exports` 模式生成 core 的 exports；两者模式不一致时以子包为准。
- **依赖版本漂移**：同一依赖在各子包版本不一致时，bundle 合并逻辑需保留最新/最高版本，改 `package.json` 前先看 `bundle.mjs` 的合并规则。

## 相关文件清单

- packages/core/package.json
- packages/core/scripts/bundle.mjs
- packages/core/.gitignore
- packages/core/README.md
- packages/core/CHANGELOG.md

## 精简变更记录

- 2026-08-15：初版 agent 索引创建。
