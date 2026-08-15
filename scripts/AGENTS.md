# scripts — 构建、代码生成与发布辅助

## 面包屑

`scripts/` — 仓库根下的 Node 脚本目录，由根 `package.json` 的 `scripts` 引用（`build`、`generate:contributions`、`generate:commandTypes`、`build:icons`、`check` 等）。

## 模块职责

- **构建编排**：`build.mjs` 是 `pnpm run build` 的实现——组装 webpack 命令、拆分并行进程、跑 pretty 与 oxlint。
- **贡献项代码生成**：`contributions.json` 是 commands/menus/submenus/keybindings/views 的权威来源；`generateContributions.mts` 双向同步它与 `package.json`；`generateCommandTypes.mts` 从 `contributions.json` 生成 `constants.commands.generated.ts`。
- **图标 pipeline**：`applyIconsContribution.mjs` 把生成的 `dist/icons-contribution.json`/glicons scss/ts map 写回源码与 `package.json` 的 `contributes.icons`（配合 `build:icons` 的 svgo → fantasticon → apply → export 链路）。
- **测试打包**：`esbuild.tests.mjs` 把 `src/**/__tests__/**/*.test.ts` 打包为 node / webworker 两个 target 的 CJS。
- **静态检查插件**：`webpack-oxlint-plugin.mjs`（watch 模式下增量 lint 改动文件）；`eslint-plugin-gitlens.mjs`（@gitlens 自定义规则，oxlint 原生 + ESLint 兼容双跑）。
- **when 子句解析**：`contributions/whenParser.mts` 解析并校验 `when` 表达式（源自 VS Code 实现）。
- **issue 工作流**：`issues/workflow.mts` 编排 triage（evaluate→investigate→prioritize→update）与 dev（scope→plan→challenge→review）两条 AI 管线。
- **辅助**：`mcp-vscode-server.mjs`（MCP 服务器，持久 Playwright/Electron 会话供 agent 检查扩展）、发布辅助（`prep-release.mjs`/`prep-core-release.mjs`/`applyPreReleasePatch.mjs`）、遥测/emoji/licenses 等生成脚本。

## 入口与启动

```bash
pnpm run build                       # node ./scripts/build.mjs（--mode/--build/--target/--quick/--watch/--debug/--trace/--webview）
pnpm run generate:contributions      # node ./scripts/generateContributions.mts（--extract 反向提取）
pnpm run generate:commandTypes       # node ./scripts/generateCommandTypes.mts
pnpm run build:icons                 # svgo + fantasticon + icons:apply + icons:export 链路
```

`build.mjs` 参数：`--mode development|production|none`、`--build extension|webviews|unit-tests`（可多次）、`--target node|webworker`（可多次）、`--quick`（跳过 pretty 与 oxlint，供 watch/快速迭代）、`--watch`。完整一次构建把 6 个 webpack config 拆成 4 个并行进程（`extension:node`、`extension:webworker`、`common`、`webviews:common+webviews+unit-tests`），非 quick 的一次性构建并发跑一次整仓 oxlint（`oxlint --type-aware --type-check`，替代旧 ForkTsChecker+ESLint）。

## 对外接口

- 生成的产物：`constants.commands.generated.ts`、`contributions.json` ↔ `package.json` 的 contributes 段、`dist/icons-contribution.json`、glicons scss/ts map、`out/tests`（测试打包）。
- 自定义 lint 规则（`eslint-plugin-gitlens.mjs`）：`no-src-imports`、`no-self-package-imports`、`require-js-extension`、`scoped-logger-usage`、`require-block-body`、`newline-after-control-flow`。

## 关键依赖与配置

- `whenParser.mts` 的 `CONSTANT_VALUES` 硬编码 `isMac`/`isWindows`/`isWeb` 等平台常量（生成期默认 false，真实值由 host 注入）。
- `webpack-oxlint-plugin.mjs` 仅在 watch 构建生效，避免一次性构建重复 lint；`CHILD_PROCESS_MAX_FILES = 10` 批量子进程。
- `workflow.mts` 通过 AI CLI（`--agent claude|auggie`、`--model`、`--dry-run`）编排，非仓库构建依赖。

## 数据模型

- `contributions/models.ts`：`ContributionsJson`/`Command`/`Keybinding`/`Menu`/`Submenu`/`View` 等贡献项类型，`generateContributions`/`generateCommandTypes` 共用。
- `issues/types.ts`/`config.mts`：工作流管线与仓库配置模型。

## 测试与质量

- 无单元测试框架；质量保障 = `pnpm run check`（oxlint 含类型检查）+ `pnpm run build` 全链路。
- 改贡献项后必须跑 `pnpm run generate:contributions`（或 watcher），改命令后跑 `pnpm run generate:commandTypes`。

## 常见问题

- **改 `package.json` 的 contributes 段会被覆盖**：`contributions.json` 是权威，直接改 `package.json` 后下次 generate 会被重写；反向操作用 `--extract`。
- **`--quick` 后 lint 不跑**：一次性构建的整仓 oxlint 与 pretty 都被跳过，提交前补 `pnpm run check`。
- **新增自定义 lint 规则**：在 `eslint-rules/` 用 oxlint `createOnce` API 编写，挂到 `eslint-plugin-gitlens.mjs`；oxlint 原生与 ESLint 兼容由 `eslintCompatPlugin` 合成。

## 相关文件清单

- scripts/build.mjs
- scripts/generateContributions.mts
- scripts/generateCommandTypes.mts
- scripts/applyIconsContribution.mjs
- scripts/esbuild.tests.mjs
- scripts/webpack-oxlint-plugin.mjs
- scripts/eslint-plugin-gitlens.mjs
- scripts/contributions/whenParser.mts
- scripts/issues/workflow.mts
- scripts/mcp-vscode-server.mjs

## 精简变更记录

- 2026-08-15：初版 agent 索引创建。
