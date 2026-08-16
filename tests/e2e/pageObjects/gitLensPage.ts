import type { FrameLocator, Locator, Page } from '@playwright/test';
import { MaxTimeout, ShortTimeout } from '../baseTest.js';
import type { VSCodeEvaluator } from '../fixtures/vscodeEvaluator.js';
import { VSCodePage } from './vscodePage.js';

/**
 * Page object for WeGit-specific UI interactions.
 * Extends VSCodePage with WeGit views, commands, and components.
 */
export class WeGitPage extends VSCodePage {
	/** Evaluator for VS Code Extension API access (VSCodePage keeps its handle private) */
	private readonly evaluator: VSCodeEvaluator['evaluate'];

	constructor(page: Page, evaluate: VSCodeEvaluator['evaluate']) {
		super(page, evaluate);
		this.evaluator = evaluate;
	}

	// ============================================================================
	// Custom Editors (identified by their stable viewType via the VS Code API)
	// ============================================================================

	/**
	 * Wait for a WeGit custom editor (identified by its stable `viewType`, e.g.
	 * `gitlens.rebase`) to be open. Verified via the VS Code Extension API
	 * (`TabInputCustom.viewType`), so it doesn't depend on the localized tab title.
	 *
	 * @returns true when an editor with the viewType is open; false if it didn't open in time
	 */
	async waitForCustomEditorOpen(viewType: string, timeout = MaxTimeout): Promise<boolean> {
		return this.waitForCustomEditorState(viewType, true, timeout);
	}

	/**
	 * Wait for a WeGit custom editor (identified by its stable `viewType`) to be closed.
	 *
	 * @returns true when no editor with the viewType is open; false if it didn't close in time
	 */
	async waitForCustomEditorClosed(viewType: string, timeout = MaxTimeout): Promise<boolean> {
		return this.waitForCustomEditorState(viewType, false, timeout);
	}

	private async waitForCustomEditorState(viewType: string, open: boolean, timeout: number): Promise<boolean> {
		return this.evaluator(
			async (vscode, viewType, open, timeout) => {
				const startTime = Date.now();
				while (Date.now() - startTime < timeout) {
					const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
					const found = tabs.some(
						tab => tab.input instanceof vscode.TabInputCustom && tab.input.viewType === viewType,
					);
					if (found === open) return true;

					await new Promise(resolve => setTimeout(resolve, 250));
				}
				return false;
			},
			viewType,
			open,
			timeout,
		);
	}

	/**
	 * Get the current (possibly localized) tab label of an open WeGit custom editor,
	 * resolved via the VS Code API by its stable `viewType`. Returns undefined if no
	 * such editor is open.
	 */
	private async getCustomEditorTabLabel(viewType: string): Promise<string | undefined> {
		return this.evaluator((vscode, viewType) => {
			const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
			const tab = tabs.find(t => t.input instanceof vscode.TabInputCustom && t.input.viewType === viewType);
			return tab?.label;
		}, viewType);
	}
	/**
	 * Get the count of WeGit-related tabs in the activity bar.
	 * Only WeGit Inspect remains as its own tab (WeGit's main views are grouped
	 * in the built-in Source Control container), so this is expected to be 1.
	 */
	async getActivityBarTabCount(): Promise<number> {
		// Activity bar container tabs render asynchronously after extension activation,
		// so poll briefly for the first WeGit tab to appear before giving up.
		const startTime = Date.now();
		let count = await this.activityBar.countTabs(/WeGit/);
		while (count === 0 && Date.now() - startTime < MaxTimeout) {
			await this.page.waitForTimeout(ShortTimeout);
			count = await this.activityBar.countTabs(/WeGit/);
		}
		return count;
	}

	/**
	 * Open the WeGit Inspect sidebar.
	 * Only clicks the tab if it's not already active (to avoid closing it).
	 */
	async openWeGitInspect(): Promise<void> {
		await this.sidebar.open();
		await this.activityBar.openTab(/WeGit (Inspect|检查)/, false);
	}

	// ============================================================================
	// WeGit Sidebar Views
	// ============================================================================

	/** Inspect section in WeGit Inspect sidebar */
	get inspectViewSection(): Locator {
		return this.sidebar.getSection(/^(Inspect|检查)/);
	}

	/** Inspect webview in WeGit Inspect sidebar */
	get inspectViewWebview(): Promise<FrameLocator | null> {
		return this.getWeGitWebview('Inspect', 'webviewView').then(
			webview => webview ?? this.getWeGitWebview('检查', 'webviewView'),
		);
	}

	/** Line History section in WeGit Inspect sidebar */
	get lineHistoryViewSection(): Locator {
		return this.sidebar.getSection(/^(Line History|行历史)/i);
	}

	/** Line History tree in WeGit Inspect sidebar */
	get lineHistoryViewTreeView(): Locator {
		return this.sidebar.getTree(/^(Line History|行历史)/i);
	}

	async showLineHistoryView(): Promise<void> {
		await this.executeCommand('gitlens.showLineHistoryView');
	}

	/** File History section in WeGit Inspect sidebar */
	get fileHistoryViewSection(): Locator {
		return this.sidebar.getSection(/^(File History|文件历史)/i);
	}

	/** File History tree in WeGit Inspect sidebar */
	get fileHistoryViewTreeView(): Locator {
		return this.sidebar.getTree(/^(File History|文件历史)/i);
	}

	async showFileHistoryView(): Promise<void> {
		await this.executeCommand('gitlens.showFileHistoryView');
	}

	/** Search & Compare section in WeGit Inspect sidebar */
	get searchCompareViewSection(): Locator {
		return this.sidebar.getSection(/^(Search & Compare|搜索与比较)/i);
	}

	/** Search & Compare tree in WeGit Inspect sidebar */
	get searchCompareViewTreeView(): Locator {
		return this.sidebar.getTree(/^(Search & Compare|搜索与比较)/i);
	}

	async showSearchAndCompareView(): Promise<void> {
		await this.executeCommand('gitlens.showSearchAndCompareView');
	}

	// ============================================================================
	// WeGit View/WebviewView Commands
	// ============================================================================

	/**
	 * Show the WeGit sidebar view.
	 * The WeGit (SCM grouped) view is contributed to the built-in Source Control
	 * container, so focus that container with the built-in command.
	 */
	async showWeGitView(): Promise<void> {
		await this.executeCommand('workbench.view.scm');
	}

	get gitlensViewSection(): Locator {
		return this.sidebar.getSection(/WeGit/i);
	}

	get gitlensViewTreeView(): Locator {
		return this.sidebar.getTree(/WeGit/i);
	}

	async showCommitsView(): Promise<void> {
		await this.executeCommand('gitlens.showCommitsView');
	}

	async showBranchesView(): Promise<void> {
		await this.executeCommand('gitlens.showBranchesView');
	}

	async showRemotesView(): Promise<void> {
		await this.executeCommand('gitlens.showRemotesView');
	}

	async showStashesView(): Promise<void> {
		await this.executeCommand('gitlens.showStashesView');
	}

	async showTagsView(): Promise<void> {
		await this.executeCommand('gitlens.showTagsView');
	}

	async showContributorsView(): Promise<void> {
		await this.executeCommand('gitlens.showContributorsView');
	}

	// ============================================================================
	// WeGit Webviews
	// ============================================================================

	// ============================================================================
	// Blame Annotations
	// ============================================================================

	/**
	 * Toggle file blame annotations on the active editor.
	 */
	async toggleFileBlame(): Promise<void> {
		await this.executeCommand('gitlens.toggleFileBlame');
	}

	/**
	 * Check if blame annotations are currently visible in the active editor.
	 *
	 * VS Code renders WeGit gutter blame decorations as CSS `::before`
	 * pseudo-elements on `<span>` elements within `.view-lines`. The decoration
	 * class names contain the `ced-` prefix (content editor decoration).
	 *
	 * @param expectedText — Text to search for in `::before` content (e.g. commit message or date pattern)
	 */
	async hasBlameAnnotations(expectedText: string): Promise<boolean> {
		return this.page.evaluate((pattern: string) => {
			// Blame decorations live on <span> elements inside .view-lines with ced-* classes
			const candidates = document.querySelectorAll('.monaco-editor .view-lines span[class*="ced-"]');
			for (const el of candidates) {
				const content = window.getComputedStyle(el, '::before').getPropertyValue('content');
				if (content && content !== 'none' && content !== '""') {
					const text = content.replace(/^"|"$/g, '');
					if (text.includes(pattern)) return true;
				}
			}
			return false;
		}, expectedText);
	}

	// ============================================================================
	// Webviews
	// ============================================================================

	/**
	 * Get the rebase editor's webview frame, identified by its stable `gitlens.rebase`
	 * viewType. The runtime (localized) tab label is resolved via the VS Code API and
	 * the iframe is matched by that label, so no hardcoded title is needed.
	 * The branch suffix (e.g. " (main)") is stripped so the existing prefix matching
	 * in getWeGitWebview covers both titled and suffix-less frames.
	 * The label is re-read each pass because the webview title (and thus tab label)
	 * is set asynchronously after the editor tab appears.
	 */
	async getRebaseWebview(timeout = MaxTimeout / 2): Promise<FrameLocator | null> {
		const startTime = Date.now();
		while (Date.now() - startTime < timeout) {
			const label = await this.getCustomEditorTabLabel('gitlens.rebase');
			if (label != null) {
				const baseTitle = label.split(' (')[0];
				// Short attempt so the label gets re-read as the webview title settles
				const frame = await this.getWeGitWebview(baseTitle, 'customEditor', ShortTimeout * 4);
				if (frame != null) return frame;
			}

			await this.page.waitForTimeout(ShortTimeout);
		}
		return null;
	}

	/**
	 * Get a webview frame locator within a specific parent.
	 * This avoids needing to know specific content inside the webview.
	 *
	 * @param parent - The parent locator to search within
	 * @param timeout - Timeout in ms
	 * @returns A FrameLocator for the webview content, or null if not found
	 */
	async getWebview(parent: Locator, timeout = MaxTimeout / 2): Promise<FrameLocator | null> {
		const startTime = Date.now();
		while (Date.now() - startTime < timeout) {
			const iframes = parent.locator('iframe');
			const count = await iframes.count();

			for (let i = 0; i < count; i++) {
				try {
					const outerFrame = iframes.nth(i).contentFrame();
					const activeFrame = outerFrame.locator('iframe#active-frame');
					if ((await activeFrame.count()) > 0) {
						return activeFrame.contentFrame();
					}
				} catch {
					continue;
				}
			}
			await this.page.waitForTimeout(ShortTimeout);
		}
		return null;
	}

	/**
	 * Find a WeGit webview by its title.
	 * VS Code renders webviews outside their logical containers, so we search all webviews
	 * and identify the correct one by:
	 * 1. The outer iframe src containing extensionId=liao666brant.wegit and purpose=webviewView/webviewPanel
	 * 2. The inner iframe#active-frame having the specified title attribute
	 *
	 * @param title - The title of the webview (e.g., "Graph", "Graph Details", "Welcome")
	 * @param purpose - The purpose of the webview (e.g., "webviewView", "webviewPanel")
	 * @param timeout - Timeout in ms
	 * @returns A FrameLocator for the matching webview content, or null if not found
	 */
	async getWeGitWebview(
		title: string,
		purpose: 'webviewView' | 'webviewPanel' | 'customEditor',
		timeout = MaxTimeout / 2,
	): Promise<FrameLocator | null> {
		let iterations = 0;
		let usePurpose = true;

		const startTime = Date.now();
		while (Date.now() - startTime < timeout) {
			// Find WeGit webview iframes
			const iframes = this.page.locator(
				usePurpose && purpose === 'webviewView'
					? `iframe.webview[src*="extensionId=liao666brant.wegit"][src*="purpose=${purpose}"]`
					: `iframe.webview[src*="extensionId=liao666brant.wegit"]`,
			);

			iterations++;
			const count = await iframes.count();
			if (count !== 0) {
				for (let i = 0; i < count; i++) {
					try {
						const outerFrame = iframes.nth(i).contentFrame();
						// CSS title*= is a substring match, so do a precise check on the actual
						// title attribute to avoid false positives (e.g. "Graph" matching both
						// "Commit Graph" and "Commit Graph Inspect")
						const activeFrame = outerFrame.locator(`iframe#active-frame[title*="${title}"]`);
						if ((await activeFrame.count()) > 0) {
							const actualTitle = await activeFrame.getAttribute('title');
							// Accept exact match or title with branch suffix, e.g. "交互式变基 (main)"
							if (
								actualTitle != null &&
								(actualTitle === title ||
									actualTitle.startsWith(`${title} (`) ||
									actualTitle.startsWith(`${title},`))
							) {
								return activeFrame.contentFrame();
							}
							// Substring matched but title doesn't match precisely — skip
							continue;
						}
					} catch {
						continue;
					}
				}
			} else if (purpose === 'webviewView') {
				// There is a VS Code issue where sometimes WebviewViews don't always get their purpose set (seems to happen after hiding and re-showing)
				// So alternate using purpose filter every other iteration (use it on odd iterations: 1, 3, 5...)
				usePurpose = iterations % 2 === 1;
				continue;
			}
			await this.page.waitForTimeout(ShortTimeout);
		}
		return null;
	}
}
