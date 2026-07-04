import type { FrameLocator, Locator } from '@playwright/test';
import { MaxTimeout, ShortTimeout } from '../baseTest.js';
import { VSCodePage } from './vscodePage.js';

/**
 * Page object for WeGit-specific UI interactions.
 * Extends VSCodePage with WeGit views, commands, and components.
 */
export class WeGitPage extends VSCodePage {
	async isActivated(): Promise<boolean> {
		return this.gitlensTab.isVisible();
	}

	/**
	 * Get the count of WeGit-related tabs in the activity bar
	 * Should be 2: WeGit and WeGit Inspect
	 */
	async getActivityBarTabCount(): Promise<number> {
		return this.activityBar.countTabs(/WeGit/);
	}

	/**
	 * Wait for WeGit extension to fully activate
	 * This is indicated by the WeGit activity bar icon becoming visible
	 */
	async waitForActivation(timeout = MaxTimeout): Promise<void> {
		await this.gitlensTab.waitFor({ state: 'visible', timeout: timeout });
	}

	/** The WeGit activity bar tab */
	get gitlensTab(): Locator {
		return this.activityBar.getTab('WeGit', true);
	}

	/** The WeGit Inspect activity bar tab */
	get gitlensInspectTab(): Locator {
		return this.activityBar.getTab(/WeGit (Inspect|检查)/, false);
	}

	/**
	 * Open the WeGit sidebar and ensure it's visible.
	 * Handles the case where the sidebar may be hidden.
	 * Only clicks the tab if it's not already active (to avoid closing it).
	 */
	async openWeGitSidebar(): Promise<void> {
		await this.sidebar.open();
		await this.activityBar.openTab('WeGit', true);
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
	// WeGit Panel Views (Bottom Panel)
	// ============================================================================

	/** WeGit tab in the bottom panel */
	get gitlensPanel(): Locator {
		return this.panel.getTab('WeGit', true);
	}

	/** Commit Graph view section in the panel (matched via its panel toolbar) */
	get commitGraphViewSection(): Locator {
		// When the Commit Graph view is open, its panel toolbar is labelled
		// "WeGit: Commit Graph: <repo> actions" and stays visible in both the gated (Community)
		// and loaded (Pro) states. Match that toolbar by accessible name — the panel title <h2>
		// itself is sr-hidden, and a bare "Graph" text match resolved to the hidden generic
		// "WeGit: Graph" header.
		return this.panel.locator.getByRole('toolbar', { name: /Commit Graph/ }).first();
	}

	/** Commit Graph webview in the panel */
	get commitGraphViewWebview(): Promise<FrameLocator | null> {
		return this.getWeGitWebview('Graph', 'webviewView');
	}

	async showCommitGraphView(): Promise<void> {
		await this.executeCommand('gitlens.showGraphView');
	}

	/** Commit Graph Details tab in the panel */
	get commitGraphDetailsViewSection(): Locator {
		return this.panel.getTab(/^Graph Details$/i, false);
	}

	/** Commit Graph Details webview in the panel */
	get commitGraphDetailsViewWebview(): Promise<FrameLocator | null> {
		return this.getWeGitWebview('Graph Details', 'webviewView');
	}

	// ============================================================================
	// WeGit View/WebviewView Commands
	// ============================================================================

	async showWeGitView(): Promise<void> {
		await this.executeCommand('gitlens.views.scm.grouped.focus');
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

	async showWorktreesView(): Promise<void> {
		await this.executeCommand('gitlens.showWorktreesView');
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

	async getRebaseWebview(): Promise<FrameLocator | null> {
		return this.getWeGitWebview('Interactive Rebase', 'customEditor');
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
							// Accept exact match or title with branch suffix, e.g. "Interactive Rebase (main)"
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
