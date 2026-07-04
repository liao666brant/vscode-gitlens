# WeGit migration allowlist

Final scans:

- `final-GitLens-allowlist-candidates.txt`: remaining `GitLens` hits are internal compatibility/API symbols only.
- `final-upstream-allowlist-candidates.txt`: remaining GitKraken/eamodio hits are licenses, package dependencies, legacy compatibility paths, or integration identifiers.
- `resume-focused-current-scan-after-logo.txt`: remaining focused hits after the logo cleanup are compatibility/API symbols, third-party package names, legal attribution, developer-only component-linking scripts, or legacy storage/discovery paths.
- `manifest-green.json`: package identity is `wegit`, display name is WeGit, publisher/author are `liao666brant`, icon is `images/wegit-icon.png`, telemetry default is `false`.
- `final-manifest-after-test-fixes.json`: package identity remains WeGit, old logo custom elements are absent, WeGit logo custom elements are present, Rebase/Settings panel icons use `images/wegit-icon.png`, and GitKraken redirect links are absent.
- `final-cleaned-residue-after-build.txt`: empty scan for cleaned residues (`gitlens-logo*`, GitKraken redirect URLs, `origin=gitlens`, old panel icon references, removed Inline Blame/Git CodeLens/detailed-blame feature strings).
- `final-visible-gitlens-scan-after-walkthrough-rename.txt`: remaining `GitLens` hits in visible surfaces are limited to compatibility URI schemes and `@gitlens/git` helper names.
- `final-e2e-residue-after-build.txt`: empty E2E scan for old Pro subscription simulation helpers, `Try WeGit/GitLens Pro`, `Unlock this feature`, and proper-case `GitLens`.
- `final-feature-keywords-after-launchpad-cleanup-20260704.txt`: current source/package/docs scan is empty for `Commit Graph`, `Show Commit Graph`, `Visualize Repository History`, `Inline Blame`, `Git CodeLens`, detailed-blame hover copy, and `Launchpad`.
- `final-brand-residue-after-cleanup-20260704.txt`: remaining focused brand hits are `@gitkraken/*` dependencies and internal `GitLens` API/URI-scheme compatibility names only.
- `final-focused-current-residue-20260704.txt`: remaining `GitLens`/`GitKraken` current-surface hits are compatibility/API symbols or external package names, not user-facing WeGit product copy.
- `test-after-async-rm-helper.log`, `check-after-walkthrough-rename.log`, `build-full-after-test-fixes.log`: final unit tests, lint/type check, and full build passed.
- `check-after-e2e-helper-cleanup.log`, `e2e-smoke-after-pro-cleanup-3.log`, `build-after-e2e-cleanup.log`: post-E2E-cleanup type/lint, live VS Code smoke E2E, and full build passed.
- `e2e-quickwizard-after-pro-cleanup.log`: Quick Wizard E2E no longer fails on Pro simulation removal, but the broader suite remains blocked by existing localized title assertions such as `/Switch/i` expecting English while VS Code renders `切换到...`.
- Latest validation: `git diff --check`, `pnpm run check`, and `pnpm run build:quick` all passed after the final Launchpad/Commit Graph cleanup.

Intentionally retained:

- `gitlens.*` VS Code command/config/context IDs and URI schemes: preserving existing command IDs, user settings, keybindings, and persisted URI contracts.
- `GitLensApi`, `Schemes.GitLens*`, `encodeGitLensRevisionUriAuthority`, and related FS/URI helpers: internal API compatibility names, not user-facing branding.
- `@gitlens/*` workspace package names: private/internal package import graph.
- `@gitkraken/*` and `@eamodio/*` dependencies: third-party package names required by current imports and lockfile.
- `LICENSE`, package sub-licenses, `ThirdPartyNotices.txt`, and `.mailmap`: historical/legal attribution.
- `tmpdir()/gitkraken/gitlens` IPC discovery path and `eamodio.gitlens` E2E globalStorage path: compatibility with legacy CLI/window discovery and test fixtures.
- `gitlens-*` icon-font glyph IDs and codicon-style product icon IDs that are still used (for example the main panel icon): retained until a dedicated icon-font migration exists; changing them touches generated icon fonts, contribution icons, and theme token compatibility.
- `https://github.com/liao666brant/vscode-gitlens` repository URLs: retained because the current `origin` remote is `git@github.com:liao666brant/vscode-gitlens.git`; change these only after the GitHub repository itself is renamed.
- `.agents/.claude` skill text that teaches upstream GitLens workflows: developer-agent guidance, not extension runtime or marketplace surface. Bulk cleanup needs an explicit owner decision because it can remove useful local automation knowledge.

Cleaned in this pass:

- User-facing settings/help links moved away from GitKraken help pages to the WeGit fork.
- Webview/settings command labels and docs changed to WeGit.
- Visible logo web components and media moved from `gitlens-logo*` to `wegit-logo*`; `custom-elements.json` regenerated with `wegit-logo` / `wegit-logo-circle`.
- Home default avatar now points at `media/wegit-logo.webp`.
- Settings/Rebase webview panel icons now use `images/wegit-icon.png`.
- Copy Deep Link now returns direct WeGit `vscode://liao666brant.wegit/link/...` URLs instead of GitKraken redirect URLs with `origin=gitlens`.
- Walkthrough command class naming moved from `WalkthroughGitLensInspectCommand` to `WalkthroughWeGitInspectCommand`; legacy command IDs are retained for compatibility.
- E2E page objects and tests renamed to WeGit-facing class/method names where safe.
- E2E Pro subscription simulation helpers and old Pro-gate expectations were removed from smoke, quick wizard, and graph-related specs; smoke now verifies the current WeGit and WeGit Inspect surfaces in the live VS Code host.
- Release/dev scripts and VS Code launch/query metadata moved to `liao666brant/vscode-gitlens`.
- Telemetry now defaults off and the OTLP exporter no longer points to GitKraken endpoints.
- Stash/discard unit tests were aligned with the localized WeGit UI copy and made robust against Windows temp-repo cleanup timing.
- Settings no longer loads the Commit Graph partial or shows Commit Graph/Visualize Repository History menu toggles.
- Rebase reveal behavior and tooltips no longer point users at Commit Graph; the current community build reveals in Inspect.
- Removed orphaned Commit Graph/Launchpad documentation and webview media assets:
  `images/docs/commit-graph.png`, `images/docs/commit-graph-illustrated.png`, `images/docs/launchpad.png`,
  `src/webviews/apps/media/graph-commit-search.png`, `src/webviews/apps/media/graph-minimap.png`,
  and `src/webviews/apps/media/plus-commit-graph-illustrated.png`.
- Removed unreferenced Launchpad product icon declarations, icon source SVGs, icon maps, and Launchpad-only exports from `src/community/stubs/pro.ts`.
- Removed obsolete `gitkraken` config typings and the unregistered `gitkraken.env` environment switch.
- Removed GitKraken-specific AI picker special handling; the community stub has no GitKraken provider registration.

Known tooling issue:

- `pnpm run build:icons` currently fails at `svgo -q -f ./images/icons/ --config svgo.config.js` with `No SVGs found in ./images/icons` even though the directory contains SVGs. The Launchpad icon cleanup was therefore applied at the mapping/source level and validated with `pnpm run check` plus `pnpm run build:quick`; the existing `dist/glicons.woff2` may still contain unused Launchpad glyph bytes until the icon generation script is fixed.

Pending explicit-confirmation cleanup:

- `images/originals/gitlens-*` design source files can be removed if the project no longer wants to retain upstream artwork sources.
- `images/gitlens-icon.png`, `images/dark/icon-gitlens-*`, `images/light/icon-gitlens-*`, and `images/icons/gitlens*.svg` can be removed or renamed only after confirming no icon-font/theme compatibility is needed.
- `.claude/skills` contains upstream GitLens-oriented agent guidance; deleting it is safe only if this fork no longer uses Claude skills.
- `.github/*` and `.augment/*` are currently deleted in the working tree; keep the deletion only with owner confirmation, otherwise restore and rebrand them as WeGit governance/automation.
