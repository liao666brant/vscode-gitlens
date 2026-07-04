# ULW Notepad: Pro/Plus Cleanup 2026-07-04

## Bootstrap

- Tier: HEAVY. Reason: cross-domain cleanup touches extension contributions, webviews, generated command types, packages, resources, and build config.
- Skills surveyed:
  - deep-planning: relevant because this is a broad refactor; used lightly to define success criteria and choose a minimal cleanup strategy.
- Skills skipped:
  - review/deep-review: final reviewer gate will use ULW reviewer instead of local review skill.
  - modern-css/frontend/live skills: no requested UI implementation; only removing stale UI/config entries.
- External research: skipped. This is internal repo cleanup and license-scope removal, not a general library/API design question.

## Success Criteria

1. Residual user-visible Pro/Plus/CodeLens/Inline Blame/Hover/Launchpad/Cloud/AI/MCP entries are removed unless they are intentionally inert compatibility types.
2. Dead resources/config entries created only for removed Pro/Plus functionality are deleted or disconnected.
3. Generated artifacts are in sync.
4. `pnpm run check` and `pnpm run build:quick` pass.
5. Real surface proof: generated `package.json` no longer exposes removed commands/settings/views by keyword scan.

## RED Evidence

- Command:
  `rg -n 'src/community/stubs/pro|community/stubs/pro|plus|Pro|GitKraken Pro|subscription|trial|launchpad|composer|timeline|cloud|AI|MCP|Graph|codeLens|currentLine|hovers' src package.json contributions.json README.md walkthroughs docs`
- Observed residuals include:
  - `contributions.json` / `package.json`: `launchpad`, `cloud-patch`, disabled `timeline/item/context`, Commit Graph wording.
  - `src/community/stubs/pro.ts`: broad `ProStubAny` shim with many commercial exports.
  - docs and telemetry comments still containing removed feature names.

## Plan

Recommended approach: keep the build-green compatibility shim only where current community code still imports it, but keep shrinking callers and visible generated metadata. Delete generated/config/resource entries when they have no runtime owner. This wins over a full shim rewrite because the repo is already in a large deletion state and the shortest safe path is to remove remaining exposed surfaces first.

## Evidence Log

- Removed residual Launchpad/Cloud Patch/Code Suggestion surfaces from contributions, package metadata, command/view context keys, telemetry constants, icon maps, settings partials, and Commit Details webview plumbing.
- Removed remaining CodeLens/Inline Blame/Hover feature residues from user-visible docs/config surfaces, including the stale architecture doc reference.
- Regenerated package contributions with `pnpm run generate:contributions`.
- Removed Rebase Editor Composer/Recompose IPC/UI, Pro-gated conflict detection, Quick Wizard Pro trial/upgrade directives, GK check-in/license storage types, and dead Composer/MCP/Timeline telemetry.
- Regenerated telemetry docs with `pnpm run generate:docs:telemetry`.
- Validation:
  - `pnpm run check` -> PASS (`Found 0 warnings and 0 errors.`)
  - `pnpm run build:quick` -> PASS (extension node/webworker, common, webviews, and unit-tests compiled successfully)
  - Pro/Plus residual scan -> PASS (no matches outside the intentional `src/community/stubs/pro.ts` compatibility shim)
  - Inline Blame / Git CodeLens / hover residue scan -> PASS (no matches)
  - Broad README/walkthrough/docs/package/src removed-feature scan -> PASS (no matches, telemetry docs included)

Final note: ULW CLI was not available in this environment, so this local notepad tracks the same goal, evidence, and verification trail.
