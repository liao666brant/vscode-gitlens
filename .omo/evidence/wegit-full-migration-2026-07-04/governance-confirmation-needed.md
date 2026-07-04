# Governance cleanup confirmation needed

Reviewer result: `.github/*` and `.augment/*` deletions are outside the narrow WeGit brand-migration implementation surface.

Current state:

- `.github/*` workflows, issue templates, PR template, CODEOWNERS, and GitHub agent files are deleted in the working tree.
- `.augment/*` files are deleted in the working tree.
- These deletions existed in the dirty worktree before the final implementation pass and were not restored because user-owned changes must not be reverted without explicit instruction.

Impact:

- Deleting `.github/workflows/*` removes CI, release, unit-test, CodeQL, issue automation, and review automation.
- Deleting `.github/CODEOWNERS` and templates changes repository governance and contributor flow.
- Deleting `.augment/*` removes external agent/tool configuration.

Decision needed before final completion:

- Confirm keeping these deletions as part of the fork cleanup, or
- Ask to restore/rename the CI/governance files for WeGit.

Core migration verification completed despite this governance decision:

- `pnpm run build` passed; see `build-full.log`.
- `pnpm run check` passed; see `check-post-build-final.log` and the full build log.
- Manifest identity is WeGit / liao666brant / telemetry default false; see `manifest-green.json`.
