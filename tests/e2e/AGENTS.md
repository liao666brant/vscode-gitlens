# tests/e2e — Playwright Electron E2E 测试

## 面包屑

`tests/e2e/` — 基于 Playwright 的 Electron VS Code E2E 测试，入口为根脚本 `pnpm run test:e2e`（`playwright test -c tests/e2e/playwright.config.ts`）。

## 模块职责

- 启动真实 VS Code（Electron）并加载扩展，通过扩展宿主内的 HTTP evaluator 调用 VS Code API 执行断言。
- 提供 Git 测试夹具（真实 git 命令构造仓库/分支/提交/rebase 状态）与 WeGit 页面对象（活动栏、sidebar、视图交互）。
- MCP 辅助：E2E 中定位 `gk` CLI 与 IPC discovery 文件。
- 覆盖场景：smoke（激活/基础导航）、rebase（交互式 rebase 全流程）、blame、quick wizard。

## 入口与启动

```bash
pnpm run test:e2e                 # 根目录入口
pnpm run bundle:e2e               # 前置：生产模式打包扩展（--mode production --debug --quick）
```

运行链：`globalSetup`（`setup.ts`）→ 构建 e2e runner（`pnpm run build:e2e-runner`，esbuild 打包 `runner/src/index.ts` → `runner/dist/index.js`）→ 下载 VS Code stable → Playwright `_electron` 启动带扩展的实例 → `baseTest.ts` 装配 fixture。

**先决条件**：真实 git 与已构建的扩展 bundle；CI 下 `retries: 2`、`workers: 4`，本地 `workers: 8`，`fullyParallel: true`，headless。

## 对外接口

- `baseTest.ts` 导出 `test`（fixture：`vscodeOptions`、`GitFixture`、`VSCodeEvaluator`、`WeGitPage`）、`expect`、`MaxTimeout`(10s)/`DefaultTimeout`(2s)/`ShortTimeout`(500ms)、`createTmpDir`。
- `VSCodeEvaluator`：HTTP 客户端，连接 runner 的 `evaluate(fn, ...params)`，回调内可直接用 `vscode` API（类型 `VSCode`）。
- `GitFixture`：`init`/`commit`/`branch`/`checkout`/`tag`/`stash`/`rebase` 系列/`cleanupRebaseState`（删除 `.git/rebase-merge`、`.git/rebase-apply`）等。
- `WeGitPage`/`VSCodePage`：页面对象；fixture 通过 Extension API 确认 WeGit 已激活，页面对象负责活动栏与 sidebar 交互。
- `mcpHelper.ts`：`findGkCliFromArgs`（从 `--user-data-dir` 推导临时 `gk` 路径）、IPC discovery 文件查找。

## 关键依赖与配置

- `playwright.config.ts`：`testDir: './specs'`、`outputDir: '../../out/test-results'`、trace/video `on-first-retry`、超时 60s。
- `baseTest.ts`：Linux 无显示环境自动拉起 Xvfb（`:99`）；使用 `@vscode/test-electron` 的 `downloadAndUnzipVSCode`。
- runner 以 `--extensionTestsPath` 在扩展宿主内运行，用 `new Function` 重建测试传入的函数并注入 `vscode`。
- spec 通过 `base.extend({ vscodeOptions: [...] })` 注入 `setup` 回调（建临时仓库）与 `userSettings`（禁用自动刷新等干扰项）。

## 数据模型

- `VSCodeInstance`（baseTest 中定义）：封装 Electron 应用、page、evaluator 与临时目录。
- `McpMessage`/`McpConfigResult`（mcpHelper）：JSON-RPC 消息与 MCP 配置模型。

## 测试与质量

```bash
pnpm run test:e2e                 # 全部 spec
pnpm run test:e2e -- --project "VSCode stable" --grep smoke   # 单 spec 过滤
```

- 测试失败先查根因，不要为通过而简化断言意图。
- rebase 测试会残留 `.git/rebase-*` 锁与状态，用例结束/失败路径需 `cleanupRebaseState` 或 abort 清理，避免污染后续用例（`fullyParallel` 下尤其注意跨 worker 干扰）。

## 常见问题

- **`Error: Unable to find VS Code`**：先跑一次 `setup`（或 CI 流程），确保 VS Code stable 已下载。
- **扩展未激活/行为陈旧**：先 `pnpm run bundle:e2e` 重建扩展 bundle；`userSettings` 中关闭 repositories 自动刷新可减少时序抖动。
- **rebase 用例互相影响**：交互式 rebase 依赖 todo 文件与 `REBASE_HEAD`，务必在清理阶段删除 `rebase-merge`/`rebase-apply` 并 abort 未完成 rebase。
- **evaluator 超时**：runner 需先被 `setup.ts` 构建；改 runner 源码后必须重跑 `pnpm run build:e2e-runner`。

## 相关文件清单

- tests/e2e/playwright.config.ts
- tests/e2e/setup.ts
- tests/e2e/baseTest.ts
- tests/e2e/runner/src/index.ts
- tests/e2e/fixtures/vscodeEvaluator.ts
- tests/e2e/fixtures/git.ts
- tests/e2e/pageObjects/gitLensPage.ts
- tests/e2e/helpers/mcpHelper.ts
- tests/e2e/specs/rebase.test.ts
- tests/e2e/specs/smoke.test.ts

## 精简变更记录

- 2026-08-16：移除已删除 Graph UI 的 E2E 覆盖（graphDetails/graphPin/graphReview/treeView spec 删除；gitLensPage 清理 Graph helpers 与 showWorktreesView；showWeGitView 改用内建 `workbench.view.scm`；删除 tests/docker 基建）。
- 2026-08-15：初版 agent 索引创建。
