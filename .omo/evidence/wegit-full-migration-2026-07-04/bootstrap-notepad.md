# Bootstrap Notepad - WeGit full migration

Date: 2026-07-04
Tier: HEAVY
Reason: cross-module rename/refactor spanning manifests, docs, scripts, webviews, repo metadata, generated contribution files, and cleanup.

Skill survey:

- omo:ulw-loop: active because user requested ulw and evidence-bound goal execution.
- omo:teammode: active because user requested a team; true durable team is BLOCKED because codex_app thread tools are unavailable after tool_search.
- omo:ulw-plan: active because scope is multi-module and needs a decision-complete plan.
- omo:programming: active because TypeScript/package manifest edits may occur.
- omo:refactor: active because user requested refactor migration and orphan cleanup.
- ponytail:ponytail full: active; minimal safe diff, deletion over addition.

Tool limitation:

- tool_search exposed multi_agent_v1 only; no codex_app.create_thread/read_thread/send_message_to_thread/set_thread_archived.
- Therefore true `teammode` durable team cannot be created. We will not fake it.
- Fallback execution uses parallel multi_agent_v1 subagents and records that limitation.

ULW CLI limitation:

- `omo` is missing from PATH.
- Cached ulw-loop CLI was not found under `$CODEX_HOME/plugins/cache/sisyphuslabs/omo/*/components/ulw-loop/dist/cli.js`.
- Evidence will be recorded in `.omo/evidence/wegit-full-migration-2026-07-04/` and plan files instead of CLI ledger.

Initial RED:

- `.omo/evidence/wegit-full-migration-2026-07-04/red-brand-scan.txt` has 17651 lines before cleanup.
- `.omo/evidence/wegit-full-migration-2026-07-04/red-manifest-summary.json` confirms package top-level branding is already mostly WeGit.

Compatibility policy draft:

- Keep `gitlens.*` VS Code command/config/context IDs unless safely aliased/migrated; changing them wholesale can break user settings, command IDs, keybindings, and generated contribution contracts.
- Keep historical CHANGELOG and ThirdPartyNotices unless current branding or distribution docs require cleanup.
- Migrate user-visible current docs, README, walkthroughs, templates, active webview strings, package metadata, URLs, and repo governance files.
