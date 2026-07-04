/**
 * WeGit Smoke Tests
 *
 * Uses page objects provided by baseTest for cleaner, more maintainable E2E tests.
 * Uses a purpose-built test repository for consistent, self-contained tests.
 */
import * as process from 'node:process';
import { test as base, createTmpDir, expect, GitFixture, MaxTimeout } from '../baseTest.js';

// Configure vscodeOptions with setup callback to create a purpose-built test repository
const test = base.extend({
	vscodeOptions: [
		{
			vscodeVersion: process.env.VSCODE_VERSION ?? 'stable',
			setup: async () => {
				const repoDir = await createTmpDir();
				const git = new GitFixture(repoDir);
				await git.init();

				// Create a file with multiple commits for file/line history testing
				await git.commit('Add test file', 'test-file.txt', 'Initial content\nLine 2\nLine 3');
				await git.commit(
					'Update test file',
					'test-file.txt',
					'Updated content\nLine 2 modified\nLine 3\nLine 4',
				);
				await git.commit(
					'Add more content',
					'test-file.txt',
					'Updated content\nLine 2 modified\nLine 3\nLine 4\nLine 5',
				);

				// Create a feature branch
				await git.branch('feature-branch');

				// Create a tag
				await git.tag('v1.0.0', { message: 'Version 1.0.0' });

				// Create some uncommitted changes to stash
				await git.createFile('stash-test.txt', 'stash content');
				await git.stage('stash-test.txt');
				await git.stash('Test stash');

				// Add a remote (fake URL with non-GitHub host — avoids WeGit trying to connect to GitHub
				// integration, which can cause multi-second network timeouts if VPN is active)
				await git.addRemote('origin', 'https://example.com/test/test-repo.git');

				return repoDir;
			},
		},
		{ scope: 'worker' },
	],
});

// All smoke tests run serially on a single VS Code worker instance.
// This prevents resource contention when multiple test files run in parallel
// and ensures consistent teardown/setup across the describe groups.
test.describe.configure({ mode: 'serial' });

test.describe('Smoke Tests — Core', () => {
	test.describe.configure({ mode: 'serial' });
	test.afterEach(async ({ vscode }) => {
		await vscode.gitlens.resetUI();
	});

	test('should contain WeGit & WeGit Inspect icons in activity bar', async ({ vscode }) => {
		const tabCount = await vscode.gitlens.getActivityBarTabCount();
		expect(tabCount).toBeGreaterThanOrEqual(1);
	});

	test('should show WeGit status bar items', async ({ vscode }) => {
		await expect(vscode.gitlens.statusBar.locator).toBeVisible({ timeout: MaxTimeout });
	});
});

test.describe('Smoke Tests — WeGit views', () => {
	test.describe.configure({ mode: 'serial' });
	test.afterEach(async ({ vscode }) => {
		await vscode.gitlens.resetUI();
	});

	test('should show WeGit community views', async ({ vscode }) => {
		await vscode.gitlens.showWeGitView();

		// Click continue if present (it might be the welcome view)
		// exact: true avoids strict mode violation when multiple buttons match 'Continue'
		const continueButton = vscode.page.getByRole('button', { name: 'Continue', exact: true });
		if (await continueButton.isVisible()) {
			await continueButton.click();
		}

		// Check if WeGit section is visible (grouped view)
		// .last() ensures we target the correct section when multiple /^WeGit/ sections are present
		const weGitSection = vscode.gitlens.sidebar.getSection(/^WeGit/).last();
		await expect(weGitSection).toBeVisible({ timeout: MaxTimeout });

		if ((await weGitSection.getAttribute('aria-expanded')) === 'false') {
			await weGitSection.click();
		}

		const weGitPane = vscode.gitlens.sidebar.getSectionBody(/^WeGit/).last();
		const weGitToolbar = weGitPane.getByRole('toolbar', { name: /WeGit actions/i });
		const weGitTree = weGitPane.getByRole('tree', { name: /^WeGit$/i });
		const groupedViews = [
			/提交|Commits/i,
			/分支|Branches/i,
			/储藏|Stashes/i,
			/远程|Remotes/i,
			/标签|Tags/i,
			/贡献者|Contributors/i,
		] as const;

		for (const viewButton of groupedViews) {
			await expect(weGitToolbar.getByRole('button', { name: viewButton }).first()).toBeVisible({
				timeout: MaxTimeout,
			});
		}

		await expect(weGitTree.getByRole('treeitem').first()).toBeVisible({ timeout: MaxTimeout });
	});
});

test.describe('Smoke Tests — WeGit Inspect views', () => {
	test.describe.configure({ mode: 'serial' });
	test.beforeEach(async ({ vscode }) => {
		// open the test file (created in setup)
		await vscode.gitlens.openFile('test-file.txt');
	});
	test.afterEach(async ({ vscode }) => {
		await vscode.gitlens.resetUI();
	});

	test('should show WeGit Inspect views when clicking WeGit Inspect icon', async ({ vscode }) => {
		// open inspect
		await vscode.gitlens.openWeGitInspect();
		await expect(vscode.gitlens.inspectViewSection).toBeVisible({ timeout: MaxTimeout });

		const inspectWebview = await vscode.gitlens.inspectViewWebview;
		if (inspectWebview == null) {
			throw new Error('Inspect webview did not open');
		}

		// Verify the Inspect webview has loaded with the commit details app
		await expect(inspectWebview.locator('gl-commit-details-app')).toBeVisible({ timeout: MaxTimeout });
	});

	test('should show File History view', async ({ vscode }) => {
		// open the file history view
		await vscode.gitlens.showFileHistoryView();
		await expect(vscode.gitlens.fileHistoryViewSection).toBeVisible({ timeout: MaxTimeout });
		await expect(vscode.gitlens.fileHistoryViewTreeView).toBeVisible({ timeout: MaxTimeout });
		await expect(vscode.gitlens.fileHistoryViewTreeView.getByRole('treeitem').first()).toBeVisible({
			timeout: MaxTimeout,
		});
	});

	test('should show Line History view', async ({ vscode }) => {
		// open the line history view
		await vscode.gitlens.showLineHistoryView();
		await expect(vscode.gitlens.lineHistoryViewSection).toBeVisible({ timeout: MaxTimeout });
		await expect(vscode.gitlens.lineHistoryViewTreeView).toBeVisible({ timeout: MaxTimeout });
		await expect(vscode.gitlens.lineHistoryViewTreeView.getByRole('treeitem').first()).toBeVisible({
			timeout: MaxTimeout,
		});
	});

	test('should show Search & Compare view', async ({ vscode }) => {
		// open the search & compare view
		await vscode.gitlens.showSearchAndCompareView();
		await expect(vscode.page.getByRole('button', { name: /Search Commits|搜索提交/i })).toBeVisible({
			timeout: MaxTimeout,
		});
		await expect(vscode.page.getByRole('button', { name: /Compare References|比较引用/i })).toBeVisible({
			timeout: MaxTimeout,
		});
	});
});
