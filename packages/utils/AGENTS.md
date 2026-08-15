# packages/utils — 平台无关工具库（@gitlens/utils）

## 面包屑

`packages/utils/` — 私有 workspace 包，不发布；被 `packages/ipc`、`packages/git`、`packages/git-cli` 依赖，最终由 `packages/core` 合并发布。

## 模块职责

- 平台无关的通用工具：字符串/路径/日期/URI/对象/迭代器等纯函数（`src/*.ts`）。
- 装饰器系统：`@gate`、`@memoize`、`@log`/`@loggable`、`@sequentialize`、`@debounce` 等（`src/decorators/`）。
- 作用域日志：`getScopedLogger()` 必须在任何 `await` 之前调用（浏览器限制）。
- 缓存：`PromiseCache`（TTL/LRU/错误缓存）、`CacheController`、`DedupedAsyncCache`。
- 环境抽象：`#env/*.js` 条件导入按环境映射 node/browser 实现（如 `env/node/exec.ts` 的进程执行、`env/node/logScope.ts` 的日志作用域）。

## 入口与启动

无独立入口，纯库。构建：

```bash
pnpm run build:packages          # 根目录：tsc -b 全部四个私包
pnpm --filter @gitlens/utils build  # 单包：tsc -b
```

产物输出到 `dist/`，通过 `exports` 子路径导入（如 `@gitlens/utils/logger.scoped.js`）。

## 对外接口

- `#env/*.js`：node → `dist/env/node/*`，其余环境 → `dist/env/browser/*`（package.json `imports` 条件映射）。
- 公开子路径：`./*.js`、`./decorators/*.js`、`./env/node/exec.js`、`./function/*.js`。
- 常用导出：`Logger`、`getScopedLogger`/`createLogScope`、`PromiseCache`、`gate`、`run`/`RunError`/`CancelledRunError`（env/node/exec）、`Event`/`Emitter`、`Uri` 工具、`Disposable` 体系。

## 关键依赖与配置

- `sideEffects: false`，`type: module`，ESM。
- 运行时依赖：`fast-string-truncated-width`、`vscode-uri`。
- 环境条件映射依赖构建时同时产出 node 与 browser 两份声明/实现（tsconfig project references）。

## 数据模型

- `PromiseCache<K, V>`：`createTTL`/`accessTTL`/`errorTTL`/`capacity`（LRU）/`expireOnError`。
- `ScopedLogger`：`scopeId`/`prevScopeId`/`prefix`，`addExitInfo`/`setFailed`。
- `RunError`：`cmd`/`killed`/`code`/`signal`/`stdout`/`stderr`。

## 测试与质量

```bash
pnpm --filter @gitlens/utils test   # mocha --require tsx --ui tdd --timeout 30000 src/**/__tests__/**/*.test.ts
```

- 单测随源码在 `src/**/__tests__/`，无框架依赖（仅 mocha + tsx）。
- 无独立 lint/type-check 命令，由根 `pnpm run check`（oxlint）与构建覆盖。

## 常见问题

- **`@gate` 挂起/超时**：默认超时 5 分钟；gate 在操作未结束时保持不放（Git 操作不可取消），超时仅中止调用方等待，不放开并发。排查先查 gate 再查 memoize。
- **`getScopedLogger()` 在 await 之后调用**：浏览器（webworker）构建会失败，必须在方法体最前面取 scope。
- **改 `src/env/` 需同步验证 node 与 browser 两侧实现**（如 `logScope.ts` 两端各有实现）。

## 相关文件清单

- packages/utils/package.json
- packages/utils/src/decorators/gate.ts
- packages/utils/src/decorators/memoize.ts
- packages/utils/src/logger.scoped.ts
- packages/utils/src/logger.ts
- packages/utils/src/promiseCache.ts
- packages/utils/src/env/node/exec.ts
- packages/utils/src/cancellation.ts
- packages/utils/src/event.ts
- packages/utils/src/uri.ts

## 精简变更记录

- 2026-08-15：初版 agent 索引创建。
