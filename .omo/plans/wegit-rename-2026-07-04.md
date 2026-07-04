# ULW Notepad: WeGit Rename 2026-07-04

## Bootstrap

- Tier: LIGHT. This is a branding/metadata rename inside existing manifest, docs, and welcome surfaces; no new module, API, storage, auth, or behavior layer.
- Skills used:
  - `ulw-loop`: user requested `ulw`; used for evidence-led criteria and notepad tracking.
  - `programming`: package manifests and TypeScript welcome copy are in scope.
- Skills skipped:
  - `ulw-plan`: not needed because this is not a cross-domain behavior redesign.
  - `git-master`: no commit requested.
- ULW CLI: `omo ulw-loop status --json` produced no usable output here, so this notepad records the same criteria and evidence locally.

## Success Criteria

1. Manifest surface identifies the extension as `wegit` / `WeGit`, describes it as a small, focused Git tool, and sets author/publisher to `liao666brant`.
   - Scenario: `node -e "<parse package.json and packages/core/package.json; assert expected fields>"`.
   - Evidence: `.omo/evidence/wegit-rename-2026-07-04/{red,green}-manifest.json`.
2. User-facing README, walkthrough, welcome, and contribution titles no longer present GitLens/GitKraken/Eric Amodio/eamodio as the current project identity.
   - Scenario: `rg -n "GitLens|GitKraken|Eric Amodio|eamodio" README.md packages/core/README.md walkthroughs/welcome src/webviews/apps/welcome contributions.json package.json`, allowing internal compatibility IDs only where intentionally scoped.
   - Evidence: `.omo/evidence/wegit-rename-2026-07-04/{red,green}-brand-scan.txt`.

## Findings

- RED manifest proof captured: current extension is `gitlens`, publisher is `eamodio`, author is `Eric Amodio`, core package author is `GitKraken`.
- RED brand scan captured: README, core README, walkthroughs, welcome page, and contributions still display GitLens/GitKraken identity.
- Ponytail decision: keep internal `gitlens.*` command/config/context IDs and URI scheme for compatibility. Rename user-visible identity and package metadata only.

## Evidence Log

- Updated extension manifest to `wegit` / `WeGit — 小而美的 Git 工具`, publisher and author `liao666brant`, and fork URLs from the current `origin` remote.
- Updated core package metadata to `@liao666brant/core-wegit` and author `liao666brant`; updated related build/pack scripts and bundle metadata.
- Rewrote README to the small WeGit project brief and updated welcome/walkthrough/docs/contribution UI copy from old branding to WeGit.
- Regenerated `package.json` contributions and telemetry docs.
- GREEN manifest proof: `.omo/evidence/wegit-rename-2026-07-04/green-manifest.json` -> PASS (`ok: true`).
- GREEN brand scan: `.omo/evidence/wegit-rename-2026-07-04/green-brand-scan.txt` -> PASS (empty after allowed internal compatibility IDs).
- Verification:
  - `pnpm run check` -> PASS (`Found 0 warnings and 0 errors.`)
  - `pnpm run build:quick` -> PASS (extension node/webworker, common, webviews, and unit-tests compiled successfully)
  - `git diff --check` -> PASS
- Cleanup receipt: no server, tmux session, browser, port, container, or temp runtime state was started for this data-shaped QA.
