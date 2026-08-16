/**
 * WeGit Quick Wizard E2E Tests
 *
 * Comprehensive tests for all Git Commands quick wizard flows.
 * Tests verify:
 * 1. Every step in every flow is reachable
 * 2. Back navigation works correctly at each step
 * 3. Correct titles and placeholders at each step
 * 4. Cross-flow transitions (e.g., branch create → worktree create)
 * 5. Edge cases (e.g., branches linked to worktrees)
 *
 * Commands covered:
 * - Branch: create, delete, prune, rename, upstream
 * - Tag: create, delete
 * - Stash: push, pop, apply, drop, list, rename
 * - Remote: add, remove, prune
 * - Worktree: open, create, delete
 * - Fetch, Pull, Push
 * - Switch/Checkout
 * - Merge, Rebase, Cherry-pick
 * - Reset, Revert, Log, Show, Search, Status
 *
 * Testing Strategy for Back Navigation:
 * - Each test navigates forward to a specific step
 * - Then navigates backward to verify the previous step is correctly restored
 * - Verifies step identity via title/placeholder patterns
 *
 * Note: Navigation helpers (goBackAndVerify, waitForStep, etc.) are now part of
 * the QuickPick component in tests/e2e/pageObjects/components/quickPick.ts
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';
import type { VSCodeInstance } from '../baseTest.js';
import { test as base, createTmpDir, expect, GitFixture, ShortTimeout } from '../baseTest.js';
import type { Step } from '../pageObjects/components/quickPick.js';
import type { WeGitPage } from '../pageObjects/gitLensPage.js';

/** Git fixture for test repository */
let git: GitFixture;
let repoDir: string;

// Configure vscodeOptions with setup callback to create test repo with worktrees
const test = base.extend({
	vscodeOptions: [
		{
			vscodeVersion: process.env.VSCODE_VERSION ?? 'stable',
			setup: async () => {
				repoDir = await createTmpDir();
				git = new GitFixture(repoDir);
				await git.init();

				// Create branches for testing
				await git.branch('feature-1');
				await git.branch('feature-2');
				await git.branch('feature-with-worktree');
				await git.branch('develop');

				// Create some commits and tags on main
				await git.commit('Second commit', 'file2.txt', 'content 2');
				await git.tag('v1.0.0');
				await git.commit('Third commit', 'file3.txt', 'content 3');
				await git.tag('v1.1.0');
				await git.commit('Fourth commit', 'file4.txt', 'content 4');

				// Create commits on feature-1 for cherry-pick testing
				// (these will be unique commits not on main)
				await git.checkout('feature-1');
				await git.commit('Feature 1 commit A', 'feature1-a.txt', 'feature 1 content A');
				await git.commit('Feature 1 commit B', 'feature1-b.txt', 'feature 1 content B');
				await git.checkout('main');

				// Create a worktree for testing worktree-linked branch scenarios.
				// Retry to handle transient filesystem errors under parallel load: lock-file conflicts
				// from VS Code's background git operations and Windows file locking (antivirus/indexing),
				// which surface as either `index.lock` or `fatal: Could not write new index file`.
				// Use a FRESH path per attempt — a partial `worktree add` leaves the target directory
				// behind, so retrying the same path would fail with "already exists". The name embeds the
				// worker-unique repo dir name (`gltest-e2e-…`) so sibling worktrees can't collide across
				// workers in the shared temp parent. On failure, remove the orphaned directory and prune
				// the stale admin entry before retrying.
				const maxAttempts = 5;
				for (let attempt = 0; attempt < maxAttempts; attempt++) {
					const worktreeDir = path.join(repoDir, '..', `worktree-${path.basename(repoDir)}-${attempt}`);
					try {
						await git.worktree(worktreeDir, 'feature-with-worktree');
						break;
					} catch (ex) {
						const message = String(ex);
						const transient =
							message.includes('index.lock') || message.includes('Could not write new index file');
						if (attempt < maxAttempts - 1 && transient) {
							await fs.rm(worktreeDir, { recursive: true, force: true }).catch(() => {});
							await git.pruneWorktrees().catch(() => {});
							await new Promise(resolve => setTimeout(resolve, 1000));
							continue;
						}
						throw ex;
					}
				}

				// Create stashes for testing stash commands
				// Stash 1: Working tree changes (must include untracked since file is new)
				await git.createFile('stash-test-1.txt', 'stash content 1');
				await git.stash('Test stash 1', { includeUntracked: true });

				// Stash 2: More changes (must include untracked since file is new)
				await git.createFile('stash-test-2.txt', 'stash content 2');
				await git.stash('Test stash 2', { includeUntracked: true });

				// Add a remote for testing remote commands
				await git.addRemote('origin', 'https://github.com/example/repo.git');

				// Create fake remote tracking branches for testing upstream flows
				await git.createRemoteBranch('origin', 'main');
				await git.createRemoteBranch('origin', 'develop');

				// Create a branch with a missing upstream for testing branch prune
				// This simulates a branch that was tracking a remote branch that has been deleted
				await git.branch('stale-feature');
				await git.setUpstream('stale-feature', 'origin/stale-feature');

				return repoDir;
			},
		},
		{ scope: 'worker' },
	],
});

async function selectCommandAndWaitForStepWithOptionalRepo(
	{ gitlens, gitlens: { quickPick }, page }: VSCodeInstance,
	command: string,
	step: Step,
	multipleRepos?: boolean,
): Promise<void> {
	await gitlens.executeCommandFireAndForget('gitlens.gitCommands');
	await quickPick.waitForVisible();

	// Select the command
	await quickPick.waitForStep({ placeholder: /选择一个命令/ });
	// Type the command to filter the list
	await quickPick.enterTextAndWaitForItems(command);
	await quickPick.selectItem(new RegExp(command, 'i'));

	// May get a repo picker step if multiple repos exist
	const index = await quickPick.waitForAnyStep([{ placeholder: /选择仓库/ }, step]);
	if (index === 0) {
		// Repo picker, select repo then wait for step
		await quickPick.enterTextAndWaitForItems('gltest');
		if (multipleRepos) {
			await quickPick.selectItemMulti(/gltest/i);
		} else {
			await quickPick.selectItem(/gltest/i);
		}

		await page.waitForTimeout(ShortTimeout / 2);
		await quickPick.waitForStep(step);
	}

	await page.waitForTimeout(ShortTimeout / 2);
}

async function selectCommandSubcommandAndWaitForStepWithOptionalRepo(
	{ gitlens, gitlens: { quickPick }, page }: VSCodeInstance,
	command: string,
	subcommand: string,
	step: Step,
): Promise<void> {
	await gitlens.executeCommandFireAndForget('gitlens.gitCommands');
	await quickPick.waitForVisible();

	// Select the command
	await quickPick.waitForStep({ placeholder: /选择一个命令/ });
	// Type the command to filter the list
	await quickPick.enterTextAndWaitForItems(command);
	await quickPick.selectItem(new RegExp(command, 'i'));

	await quickPick.waitForStep({ placeholder: new RegExp(`Choose a ${command} command`, 'i') });
	await quickPick.enterTextAndWaitForItems(subcommand);
	await quickPick.selectItem(new RegExp(subcommand, 'i'));

	// Select subcommand - but first check if a repo picker appeared
	const index = await quickPick.waitForAnyStep([{ placeholder: /选择仓库/ }, step]);
	if (index === 0) {
		// Repo picker, select repo then wait for step
		await quickPick.enterTextAndWaitForItems('gltest');
		await quickPick.selectItem(/gltest/i);

		await page.waitForTimeout(ShortTimeout / 2);
		await quickPick.waitForStep(step);
	}

	await page.waitForTimeout(ShortTimeout / 2);
}

async function reverseCommandAndRepo({ gitlens: { quickPick }, page }: VSCodeInstance): Promise<void> {
	// Wait for quick pick to settle before going back
	await page.waitForTimeout(ShortTimeout / 2);

	// Back from current step → (repo) → command
	await quickPick.goBack();
	const index = await quickPick.waitForAnyStep([{ placeholder: /选择仓库/ }, { placeholder: /选择一个命令/ }]);
	if (index === 0) {
		// Back from repo → command
		await quickPick.goBackAndWaitForStep({ placeholder: /选择一个命令/ });
	}
}

async function reverseCommandSubcommandAndRepo(
	{ gitlens: { quickPick }, page }: VSCodeInstance,
	command: string,
): Promise<void> {
	// Wait for quick pick to settle before going back
	await page.waitForTimeout(ShortTimeout / 2);

	// Back from current step → (repo) → subcommand
	await quickPick.goBack();
	const index = await quickPick.waitForAnyStep([
		{ placeholder: /选择仓库/ },
		{ placeholder: new RegExp(`Choose a ${command} command`, 'i') },
	]);
	if (index === 0) {
		// Back from repo → subcommand
		await quickPick.goBackAndWaitForStep({ placeholder: new RegExp(`Choose a ${command} command`, 'i') });
	}

	// Back from subcommand → command
	await quickPick.goBackAndWaitForStep({ placeholder: /选择一个命令/ });
}

/**
 * Helper to test direct commands that open at a specific step.
 * Executes the command, waits for the quick pick, verifies the expected step title, then cancels.
 */
async function testDirectGitCommand(gitlens: WeGitPage, suffix: string, step: Step): Promise<void> {
	const { quickPick } = gitlens;

	await gitlens.executeCommandFireAndForget(`gitlens.git.${suffix}`);
	await quickPick.waitForVisible();
	await quickPick.waitForStep(step);

	await quickPick.cancel();
	expect(await quickPick.isVisible()).toBeFalsy();
}

test.describe('Quick Wizard — Branch Commands', () => {
	test.describe('Branch Create Flow', () => {
		test('Complete flow: command → subcommand → reference → name → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'branch', 'create', {
				title: /选择创建分支的基准/,
				placeholder: /选择新分支的基准来源/,
			});

			// Select `main` as base reference
			await quickPick.selectItem(/main/i);

			// Enter branch name
			await quickPick.waitForStep({ title: /创建分支 from/, placeholder: /分支名称/ });
			await quickPick.enterTextAndSubmit('test-branch-create');

			// Confirm step
			await quickPick.waitForStep({ title: /确认创建分支/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → name
			await quickPick.goBackAndWaitForStep({ title: /创建分支 from/, placeholder: /分支名称/ });

			// Back from name → reference
			await quickPick.goBackAndWaitForStep({ title: /选择创建分支的基准/, placeholder: /选择新分支的基准来源/ });

			await reverseCommandSubcommandAndRepo(vscode, 'branch');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Branch Delete Flow', () => {
		test('Complete flow: command → subcommand → branches → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'branch', 'delete', {
				title: /删除分支/,
				placeholder: /选择要删除的分支/,
			});

			// Select a branch to delete (use feature-2 which has no worktree)
			await quickPick.enterTextAndWaitForItems('feature-2');
			await quickPick.selectItemMulti(/feature-2/);

			// Confirm step
			await quickPick.waitForStep({ title: /确认删除分支/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → branch
			await quickPick.goBackAndWaitForStep({ title: /删除分支/, placeholder: /选择要删除的分支/ });

			await reverseCommandSubcommandAndRepo(vscode, 'branch');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Worktree delete flow: command → subcommand → branches → worktree confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'branch', 'delete', {
				title: /删除分支/,
				placeholder: /选择要删除的分支/,
			});

			// Select the branch that has a worktree
			await quickPick.enterTextAndWaitForItems('feature-with-worktree');
			await quickPick.selectItemMulti(/feature-with-worktree/i);

			// Confirm worktree deletion
			await quickPick.waitForStep({ title: /删除工作树（分支）/ });

			// Note: The full flow would continue to delete the worktree then delete the branch,
			// but we stop here to test navigation without actually performing destructive operations

			// === REVERSE NAVIGATION ===

			// Back from worktree confirm → branch
			await quickPick.goBackAndWaitForStep({ title: /删除分支/, placeholder: /选择要删除的分支/ });

			await reverseCommandSubcommandAndRepo(vscode, 'branch');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Branch Rename Flow', () => {
		test('Complete flow: command → subcommand → branch → name → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'branch', 'rename', {
				title: /重命名分支/,
				placeholder: /选择要重命名的分支/,
			});

			// Select a branch to rename (feature-2)
			await quickPick.selectItem('feature-2');

			// Enter new name
			await quickPick.waitForStep({ title: /重命名分支/, placeholder: /分支名称/ });
			await quickPick.enterTextAndSubmit('feature-2-renamed');

			// Confirm step
			await quickPick.waitForStep({ title: /确认重命名分支/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → name
			await quickPick.goBackAndWaitForStep({ title: /重命名分支/, placeholder: /分支名称/ });

			// Back from name → branch
			await quickPick.goBackAndWaitForStep({ title: /重命名分支/, placeholder: /选择要重命名的分支/ });

			await reverseCommandSubcommandAndRepo(vscode, 'branch');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Branch Upstream Flow', () => {
		test('Complete flow: command → subcommand → branch → upstream → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'branch', 'upstream', {
				title: /更改上游/,
				placeholder: /选择要更改上游跟踪的分支/,
			});

			// Select a branch to change upstream
			await quickPick.selectItem(/feature-1/i);

			// Select an upstream remote branch
			await quickPick.waitForStep({ title: /更改上游/, placeholder: /选择要跟踪的上游分支/ });
			await quickPick.selectItem(/origin\/main/i);

			// Confirm step
			await quickPick.waitForStep({ title: /确认(更改|设置|取消)上游/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → upstream
			await quickPick.goBackAndWaitForStep({
				title: /更改上游/,
				placeholder: /选择要跟踪的上游分支/,
			});

			// Back from upstream → branch
			await quickPick.goBackAndWaitForStep({ title: /更改上游/, placeholder: /选择要更改上游跟踪的分支/ });

			await reverseCommandSubcommandAndRepo(vscode, 'branch');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Branch Prune Flow', () => {
		test('Complete flow: command → subcommand → branches → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'branch', 'prune', {
				title: /清理分支/,
				placeholder: /选择要删除的上游缺失分支/,
			});

			// Select a branch with missing upstreams
			await quickPick.selectItemMulti(/stale-feature/i);

			// Confirm step
			await quickPick.waitForStep({ title: /确认清理分支/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → branch
			await quickPick.goBackAndWaitForStep({ title: /清理分支/, placeholder: /选择要删除的上游缺失分支/ });

			await reverseCommandSubcommandAndRepo(vscode, 'branch');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});
});

test.describe('Quick Wizard — Switch Command', () => {
	test('Complete flow: command → branch picker → confirm & reverse', async ({
		vscode,
		vscode: {
			gitlens: { quickPick },
		},
	}) => {
		await selectCommandAndWaitForStepWithOptionalRepo(
			vscode,
			'switch',
			{
				title: /切换/,
				placeholder: /选择要切换到的分支/,
			},
			true,
		);

		// Select a branch to switch to
		await quickPick.enterTextAndWaitForItems('feature-1');
		await quickPick.selectItem(/feature-1/i);

		// Confirm step
		await quickPick.waitForStep({ title: /确认切换/ });

		// === REVERSE NAVIGATION ===

		// Back from confirm → branch
		await quickPick.goBackAndWaitForStep({ title: /切换/, placeholder: /选择要切换到的分支/ });

		await reverseCommandAndRepo(vscode);

		await quickPick.cancel();
		expect(await quickPick.isVisible()).toBeFalsy();
	});
});

test.describe('Quick Wizard — Tag Commands', () => {
	test.describe('Tag Create Flow', () => {
		test('Complete flow: command → subcommand → reference → name → message → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'tag', 'create', {
				title: /创建标签/,
				placeholder: /选择一个分支或标签作为新标签的来源/,
			});

			// Select `main` branch as reference
			await quickPick.selectItem(/main/i);

			// Enter tag name
			await quickPick.waitForStep({ title: /创建标签 于/, placeholder: /标签名称/ });
			await quickPick.enterTextAndSubmit('v2.0.0');

			// Enter tag message
			await quickPick.waitForStep({ title: /创建标签 于/, placeholder: /可选：输入用于注解标签的消息/ });
			await quickPick.enterTextAndSubmit('Release 2.0.0');

			// Confirm step
			await quickPick.waitForStep({ title: /确认创建标签/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → message
			await quickPick.goBackAndWaitForStep({ title: /创建标签 于/, placeholder: /可选：输入用于注解标签的消息/ });

			// Back from message → name
			await quickPick.goBackAndWaitForStep({ title: /创建标签 于/, placeholder: /标签名称/ });

			// Back from name → reference
			await quickPick.goBackAndWaitForStep({
				title: /创建标签/,
				placeholder: /选择一个分支或标签作为新标签的来源/,
			});

			await reverseCommandSubcommandAndRepo(vscode, 'tag');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Tag Delete Flow', () => {
		test('Complete flow: command → subcommand → pick tags → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'tag', 'delete', {
				title: /删除标签/,
				placeholder: /选择要删除的标签/,
			});

			// Select a tag to delete (use v1.1.0)
			await quickPick.selectItemMulti(/v1\.1\.0/);

			// Confirm step
			await quickPick.waitForStep({ title: /确认删除标签/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → tag
			await quickPick.goBackAndWaitForStep({ title: /删除标签/, placeholder: /选择要删除的标签/ });

			await reverseCommandSubcommandAndRepo(vscode, 'tag');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});
});

test.describe('Quick Wizard — Stash Commands', () => {
	test.describe('Stash Push Flow', () => {
		test('Complete flow: command → subcommand → confirm → message & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			// The push wizard was reversed (commit "Reverses the stash push wizard"): the confirm
			// step now precedes the message input to avoid back-navigation loops with confirm overrides.
			// The confirm step shows because launching via the menu (`gitlens.gitCommands`, no args) makes
			// `startedFrom === 'menu'`, so the skip key is `stash-push:menu` — not the default-skipped
			// `stash-push:command`. If `stash-push:menu` is ever added to `gitCommands.skipConfirmations`,
			// the confirm step vanishes and this test would time out on the (now-absent) confirm step.
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'stash', 'push', {
				title: /确认创建存储/,
				placeholder: /确认创建存储/,
			});

			// Select the plain "创建存储" confirmation option (negative lookahead excludes the
			// "快照" / "并…" variants, so this is order-independent rather than relying on `.first()`)
			await quickPick.selectItem(/创建存储(?!并|快照)/);

			// Message step (placeholder distinguishes it from the still-matching "确认创建存储" title)
			await quickPick.waitForStep({ title: /创建存储/, placeholder: /存储消息/ });

			// === REVERSE NAVIGATION ===
			// Do not submit a message — submitting would execute the stash. Navigate back instead.

			// Back from message → confirm
			await quickPick.goBackAndWaitForStep({ title: /确认创建存储/, placeholder: /确认创建存储/ });

			await reverseCommandSubcommandAndRepo(vscode, 'stash');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Stash List Flow', () => {
		test('Complete flow: command → subcommand → stash picker → show (files) → show (commands) & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'stash', 'list', {
				title: /存储列表/,
				placeholder: /选择一个贮藏/,
			});

			// Ensure items appear
			await quickPick.waitForItems(ShortTimeout);
			const count = await quickPick.countItems();
			expect(count).toBeGreaterThan(0);

			// Select a stash to show
			await quickPick.selectItem(/Test stash/i);

			// Show step - starts in commands mode (placeholder is the stash description)
			await quickPick.waitForStep({ title: /存储 #/i, placeholder: /存储 #.*Test stash/i });

			// Verify we're in commands mode by checking for the toggle to files hint
			let items: string[] = await quickPick.getVisibleItems();
			expect(items.some(item => item.includes('点击查看所有已更改文件'))).toBeTruthy();

			// Toggle to files mode (click the toggle item with hint about files)
			await quickPick.selectItem(/点击查看所有已更改文件/);

			// Verify we're now in files mode by checking for the toggle back to actions hint
			await quickPick.waitForStep({ title: /存储 #/i });
			items = await quickPick.getVisibleItems();
			expect(items.some(item => item.includes('点击查看存储操作'))).toBeTruthy();

			// === REVERSE NAVIGATION ===

			// Back from files → stash picker (toggle doesn't add to history, so back skips commands mode)
			await quickPick.goBackAndWaitForStep({ title: /存储列表/, placeholder: /选择一个贮藏/ });

			await reverseCommandSubcommandAndRepo(vscode, 'stash');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Toggle multiple times: files → commands → files, then back should go directly to stash list', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
				page,
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'stash', 'list', {
				title: /存储列表/,
				placeholder: /选择一个贮藏/,
			});

			// Select a stash to show
			await quickPick.selectItem(/Test stash/i);

			// Start in commands mode
			await quickPick.waitForStep({ title: /存储 #/i });
			let items: string[] = await quickPick.getVisibleItems();
			expect(items.some(item => item.includes('点击查看所有已更改文件'))).toBeTruthy();

			// Toggle to files mode
			await quickPick.selectItem(/点击查看所有已更改文件/);
			await quickPick.waitForStep({ title: /存储 #/i });
			items = await quickPick.getVisibleItems();
			expect(items.some(item => item.includes('点击查看存储操作'))).toBeTruthy();

			// Toggle back to commands mode
			await quickPick.selectItem(/点击查看存储操作/);
			await page.waitForTimeout(ShortTimeout); // Give time for the step to update
			await quickPick.waitForStep({ title: /存储 #/i });
			items = await quickPick.getVisibleItems();
			expect(items.some(item => item.includes('点击查看所有已更改文件'))).toBeTruthy();

			// Back from commands → should go directly to stash picker (not through files mode)
			await quickPick.goBackAndWaitForStep({ title: /存储列表/, placeholder: /选择一个贮藏/ });

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Stash Apply Flow', () => {
		test('Complete flow: command → subcommand → stash picker → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'stash', 'apply', {
				title: /应用存储/,
				placeholder: /选择要应用到工作树的存储/,
			});

			// Select a stash to apply
			await quickPick.selectItem(/Test stash/i);

			// Confirm step
			await quickPick.waitForStep({ title: /确认应用存储/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → stash
			await quickPick.goBackAndWaitForStep({ title: /应用存储/, placeholder: /选择要应用到工作树的存储/ });

			await reverseCommandSubcommandAndRepo(vscode, 'stash');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Stash Pop Flow', () => {
		test('Complete flow: command → subcommand → stash picker → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'stash', 'pop', {
				title: /弹出存储/,
				placeholder: /选择要弹出的存储/,
			});

			// Select a stash to pop
			await quickPick.selectItem(/Test stash/i);

			// Confirm step
			await quickPick.waitForStep({ title: /确认弹出存储/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → stash
			await quickPick.goBackAndWaitForStep({ title: /弹出存储/, placeholder: /选择要弹出的存储/ });

			await reverseCommandSubcommandAndRepo(vscode, 'stash');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Stash Drop Flow', () => {
		test('Complete flow: command → subcommand → stash picker → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'stash', 'drop', {
				title: /删除存储/,
				placeholder: /选择要删除的存储/,
			});

			// Select a stash to drop
			await quickPick.selectItemMulti(/Test stash/i);

			// Confirm step
			await quickPick.waitForStep({ title: /确认删除存储/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → stash
			await quickPick.goBackAndWaitForStep({ title: /删除存储/, placeholder: /选择要删除的存储/ });

			await reverseCommandSubcommandAndRepo(vscode, 'stash');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Stash Rename Flow', () => {
		test('Complete flow: command → subcommand → stash → message → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'stash', 'rename', {
				title: /重命名存储/,
				placeholder: /选择要重命名的存储/,
			});

			// Select a stash to rename
			await quickPick.selectItem(/Test stash/i);

			// Enter new message
			await quickPick.waitForStep({ title: /重命名存储/, placeholder: /存储消息/ });
			await quickPick.enterTextAndSubmit('Renamed stash');

			// Confirm step
			await quickPick.waitForStep({ title: /确认重命名存储/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → message input
			await quickPick.goBackAndWaitForStep({ title: /重命名存储/, placeholder: /存储消息/ });

			// Back from message input → stash picker (input fields require two backs)
			await quickPick.goBackAndWaitForStep({ title: /重命名存储/, placeholder: /选择要重命名的存储/ });

			// Now use helper to navigate back through subcommand to command
			await reverseCommandSubcommandAndRepo(vscode, 'stash');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});
});

test.describe('Quick Wizard — Remote Commands', () => {
	test.describe('Remote Add Flow', () => {
		test('Complete flow: command → subcommand → name → url → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'remote', 'add', {
				title: /添加远程/,
				placeholder: /远程仓库名称/,
			});

			// Enter new remote name
			await quickPick.enterTextAndSubmit('upstream');

			// Enter remote url
			await quickPick.waitForStep({ title: /添加远程/, placeholder: /远程仓库 URL/ });
			await quickPick.enterTextAndSubmit('https://github.com/example/repo.git');

			// Confirm step
			await quickPick.waitForStep({ title: /确认添加远程/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → url input
			await quickPick.goBackAndWaitForStep({ title: /添加远程/, placeholder: /远程仓库 URL/ });

			// Back from url input → name input
			await quickPick.goBackAndWaitForStep({ title: /添加远程/, placeholder: /远程仓库名称/ });

			await reverseCommandSubcommandAndRepo(vscode, 'remote');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Remote Prune Flow', () => {
		test('Complete flow: command → subcommand → pick remote → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'remote', 'prune', {
				title: /清理远程/,
				placeholder: /选择要清理的远程/,
			});

			// Select remote to prune
			await quickPick.selectItem(/origin/i);

			// Confirm step
			await quickPick.waitForStep({ title: /确认清理远程/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → remote picker
			await quickPick.goBackAndWaitForStep({ title: /清理远程/, placeholder: /选择要清理的远程/ });

			await reverseCommandSubcommandAndRepo(vscode, 'remote');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Remote Remove Flow', () => {
		test('Complete flow: command → subcommand → pick remote → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'remote', 'remove', {
				title: /移除远程/,
				placeholder: /选择要移除的远程/,
			});

			// Select remote to remove
			await quickPick.selectItem(/origin/i);

			// Confirm step
			await quickPick.waitForStep({ title: /确认移除远程/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → remote picker
			await quickPick.goBackAndWaitForStep({ title: /移除远程/, placeholder: /选择要移除的远程/ });

			await reverseCommandSubcommandAndRepo(vscode, 'remote');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});
});

test.describe('Quick Wizard — Fetch/Pull/Push Commands', () => {
	test.describe('Fetch Flow', () => {
		test('Complete flow: command → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'fetch', { title: /确认抓取/ }, true);

			// === REVERSE NAVIGATION ===

			await reverseCommandAndRepo(vscode);

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Pull Flow', () => {
		test('Complete flow: command → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'pull', { title: /确认拉取/ }, true);

			// === REVERSE NAVIGATION ===

			await reverseCommandAndRepo(vscode);

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Push Flow', () => {
		test('Complete flow: command → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'push', { title: /确认推送/ }, true);

			// === REVERSE NAVIGATION ===

			await reverseCommandAndRepo(vscode);

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});
});

test.describe('Quick Wizard — Merge/Rebase/Cherry-pick/Reset/Revert Commands', () => {
	test.describe('Merge Flow', () => {
		test('Complete flow: command → branch → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'merge', {
				title: /合并到 main/,
				placeholder: /选择要合并的分支/,
			});

			// Select a branch to merge (feature-1 has unique commits)
			await quickPick.enterTextAndWaitForItems('feature-1');
			await quickPick.selectItem(/feature-1/i);

			// Confirm step
			await quickPick.waitForStep({ title: /确认将 feature-1 合并到 main/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → branch
			await quickPick.goBackAndWaitForStep({ title: /合并到 main/, placeholder: /选择要合并的分支/ });

			await reverseCommandAndRepo(vscode);

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Select current branch forces commit selection: command → branch (main) → commits & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'merge', {
				title: /合并到 main/,
				placeholder: /选择要合并的分支/,
			});

			// Select the current branch (main) - this should force commit selection
			// Use a pattern that matches "main" at the start but allows for additional text (icons, description)
			await quickPick.selectItem(/^\s*main\s/i);

			// Select a commit to merge
			await quickPick.waitForStep({ title: /合并到 main/, placeholder: /选择要合并到 分支 main 的提交/ });
			await quickPick.enterTextAndWaitForItems('Fourth');
			await quickPick.selectItem(/Fourth commit/i);

			await quickPick.waitForStep({ title: /确认将/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → commits
			await quickPick.goBackAndWaitForStep({
				title: /合并到 main/,
				placeholder: /选择要合并到 分支 main 的提交/,
			});

			// Back from commits → branch
			await quickPick.goBackAndWaitForStep({ title: /合并到 main/, placeholder: /选择要合并的分支/ });

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Toggle commit selection: command → toggle button → branch → commits & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
				page,
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'merge', {
				title: /合并到 main/,
				placeholder: /选择要合并的分支/,
			});

			// At branch selection step, click the commit toggle button (initially shows "选择分支")
			// The button tooltip when off is "选择分支", click to toggle to commit mode
			await quickPick.clickActionButton(/选择分支/);

			// Select a branch (after toggle, selecting a branch will then show commits)
			await quickPick.enterTextAndWaitForItems('feature-1');
			await quickPick.selectItem(/feature-1/i);
			await page.waitForTimeout(ShortTimeout);

			// Should go to commit selection step (because toggle was enabled)
			await quickPick.waitForStep({ title: /合并到 main/, placeholder: /选择要合并到 分支 main 的提交/ });

			// Select a commit to merge
			await quickPick.selectItem(/Feature 1 commit/i);

			// Confirm step
			await quickPick.waitForStep({ title: /确认将/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → commits
			await quickPick.goBackAndWaitForStep({
				title: /合并到 main/,
				placeholder: /选择要合并到 分支 main 的提交/,
			});

			// Back from commits → branch
			await quickPick.goBackAndWaitForStep({ title: /合并到 main/, placeholder: /选择要合并的分支/ });

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Rebase Flow', () => {
		test('Complete flow: command → branch → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'rebase', {
				title: /变基 main 到/,
				placeholder: /选择要变基到的分支/,
			});

			// Select a branch to rebase onto
			await quickPick.enterTextAndWaitForItems('feature-1');
			await quickPick.selectItem(/feature-1/i);

			// Confirm step
			await quickPick.waitForStep({ title: /确认变基/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → branch
			await quickPick.goBackAndWaitForStep({ title: /变基 main 到/, placeholder: /选择要变基到的分支/ });

			await reverseCommandAndRepo(vscode);

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Select current branch + current commit: command → branch (main) → commits -> confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
				page,
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'rebase', {
				title: /变基 main 到/,
				placeholder: /选择要变基到的分支/,
			});

			// Select the current branch (main) forces commit selection
			// Use a pattern that matches "main" at the start but allows for additional text (icons, description)
			await quickPick.selectItem(/^\s*main\s/i);
			await page.waitForTimeout(ShortTimeout);

			// Select the most recent commit (Fourth commit) - rebasing onto HEAD results in "Nothing to rebase"
			await quickPick.waitForStep({ title: /变基 main 到/, placeholder: /选择要让 分支 main 变基到的提交/ });
			await quickPick.enterTextAndWaitForItems('Fourth');
			await quickPick.selectItem(/Fourth commit/i);

			await quickPick.waitForStep({ title: /确认变基 main 到/, placeholder: /无可变基内容/ });

			// === REVERSE NAVIGATION ===

			// Back confirm → commits
			await quickPick.goBackAndWaitForStep({
				title: /变基 main 到/,
				placeholder: /选择要让 分支 main 变基到的提交/,
			});

			// Back from commits → branch
			await quickPick.goBackAndWaitForStep({ title: /变基 main 到/, placeholder: /选择要变基到的分支/ });

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Select current branch + non-current commit: command → branch (main) → commits → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
				page,
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'rebase', {
				title: /变基 main 到/,
				placeholder: /选择要变基到的分支/,
			});

			// Select the current branch (main) forces commit selection
			// Use a pattern that matches "main" at the start but allows for additional text (icons, description)
			await quickPick.selectItem(/^\s*main\s/i);
			await page.waitForTimeout(ShortTimeout);

			// Select an older commit (Third commit) - allows a real rebase operation
			await quickPick.waitForStep({ title: /变基 main 到/, placeholder: /选择要让 分支 main 变基到的提交/ });
			await quickPick.enterTextAndWaitForItems('Third');
			await quickPick.selectItem(/Third commit/i);

			await quickPick.waitForStep({ title: /确认变基 main 到/, placeholder: /Confirm 变基/ });

			// === REVERSE NAVIGATION ===

			// Back confirm → commits
			await quickPick.goBackAndWaitForStep({
				title: /变基 main 到/,
				placeholder: /选择要让 分支 main 变基到的提交/,
			});

			// Back from commits → branch
			await quickPick.goBackAndWaitForStep({ title: /变基 main 到/, placeholder: /选择要变基到的分支/ });

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Toggle commit selection: command → toggle button → branch → commits → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
				page,
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'rebase', {
				title: /变基 main 到/,
				placeholder: /选择要变基到的分支/,
			});

			// At branch selection step, click the commit toggle button (initially shows "选择分支")
			// The button tooltip when off is "选择分支", click to toggle to commit mode
			await quickPick.clickActionButton(/选择分支/);

			// Select a branch (after toggle, selecting a branch will then show commits)
			await quickPick.enterTextAndWaitForItems('feature-1');
			await quickPick.selectItem(/feature-1/i);
			await page.waitForTimeout(ShortTimeout);

			// Should go to commit selection step (because toggle was enabled)
			await quickPick.waitForStep({ title: /变基 main 到/, placeholder: /选择要让 分支 main 变基到的提交/ });

			// Select a commit to rebase onto
			await quickPick.selectItem(/Feature 1 commit/i);

			// Confirm step - title is "确认变基 main 到 feature-1"
			await quickPick.waitForStep({ title: /确认变基 main 到/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → commits
			await quickPick.goBackAndWaitForStep({
				title: /变基 main 到/,
				placeholder: /选择要让 分支 main 变基到的提交/,
			});

			// Back from commits → branch
			await quickPick.goBackAndWaitForStep({ title: /变基 main 到/, placeholder: /选择要变基到的分支/ });

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Cherry-pick Flow', () => {
		test('Complete flow with commits: command → branch → commits → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
				page,
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'cherry', {
				title: /拣选提交/,
				placeholder: /选择要从中拣选提交的分支/,
			});

			// Select main branch which has commits ahead of current branch
			// Select feature-1 which should have commits different from main
			await quickPick.enterTextAndWaitForItems('feature-1');
			await quickPick.selectItem(/feature-1/i);

			// Select a commit
			await page.waitForTimeout(ShortTimeout);
			await quickPick.waitForStep({ title: /拣选提交/, placeholder: /选择要拣选到 分支 main 的提交/ });
			await quickPick.selectItemMulti(/Feature 1 commit/i);

			// Confirm step
			await quickPick.waitForStep({ title: /确认 拣选提交/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → commits
			await quickPick.goBackAndWaitForStep({ title: /拣选提交/, placeholder: /选择要拣选到 分支 main 的提交/ });

			// Back from commits → branch
			await quickPick.goBackAndWaitForStep({ title: /拣选提交/, placeholder: /选择要从中拣选提交的分支/ });

			await reverseCommandAndRepo(vscode);

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('No commits to pick flow: command → branch → no commits & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'cherry', {
				title: /拣选提交/,
				placeholder: /选择要从中拣选提交的分支/,
			});

			// Select a branch to pick from - main is currently checked out, so picking from main has no commits
			// Select develop which was branched from main at the same point, so no unique commits
			await quickPick.enterTextAndWaitForItems('develop');
			await quickPick.selectItem(/develop/i);

			// Should show "no commits" placeholder
			await quickPick.waitForStep({ title: /拣选提交/, placeholder: /未找到可拣选的提交/ });

			// === REVERSE NAVIGATION ===

			// Back from commits → branch
			await quickPick.goBackAndWaitForStep({ title: /拣选提交/, placeholder: /选择要从中拣选提交的分支/ });

			await reverseCommandAndRepo(vscode);

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Reset Flow', () => {
		test('Complete flow: command → commit → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'reset', {
				title: /重置/,
				placeholder: /选择要将 main 重置到的提交/,
			});

			// Select a commit to reset to
			await quickPick.selectItem(/commit/i);

			// Confirm step
			await quickPick.waitForStep({ title: /确认重置/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → commit
			await quickPick.goBackAndWaitForStep({ title: /重置/, placeholder: /选择要将 main 重置到的提交/ });

			await reverseCommandAndRepo(vscode);

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Revert Flow', () => {
		test('Complete flow: command → commits → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'revert', {
				title: /撤销提交/,
				placeholder: /选择要撤销的提交/,
			});

			// Select a commit to revert
			await quickPick.selectItemMulti(/commit/i);

			// Confirm step
			await quickPick.waitForStep({ title: /确认撤销提交/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → commits
			await quickPick.goBackAndWaitForStep({ title: /撤销提交/, placeholder: /选择要撤销的提交/ });

			await reverseCommandAndRepo(vscode);

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});
});

test.describe('Quick Wizard — Log/Show/Search Commands', () => {
	test.describe('Log Flow', () => {
		test('Complete flow: command → branch → commits → show & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'log', {
				title: /提交/,
				placeholder: /选择要显示其提交历史的分支或标签/,
			});

			// Select a branch
			await quickPick.enterTextAndWaitForItems('main');
			await quickPick.selectItem(/main/i);

			await quickPick.waitForStep({ title: /提交/, placeholder: /选择一个提交/ });

			// Ensure items appear
			await quickPick.waitForItems(ShortTimeout);
			const count = await quickPick.countItems();
			expect(count).toBeGreaterThan(0);

			// Select a commit
			await quickPick.selectItem(/commit/i);

			// Show step - title is "提交 <sha> (<message>)" - transitions to show command
			await quickPick.waitForStep({ title: /提交 [a-f0-9]+/i });

			// Verify we're in commands mode by checking for the toggle to files hint
			const items: string[] = await quickPick.getVisibleItems();
			expect(items.some(item => item.includes('点击查看所有已更改文件'))).toBeTruthy();

			// === REVERSE NAVIGATION ===

			// Back from show → commits
			await quickPick.goBackAndWaitForStep({ title: /提交/, placeholder: /选择一个提交/ });

			// Back from commits → branch
			await quickPick.goBackAndWaitForStep({ title: /提交/, placeholder: /选择要显示其提交历史的分支或标签/ });

			await reverseCommandAndRepo(vscode);

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Show Flow', () => {
		test('Complete flow: command → reference input → commit details & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'show', {
				title: /查看/,
				placeholder: /输入引用或提交 SHA/,
			});

			// Enter a reference (HEAD or main) and submit.
			// Wait for the validated commit item (label is the commit summary, e.g. "Fourth commit")
			// instead of the empty-state [返回] directive — submitting while the reference validation
			// is still pending would accept the back directive and return the wizard to the root menu.
			await quickPick.enterText('HEAD');
			await quickPick.getVisibleItem(/Fourth commit/);
			await quickPick.submit();

			// Should show commit details - title is "提交 <sha> (<message>)"
			await quickPick.waitForStep({ title: /提交 [a-f0-9]+/i });

			// Verify we're in actions mode by checking for the toggle to files hint
			const items: string[] = await quickPick.getVisibleItems();
			expect(items.some(item => item.includes('点击查看所有已更改文件'))).toBeTruthy();

			// === REVERSE NAVIGATION ===

			// Back from commit details → reference input
			await quickPick.goBackAndWaitForStep({ title: /查看/, placeholder: /输入引用或提交 SHA/ });

			await reverseCommandAndRepo(vscode);

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Search Flow', () => {
		test('Complete flow: command → search query → results → commit details & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'search', {
				title: /提交搜索/,
				placeholder: /例如：“更新依赖” author:liao666brant/,
			});

			// Enter a search query and submit (search for "Fourth" which should match our test commit)
			await quickPick.enterTextAndSubmit('Fourth');

			// Wait for search results
			await quickPick.waitForStep({ title: /提交搜索/, placeholder: /，匹配 Fourth/ });

			// Ensure items appear
			await quickPick.waitForItems(ShortTimeout);
			const count = await quickPick.countItems();
			expect(count).toBeGreaterThan(0);

			// Filter to find a specific commit (avoid stashes which also match "commit")
			await quickPick.enterTextAndWaitForItems('Fourth');
			await quickPick.selectItem(/Fourth commit/i);

			// Should show commit details - title is "提交 <sha> (<message>)"
			await quickPick.waitForStep({ title: /提交 [a-f0-9]+/i });

			// === REVERSE NAVIGATION ===

			// Back from commit details → search results
			await quickPick.goBack();
			// May be at search results or back to search input depending on flow
			// (the results/input title becomes "Commit 按消息搜索" once the query is parsed)
			const stepIndex = await quickPick.waitForAnyStep([
				{ title: /提交搜索|Commit 按消息搜索/, placeholder: /，匹配 Fourth/ },
				{ title: /Commit 按消息搜索/, placeholder: /例如：“更新依赖”/ },
			]);

			if (stepIndex === 0) {
				// At search results, go back to search input
				await quickPick.goBackAndWaitForStep({
					title: /Commit 按消息搜索/,
					placeholder: /例如：“更新依赖”/,
				});
			}

			// Now at search input - if there's a query value, first back clears it
			const inputValue = await quickPick.input.inputValue();
			if (inputValue.trim()) {
				// First back clears the query, second back goes to previous step
				await quickPick.goBack();
			}

			// Now at search input with empty query, continue reverse
			await reverseCommandAndRepo(vscode);

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Search operators: verify all search operator options are shown', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'search', {
				title: /提交搜索/,
				placeholder: /例如：“更新依赖” author:liao666brant/,
			});

			// Verify search operators are shown in the list
			const items: string[] = await quickPick.getVisibleItems();

			// Check for expected search operators
			expect(items.some(item => item.includes('按消息搜索'))).toBeTruthy();
			expect(items.some(item => item.includes('按作者搜索'))).toBeTruthy();
			expect(items.some(item => item.includes('按提交 SHA 搜索'))).toBeTruthy();
			expect(items.some(item => item.includes('按引用或范围搜索'))).toBeTruthy();
			expect(items.some(item => item.includes('按类型搜索'))).toBeTruthy();
			expect(items.some(item => item.includes('按文件搜索'))).toBeTruthy();
			expect(items.some(item => item.includes('按更改搜索'))).toBeTruthy();
			expect(items.some(item => item.includes('搜索某日期之后'))).toBeTruthy();
			expect(items.some(item => item.includes('搜索某日期之前'))).toBeTruthy();

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Search with no results: shows appropriate message', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
				page,
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'search', {
				title: /提交搜索/,
				placeholder: /例如：“更新依赖” author:liao666brant/,
			});

			// Search for something that won't exist
			await quickPick.enterTextAndWaitForItems('xyznonexistentquery123456789');
			await page.waitForTimeout(ShortTimeout);
			// The item's label is "搜索" and the query is its description
			await quickPick.selectItem(/搜索.*xyznonexistentquery123456789/);

			// Wait for results - should show "No results"
			await quickPick.waitForStep({ title: /提交搜索/, placeholder: /没有结果/ });

			// === REVERSE NAVIGATION ===

			await quickPick.goBack();
			await page.waitForTimeout(ShortTimeout);
			await quickPick.waitForStep({
				title: /Commit 按消息搜索/,
				placeholder: /例如：“更新依赖”/,
			});

			// At search input - if there's a query value, first back clears it
			const inputValue = await quickPick.input.inputValue();
			if (inputValue.trim()) {
				// First back clears the query, second back goes to previous step
				await quickPick.goBack();
			}

			await reverseCommandAndRepo(vscode);

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Search by author operator: selecting author operator adds to query', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
				page,
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'search', {
				title: /提交搜索/,
				placeholder: /例如：“更新依赖” author:liao666brant/,
			});

			// Select the "Search by Author" operator
			await quickPick.selectItem(/按作者搜索/);

			// The input should now contain "author:" operator
			await page.waitForTimeout(ShortTimeout / 2);
			const inputValue = await quickPick.input.inputValue();
			expect(inputValue).toContain('author:');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Search by commit SHA operator: selecting SHA operator adds to query', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
				page,
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'search', {
				title: /提交搜索/,
				placeholder: /例如：“更新依赖” author:liao666brant/,
			});

			// Select the "Search by Commit SHA" operator
			await quickPick.selectItem(/按提交 SHA 搜索/);

			// The input should now contain "commit:" operator
			await page.waitForTimeout(ShortTimeout / 2);
			const inputValue = await quickPick.input.inputValue();
			expect(inputValue).toContain('commit:');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Back button clears query first before navigating back', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
				page,
			},
		}) => {
			await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'search', {
				title: /提交搜索/,
				placeholder: /例如：“更新依赖” author:liao666brant/,
			});

			// Enter a search query (but don't submit)
			await quickPick.enterText('test query');
			await page.waitForTimeout(ShortTimeout / 2);

			// Verify query is entered
			let inputValue = await quickPick.input.inputValue();
			expect(inputValue).toBe('test query');

			// Press back - should clear the query, not navigate back
			await quickPick.goBack();
			await page.waitForTimeout(ShortTimeout / 2);

			// Verify we're still on the search step with empty query
			await quickPick.waitForStep({
				title: /提交搜索/,
				placeholder: /例如：“更新依赖” author:liao666brant/,
			});
			inputValue = await quickPick.input.inputValue();
			expect(inputValue).toBe('');

			// Press back again - now should navigate back (to repo or command)
			await quickPick.goBack();
			const stepIndex = await quickPick.waitForAnyStep([
				{ placeholder: /选择仓库/ },
				{ placeholder: /选择一个命令/ },
			]);

			// Verify we navigated back
			expect(stepIndex).toBeGreaterThanOrEqual(0);

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});
});

test.describe('Quick Wizard — Status Command', () => {
	test('Complete flow: command → status info & reverse', async ({
		vscode,
		vscode: {
			gitlens: { quickPick },
		},
	}) => {
		await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'status', { title: /状态/ });

		// Status step shows repository status information
		// Verify items are shown (branch info, changed files, etc.)
		await quickPick.waitForItems(ShortTimeout);
		const count = await quickPick.countItems();
		expect(count).toBeGreaterThan(0);

		// Verify status shows branch information (main branch)
		const items: string[] = await quickPick.getVisibleItems();
		expect(items.some(item => /main/i.test(item))).toBeTruthy();

		// === REVERSE NAVIGATION ===

		await reverseCommandAndRepo(vscode);

		await quickPick.cancel();
		expect(await quickPick.isVisible()).toBeFalsy();
	});
});

test.describe('Quick Wizard — Worktree Commands', () => {
	test.describe('Worktree Create Flow', () => {
		test('Create from non-checked-out branch: command → branch picker → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'worktree', 'create', {
				title: /创建工作树/,
				placeholder: /选择用于创建新工作树的分支/,
			});

			// Select a non-checked-out branch (feature-2 is not checked out and has no worktree)
			await quickPick.enterTextAndWaitForItems('feature-2');
			await quickPick.selectItem(/feature-2/i);

			// Should go directly to confirm step (no branch name input needed)
			await quickPick.waitForStep({ title: /确认 创建工作树 • feature-2/ });

			// Verify the confirm options are shown
			const items: string[] = await quickPick.getVisibleItems();
			expect(items.some(item => item.includes('从分支创建工作树'))).toBeTruthy();

			// === REVERSE NAVIGATION ===

			// Back from confirm → branch picker
			await quickPick.goBackAndWaitForStep({ title: /创建工作树/, placeholder: /选择用于创建新工作树的分支/ });

			await reverseCommandSubcommandAndRepo(vscode, 'worktree');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Create from checked-out branch (current branch): command → branch picker → branch name input → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'worktree', 'create', {
				title: /创建工作树/,
				placeholder: /选择用于创建新工作树的分支/,
			});

			// Select the current checked-out branch (main) - this triggers the "create new branch" flow
			// because you can't have two worktrees for the same branch
			await quickPick.enterTextAndWaitForItems('main');
			await quickPick.selectItem(/^\s*main\s/i);

			// Should show branch name input step (since main is already checked out)
			await quickPick.waitForStep({
				title: /创建工作树，并从 main 创建新分支/,
				placeholder: /分支名称/,
			});

			// Enter a new branch name
			await quickPick.enterTextAndSubmit('new-worktree-branch');

			// Confirm step
			await quickPick.waitForStep({ title: /确认 创建工作树 • new-worktree-branch/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → branch name input
			await quickPick.goBackAndWaitForStep({
				title: /创建工作树，并从 main 创建新分支/,
				placeholder: /分支名称/,
			});

			// Back from branch name input → branch picker
			await quickPick.goBackAndWaitForStep({ title: /创建工作树/, placeholder: /选择用于创建新工作树的分支/ });

			await reverseCommandSubcommandAndRepo(vscode, 'worktree');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Create from branch with existing worktree: command → branch picker → branch name input & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'worktree', 'create', {
				title: /创建工作树/,
				placeholder: /选择用于创建新工作树的分支/,
			});

			// Select the branch that already has a worktree (feature-with-worktree)
			// This should also require creating a new branch
			await quickPick.enterTextAndWaitForItems('feature-with-worktree');
			await quickPick.selectItem(/feature-with-worktree/i);

			// Should show branch name input step (since the branch already has a worktree)
			await quickPick.waitForStep({
				title: /创建工作树，并从 feature-with-worktree 创建新分支/,
				placeholder: /分支名称/,
			});

			// Enter a new branch name
			await quickPick.enterTextAndSubmit('new-worktree-branch');

			// Confirm step
			await quickPick.waitForStep({ title: /确认 创建工作树/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → branch name input
			await quickPick.goBackAndWaitForStep({
				title: /创建工作树，并从 feature-with-worktree 创建新分支/,
				placeholder: /分支名称/,
			});

			// Back from branch name input → branch picker
			await quickPick.goBackAndWaitForStep({ title: /创建工作树/, placeholder: /选择用于创建新工作树的分支/ });

			await reverseCommandSubcommandAndRepo(vscode, 'worktree');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Choose Specific Folder: selecting folder returns to confirm, escaping returns to confirm', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
				page,
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'worktree', 'create', {
				title: /创建工作树/,
				placeholder: /选择用于创建新工作树的分支/,
			});

			// Select a non-checked-out branch to get to confirm step quickly
			await quickPick.enterTextAndWaitForItems('feature-2');
			await quickPick.selectItem(/feature-2/i);

			// Wait for confirm step
			await quickPick.waitForStep({ title: /确认 创建工作树 • feature-2/ });

			// Select "Choose Specific Folder..." option
			await quickPick.selectItem(/选择指定文件夹/);

			// The folder picker dialog should appear - press Escape to cancel it
			await page.waitForTimeout(ShortTimeout);
			await page.keyboard.press('Escape');

			// Should return to confirm step after escaping folder picker
			await quickPick.waitForStep({ title: /确认 创建工作树 • feature-2/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → branch picker
			await quickPick.goBackAndWaitForStep({ title: /创建工作树/, placeholder: /选择用于创建新工作树的分支/ });

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Change Root Folder: selecting folder returns to confirm, escaping returns to confirm', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
				page,
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'worktree', 'create', {
				title: /创建工作树/,
				placeholder: /选择用于创建新工作树的分支/,
			});

			// Select a non-checked-out branch to get to confirm step quickly
			await quickPick.enterTextAndWaitForItems('feature-2');
			await quickPick.selectItem(/feature-2/i);

			// Wait for confirm step
			await quickPick.waitForStep({ title: /确认 创建工作树 • feature-2/ });

			// Select "Change Root Folder..." option
			await quickPick.selectItem(/更改根文件夹/);

			// The folder picker dialog should appear - press Escape to cancel it
			await page.waitForTimeout(ShortTimeout);
			await page.keyboard.press('Escape');

			// Should return to confirm step after escaping folder picker
			await quickPick.waitForStep({ title: /确认 创建工作树 • feature-2/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → branch picker
			await quickPick.goBackAndWaitForStep({ title: /创建工作树/, placeholder: /选择用于创建新工作树的分支/ });

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		// This test must run LAST in the Worktree Create Flow section because it actually creates a worktree
		test('Create → Open transition: after creating worktree, open prompt appears', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'worktree', 'create', {
				title: /创建工作树/,
				placeholder: /选择用于创建新工作树的分支/,
			});

			// Select a non-checked-out branch (feature-2 has no worktree yet)
			await quickPick.enterTextAndWaitForItems('feature-2');
			await quickPick.selectItem(/feature-2/i);

			// Should go directly to confirm step (no branch name input needed)
			await quickPick.waitForStep({ title: /确认 创建工作树 • feature-2/ });

			// Confirm to actually create the worktree
			// Select the default option "从分支创建工作树"
			await quickPick.selectItem(/从分支创建工作树/);

			// After worktree is created, should transition to "Open Worktree" confirm step
			// The default setting is "prompt" so the open dialog should appear
			await quickPick.waitForStep(
				{ title: /确认 打开工作树 • feature-2|打开工作树 • feature-2/ },
				15000, // Worktree creation can take a moment
			);

			// Verify the open options are shown
			const items: string[] = await quickPick.getVisibleItems();
			expect(items.some(item => item.includes('打开工作树'))).toBeTruthy();
			expect(items.some(item => item.includes('在新窗口中打开工作树'))).toBeTruthy();

			// Cancel without opening the worktree (to avoid changing the workspace)
			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Worktree Open Flow', () => {
		test('Complete flow: command → subcommand → worktree picker → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'worktree', 'open', {
				title: /打开工作树/,
				placeholder: /选择要打开的工作树/,
			});

			// Verify worktrees are shown
			await quickPick.waitForItems(ShortTimeout);
			const count = await quickPick.countItems();
			expect(count).toBeGreaterThan(0);

			// Select a worktree (the one we created in setup: feature-with-worktree)
			await quickPick.selectItem(/feature-with-worktree/i);

			// Confirm step with open options
			await quickPick.waitForStep({ title: /确认 打开工作树 • feature-with-worktree/ });

			// Verify confirm options are shown
			const items: string[] = await quickPick.getVisibleItems();
			expect(items.some(item => item.includes('打开工作树'))).toBeTruthy();
			expect(items.some(item => item.includes('在新窗口中打开工作树'))).toBeTruthy();
			expect(items.some(item => item.includes('将工作树添加到工作区'))).toBeTruthy();
			expect(items.some(item => item.includes('在文件资源管理器中显示'))).toBeTruthy();

			// === REVERSE NAVIGATION ===

			// Back from confirm → worktree picker
			await quickPick.goBackAndWaitForStep({ title: /打开工作树/, placeholder: /选择要打开的工作树/ });

			await reverseCommandSubcommandAndRepo(vscode, 'worktree');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Confirm options: Open in current window, new window, add to workspace, reveal in explorer', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'worktree', 'open', {
				title: /打开工作树/,
				placeholder: /选择要打开的工作树/,
			});

			// Select a worktree
			await quickPick.waitForItems(ShortTimeout);
			await quickPick.selectItem(/feature-with-worktree/i);

			// Wait for confirm step
			await quickPick.waitForStep({ title: /确认 打开工作树 • feature-with-worktree/ });

			// Verify all expected options are present
			// Note: getVisibleItems() returns all text content including descriptions
			const items: string[] = await quickPick.getVisibleItems();
			const hasOpenWorktree = items.some(item => item.includes('将在当前窗口中打开该工作树'));
			const hasNewWindow = items.some(item => item.includes('在新窗口中打开工作树'));
			const hasAddToWorkspace = items.some(item => item.includes('将工作树添加到工作区'));
			const hasRevealExplorer = items.some(item => item.includes('在文件资源管理器中显示'));

			expect(hasOpenWorktree).toBeTruthy();
			expect(hasNewWindow).toBeTruthy();
			expect(hasAddToWorkspace).toBeTruthy();
			expect(hasRevealExplorer).toBeTruthy();

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Worktree Delete Flow', () => {
		test('Complete flow: command → subcommand → pick worktrees → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'worktree', 'delete', {
				title: /删除工作树/,
				placeholder: /选择要删除的工作树/,
			});

			// Verify worktrees are shown
			await quickPick.waitForItems(ShortTimeout);
			const count = await quickPick.countItems();
			expect(count).toBeGreaterThan(0);

			// Select a worktree to delete (the one we created in setup: feature-with-worktree)
			await quickPick.enterTextAndWaitForItems('feature-with-worktree');
			await quickPick.selectItemMulti(/feature-with-worktree/i);

			// Confirm step
			await quickPick.waitForStep({ title: /确认 删除工作树/ });

			// === REVERSE NAVIGATION ===

			// Back from confirm → worktree picker
			await quickPick.goBackAndWaitForStep({ title: /删除工作树/, placeholder: /选择要删除的工作树/ });

			await reverseCommandSubcommandAndRepo(vscode, 'worktree');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});

		test('Confirm options: Delete, Force Delete, Delete with Branch, Force Delete with Branch', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'worktree', 'delete', {
				title: /删除工作树/,
				placeholder: /选择要删除的工作树/,
			});

			// Select a worktree
			await quickPick.waitForItems(ShortTimeout);
			await quickPick.selectItemMulti(/feature-with-worktree/i);

			// Wait for confirm step
			await quickPick.waitForStep({ title: /确认 删除工作树/ });

			// Verify all expected options are present
			// Note: getVisibleItems() returns all text content including descriptions
			const items: string[] = await quickPick.getVisibleItems();
			// Basic delete has "将删除" without "强制"
			const hasDelete = items.some(
				item => item.includes('删除工作树') && item.includes('将删除') && !item.includes('强制'),
			);
			const hasForceDelete = items.some(item => item.includes('强制删除工作树'));
			const hasDeleteWithBranch = items.some(item => item.includes('删除工作树与分支'));
			const hasForceDeleteWithBranch = items.some(item => item.includes('强制删除工作树与分支'));

			expect(hasDelete).toBeTruthy();
			expect(hasForceDelete).toBeTruthy();
			expect(hasDeleteWithBranch).toBeTruthy();
			expect(hasForceDeleteWithBranch).toBeTruthy();

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});

	test.describe('Worktree Copy Changes Flow', () => {
		test('Complete flow: command → subcommand → worktree picker → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'worktree', 'copy-changes', {
				title: /复制工作区更改到工作树/,
				placeholder: /选择要复制工作区更改到的工作树/,
			});

			// Verify worktrees are shown
			await quickPick.waitForItems(ShortTimeout);
			const count = await quickPick.countItems();
			expect(count).toBeGreaterThan(0);

			try {
				// Create uncommitted changes BEFORE selecting worktree
				// The diff is checked after worktree selection, so changes must exist at that point
				await git.createFile('test-file.txt', 'modified content for copy changes test');

				// Select a target worktree
				await quickPick.selectItem(/feature-with-worktree/i);

				// Wait for confirm step (we have uncommitted changes)
				await quickPick.waitForStep({ title: /确认 复制工作区更改到工作树/ });

				// Verify confirm options
				const items: string[] = await quickPick.getVisibleItems();
				expect(items.some(item => item.includes('复制'))).toBeTruthy();

				// === REVERSE NAVIGATION ===
				await quickPick.goBackAndWaitForStep({
					title: /复制工作区更改到工作树/,
					placeholder: /选择要复制工作区更改到的工作树/,
				});

				await reverseCommandSubcommandAndRepo(vscode, 'worktree');

				await quickPick.cancel();
				expect(await quickPick.isVisible()).toBeFalsy();
			} finally {
				// Clean up uncommitted changes
				await git.reset('HEAD', 'hard');
			}
		});

		test('Complete flow without any changes: command → subcommand → worktree picker → confirm & reverse', async ({
			vscode,
			vscode: {
				gitlens: { quickPick },
			},
		}) => {
			await selectCommandSubcommandAndWaitForStepWithOptionalRepo(vscode, 'worktree', 'copy-changes', {
				title: /复制工作区更改到工作树/,
				placeholder: /选择要复制工作区更改到的工作树/,
			});

			// Verify worktrees are shown
			await quickPick.waitForItems(ShortTimeout);
			const count = await quickPick.countItems();
			expect(count).toBeGreaterThan(0);

			// Select a target worktree
			await quickPick.selectItem(/feature-with-worktree/i);

			// Wait for confirm step (we have uncommitted changes)
			await quickPick.waitForStep({ title: /确认 复制工作区更改到工作树/ });

			// Verify confirm options
			const items: string[] = await quickPick.getVisibleItems();
			expect(items.some(item => item.includes('确定'))).toBeTruthy();

			// === REVERSE NAVIGATION ===
			await quickPick.goBackAndWaitForStep({
				title: /复制工作区更改到工作树/,
				placeholder: /选择要复制工作区更改到的工作树/,
			});

			await reverseCommandSubcommandAndRepo(vscode, 'worktree');

			await quickPick.cancel();
			expect(await quickPick.isVisible()).toBeFalsy();
		});
	});
});

test.describe('Quick Wizard — Co-Authors Command', () => {
	test('Complete flow: command → contributors picker & reverse', async ({
		vscode,
		vscode: {
			gitlens: { quickPick },
		},
	}) => {
		await selectCommandAndWaitForStepWithOptionalRepo(vscode, 'co-author', { title: /添加共同作者/ });

		// === REVERSE NAVIGATION ===

		await reverseCommandAndRepo(vscode);

		await quickPick.cancel();
		expect(await quickPick.isVisible()).toBeFalsy();
	});
});

test.describe('Quick Wizard — Direct Command Access', () => {
	test.describe('Branch Direct Commands', () => {
		test('Direct branch create command opens at create step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'branch.create', { title: /选择创建分支的基准/ });
		});

		test('Direct branch delete command opens at delete step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'branch.delete', { title: /删除分支/ });
		});

		test('Direct branch rename command opens at rename step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'branch.rename', { title: /重命名分支/ });
		});
	});

	test.describe('Switch Direct Commands', () => {
		test('Direct switch command opens at switch step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'switch', { title: /切换/ });
		});
	});

	test.describe('Tag Direct Commands', () => {
		test('Direct tag create command opens at create step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'tag.create', { title: /创建标签/ });
		});

		test('Direct tag delete command opens at delete step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'tag.delete', { title: /删除标签/ });
		});
	});

	test.describe('Stash Direct Commands', () => {
		test('Direct stash push command opens at push step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'stash.push', { title: /创建存储/ });
		});

		test('Direct stash list command opens at list step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'stash.list', { title: /存储列表/ });
		});

		test('Direct stash pop command opens at pop step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'stash.pop', { title: /弹出存储/ });
		});

		test('Direct stash drop command opens at drop step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'stash.drop', { title: /删除存储/ });
		});

		test('Direct stash rename command opens at rename step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'stash.rename', { title: /重命名存储/ });
		});
	});

	test.describe('Remote Direct Commands', () => {
		test('Direct remote add command opens at add step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'remote.add', { title: /添加远程/ });
		});

		test('Direct remote prune command opens at prune step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'remote.prune', { title: /清理远程/ });
		});

		test('Direct remote remove command opens at remove step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'remote.remove', { title: /移除远程/ });
		});
	});

	test.describe('Merge/Rebase/Cherry-pick/Reset/Revert Direct Commands', () => {
		test('Direct merge command opens at merge step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'merge', { title: /合并到 main/ });
		});

		test('Direct rebase command opens at rebase step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'rebase', { title: /变基 main 到/ });
		});

		test('Direct cherry-pick command opens at cherry-pick step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'cherryPick', { title: /拣选提交/ });
		});

		test('Direct reset command opens at reset step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'reset', { title: /重置/ });
		});

		test('Direct revert command opens at revert step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'revert', { title: /撤销提交/ });
		});
	});

	test.describe('Worktree Direct Commands', () => {
		test('Direct worktree create command opens at create step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'worktree.create', { title: /选择用于创建工作树的分支/ });
		});

		test('Direct worktree open command opens at open step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'worktree.open', { title: /打开工作树/ });
		});

		test('Direct worktree delete command opens at delete step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'worktree.delete', { title: /删除工作树/ });
		});
	});

	test.describe('Show/Status Direct Commands', () => {
		test('Direct show command opens at show step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'show', { title: /查看/ });
		});

		test('Direct status command opens at status step', async ({ vscode }) => {
			await testDirectGitCommand(vscode.gitlens, 'status', { title: /状态/ });
		});
	});
});
