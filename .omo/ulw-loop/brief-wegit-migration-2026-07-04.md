# WeGit full migration brief

User request: finish the remaining GitLens -> WeGit migration using a team, and clean up orphaned code caused by the migration.

Constraints:

- User-visible branding should become WeGit.
- Author stays liao666brant.
- Keep internal `gitlens.*` command/config IDs only where needed for VS Code extension compatibility and migration safety.
- Do not revert user changes in the dirty worktree.
- True durable `teammode` is blocked because no codex_app thread tools are available in this session; use available parallel multi_agent_v1 subagents and record that limitation.
- No git commit unless explicitly requested.

Tier: HEAVY. Justification: repo-wide brand/refactor migration across manifests, docs, webviews, scripts, generated artifacts, and cleanup of potentially orphaned code.

Skills used:

- omo:ulw-loop: user requested ulw and evidence-bound execution.
- omo:teammode: user requested a team; durable team blocked by missing codex_app thread tools.
- omo:ulw-plan: multi-module migration planning.
- omo:programming: TypeScript/package manifest edits may be required.
- omo:refactor: request includes refactor/cleanup/orphan code removal.
- ponytail:ponytail: active full mode; keep shortest safe diff and delete over add.

Success criteria:

1. Brand scan: remaining `GitLens`/`gitlens` occurrences are either gone or classified as intentional compatibility/internal/vendor/history exceptions, with evidence artifact.
2. Migration cleanup: stale GitLens/GitKraken/upstream-only repository metadata/config/templates/workflows/agents are removed or rewritten where safe, with no broken package manifest or generated contribution outputs.
3. Orphan cleanup: files/code made unused by rename are removed or documented as intentional compatibility; no obvious broken references remain.
4. Verification: `pnpm run generate:contributions`, `pnpm run check`, and `pnpm run build:quick` pass or any blocker is captured with concrete logs.
5. Real-surface auxiliary proof: parse `package.json`, confirm extension display name/icon/publisher/author/repo, and run brand scan command with saved output.
