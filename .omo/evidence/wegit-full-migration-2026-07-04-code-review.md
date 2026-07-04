# WeGit Full Migration Code Review

Review date: 2026-07-04
Scope: current working tree diff vs `HEAD`, including staged, unstaged, and untracked evidence files.
Recommendation: REQUEST_CHANGES
Code quality status: BLOCK

## Skill-Perspective Check

- `remove-ai-slops`: ran by loading `C:/Users/11566/.codex/plugins/cache/sisyphuslabs/omo/4.15.1/skills/remove-ai-slops/SKILL.md`. Applied its overfit/slop review pass to production and test diffs. No deletion-only tests found, but multiple changed E2E tests only mirror renamed strings/selectors and the suite was not run, so they provide weak confidence for the migration.
- `programming`: ran by loading `C:/Users/11566/.codex/plugins/cache/sisyphuslabs/omo/4.15.1/skills/programming/SKILL.md` plus TypeScript references (`README.md`, `type-patterns.md`, `data-modeling.md`, `error-handling.md`). No sampled TypeScript diff introduced `any`, `@ts-ignore`, non-null assertions, or needless new abstractions. The diff violates the programming perspective on verification discipline by removing CI gates and touching E2E/UI surfaces without full build/test evidence.

## Evidence Reviewed

- `.omo/evidence/wegit-full-migration-2026-07-04/allowlist.md`
- `.omo/evidence/wegit-full-migration-2026-07-04/manifest-green.json`
- `.omo/evidence/wegit-full-migration-2026-07-04/check-post-build-final.log`
- `.omo/evidence/wegit-full-migration-2026-07-04/build-quick-final.log`
- `.omo/evidence/wegit-full-migration-2026-07-04/bootstrap-notepad.md`
- `git diff --stat HEAD`, `git diff --name-status HEAD`, targeted diffs for manifest, telemetry, CI, tests, scripts, docs, IPC compatibility paths.

## CRITICAL

None found.

## HIGH

1. `.github` CI/security/test gates were deleted wholesale, which is outside a safe branding migration and removes the project’s continuous verification surface.

   Deleted files include `.github/workflows/ci.yml`, `.github/workflows/unit-tests.yml`, and `.github/workflows/codeql.yml`. The deleted CI workflow was responsible for formatting, production bundle, unit tests, and E2E workflow dispatch; CodeQL was the configured security scan. This creates immediate regression risk and makes future migration validation weaker. Restore these workflows and rebrand/update them instead of deleting them, unless there is explicit project-owner approval and replacement CI exists.

2. Verification evidence is insufficient for this blast radius.

   The final check artifact only shows `oxlint --type-aware --type-check` with 0 warnings/errors (`.omo/evidence/wegit-full-migration-2026-07-04/check-post-build-final.log:1`). The build artifact is `node ./scripts/build.mjs --quick` (`.omo/evidence/wegit-full-migration-2026-07-04/build-quick-final.log:1`) and explicitly says quick mode skips type checking, linting, docs, and asset generation (`build-quick-final.log:6`). There is no evidence for `pnpm run build`, `pnpm run test`, `pnpm run test:e2e`, `pnpm run bundle`, or live/manual QA despite changes to webviews, status bar, E2E page objects, manifest, docs, and extension identity. Run the full relevant gates before approval.

## MEDIUM

1. Project/process files were deleted or heavily collapsed beyond pure migration.

   `.augment/settings.json` and `.augment/skills` were deleted, removing the Augment/MCP inspector wiring. `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `BACKERS.md` were substantially rewritten/deleted rather than narrowly rebranded. Some of this may be intentional fork governance work, but it is not proven by the migration evidence and should get explicit maintainer/legal approval or be split from the branding migration.

2. AI provider branding may be misleading.

   `src/quickpicks/aiModelPicker.ts:90` still special-cases provider id `gitkraken`, but `src/quickpicks/aiModelPicker.ts:91` now says the models are provided by WeGit. If that backend/provider is still GitKraken-owned or GitKraken-account-backed, the UI copy is inaccurate. Confirm the service ownership and either keep neutral copy or rename the provider contract deliberately.

3. Evidence artifacts are not commit-ready.

   `.omo/plans/wegit-full-migration-2026-07-04.md` and `.omo/drafts/wegit-full-migration-2026-07-04.md` are untracked template placeholders, while the evidence directory used for review is also untracked. Keep the useful evidence or exclude it, but do not merge placeholder planning artifacts.

## LOW

1. Remaining brand hits look mostly allowlisted, but the allowlist still has deferred cleanup.

   The allowlist explicitly keeps `gitlens.*` commands/config/context/schemes, `@gitlens/*`, and required `@gitkraken/*`/`@eamodio/*` dependencies (`allowlist.md:9`, `allowlist.md:11`, `allowlist.md:12`). It also calls out pending `.claude/skills` and `images/originals/gitlens-*` cleanup (`allowlist.md:23`). That is acceptable as a non-blocking follow-up if documented.

2. Some tests are literal rename churn rather than stronger migration coverage.

   The E2E/page-object changes update names/selectors from GitLens to WeGit, and remote parser fixtures swap old repository owner strings for the fork owner. That is not harmful by itself, but it is weak evidence and should not be treated as behavioral coverage unless the E2E suite is actually run.

## Positive Checks

- Manifest identity is consistent with the migration: `name=wegit`, display name WeGit, publisher/author `liao666brant`, icon `images/wegit-icon.png`, telemetry default false (`manifest-green.json:2`, `manifest-green.json:3`, `manifest-green.json:4`, `manifest-green.json:8`, `manifest-green.json:13`).
- Current `package.json` confirms telemetry default false (`package.json:3008`, `package.json:3010`), and runtime fallback is also false (`src/telemetry/telemetry.ts:72`).
- OTLP exporter points to local loopback only and service name is `wegit` (`src/telemetry/openTelemetryProvider.ts:28`, `src/telemetry/openTelemetryProvider.ts:29`, `src/telemetry/openTelemetryProvider.ts:45`).
- Parsed manifest compatibility surface was stable: 591 command ids before/after, 249 config keys before/after, 1 scheme/custom-editor entry before/after; no command/config/scheme ids were removed or added.
- Targeted user-facing scan of `package.json`, `contributions.json`, `README.md`, `docs`, `src/webviews`, `src/messages.ts`, `src/statusbar`, and `walkthroughs` found only allowlisted `@eamodio/*` package imports/dependencies, not visible GitLens/GitKraken/eamodio copy.
- `git diff --check HEAD` was clean, and `package.json` plus `contributions.json` parse successfully.

## Blockers

- Restore or explicitly replace the deleted `.github` CI/unit-test/E2E/security workflows.
- Produce full verification evidence appropriate for this migration: at minimum `pnpm run build`, `pnpm run test`, and targeted E2E/live QA for the renamed extension identity and key UI surfaces; run `pnpm run test:e2e` if the touched E2E surface is expected to remain authoritative.
- Resolve the unscoped process/tooling deletions, either by restoring them or documenting explicit approval in the migration evidence.
