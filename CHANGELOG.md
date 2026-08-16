# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

## [20.0.2] - 2026-08-16

### Perf

- Trims the extension package size by ~630 KB (uncompressed) — the bundled changelog now carries only WeGit-era entries (the upstream GitLens history back to v18.1.0 is archived in the repository as `CHANGELOG.upstream.md`), stray development artifacts (`.work/`, `skills-lock.json`) are excluded from the package, and 7 unused settings-page preview images are removed

## [20.0.1] - 2026-08-16

### Perf

- Prevents user-facing git reads from stalling behind background work — `blame`, `diff`, `show`, and `status` commands now run at interactive queue priority, preempting queued background walks (e.g. commit graph loads) instead of waiting behind them
- Memoizes the branch/tag tips lookup per repository state — status-bar commit changes and gutter hovers no longer rebuild the whole grouped branches/tags structure on every SHA change
- Reuses the commit details file tree when a re-fetched file list is content-identical — skips the tree rebuild (and its DOM churn + expansion-state loss) for enrichment re-emits of the same commit

## [20.0.0] - 2026-08-16

### Perf

- Significantly reduces git process churn while editing — saving or staging a file no longer invalidates blame/diff results for every file in the repository: with working-tree watching active, file-scoped caches are invalidated per changed path, and open editors keep their in-memory blame snapshots instead of re-running `git blame` after every save
- Speeds up the first blame of a file — the current-user lookup (`git config` + `git check-mailmap`) now overlaps with the `git blame` process startup instead of blocking it, and `git ls-files` re-checks are skipped for already-tracked documents on index-only changes
- Reduces sidebar view churn — index-only changes (saves, staging) no longer fully rebuild affected view subtrees when their structure can't change, and per-node `getBranch`/`last-fetched` lookups are memoized between repository changes
- Reduces activation cost — removes the `onTerminal:*` activation trigger (activation still happens on startup), moves view/command registration off the measured activation path, and skips the full-configuration telemetry flatten when telemetry is disabled
- Converges remaining 5-minute `@gate` timeouts on view refresh paths to 30-second non-rejecting timeouts, aligning with the earlier view-hang fixes

## [18.2.0] - 2026-06-15

### Added

- Introduces AI-powered conflict resolution (Preview) &mdash; a new **Resolve** mode in the _Commit Graph_ WIP details panel that uses AI to resolve merge, rebase, and cherry-pick conflicts ([#5306](https://github.com/gitkraken/vscode-gitlens/issues/5306))
  - Resolves conflicted files in parallel with streamed progress, proposing a per-file resolution (merged, kept current, took incoming, deleted, or flagged as needs review) that you review as a diff before anything is applied
  - Adds the ability to refine the whole run with a prompt, give per-file feedback to re-resolve a single file, and apply or discard the proposed resolutions
  - Adds entry points across GitLens: a **Resolve** action on the WIP details header and the paused-operation banner, _Commit Graph_ context menus and WIP row buttons (all conflicts or selected files), the **Resolve Conflicts with AI** Command Palette command, and a **Resolve Conflict with AI** action on individual conflicted files in the sidebar views
  - Adds clickable file links in the resolve panel that open a conflicted working-tree file so you can inspect it before resolving

### Changed

- Changes the working changes (WIP) details header to lead with the _Resolve_ action when conflicts are present, ahead of _Compose_, _Review_, and _Compare_
- Updates the design and readbility of the Pro feature gates (e.g. _Commit Graph_, _Visual History_) &mdash; with an optional _Switch Repos_ action to move to a repository where the feature is available ([#5335](https://github.com/gitkraken/vscode-gitlens/issues/5335))
- Improves the AI weekly usage-limit message with a _Get More Credits_ action to purchase additional AI credits for users who can buy credits, or guidance to contact an org admin for those who can't ([#5298](https://github.com/gitkraken/vscode-gitlens/issues/5298))

[unreleased]: https://github.com/gitkraken/vscode-gitlens/compare/v20.0.2...HEAD
[20.0.2]: https://github.com/gitkraken/vscode-gitlens/compare/v20.0.1...gitkraken:v20.0.2
[20.0.1]: https://github.com/gitkraken/vscode-gitlens/compare/v20.0.0...gitkraken:v20.0.1
[20.0.0]: https://github.com/gitkraken/vscode-gitlens/compare/v18.2.0...gitkraken:v20.0.0
[18.2.0]: https://github.com/gitkraken/vscode-gitlens/compare/v18.1.0...gitkraken:v18.2.0
