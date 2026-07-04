import type { TemplateResult } from 'lit';
import { css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PullRequestShape } from '@gitlens/git/models/pullRequest.js';
import { uncommitted } from '@gitlens/git/models/revision.js';
import { canStageCurrent, canStageIncoming } from '@gitlens/git/utils/conflictResolution.utils.js';
import { isConflictStatus } from '@gitlens/git/utils/fileStatus.utils.js';
import { serializeWebviewItemContext } from '../../../../system/webview.js';
import type { DetailsItemTypedContext, Wip } from '../../../commitDetails/protocol.js';
import { buildFolderContext } from '../../../commitDetails/protocol.js';
import type { TreeItemAction, TreeItemBase, TreeItemCheckedDetail } from '../../shared/components/tree/base.js';
import { detailsBaseStyles } from './gl-details-base.css.js';
import type { File } from './gl-details-base.js';
import { GlDetailsBase } from './gl-details-base.js';
import { detailsWipPanelStyles } from './gl-details-wip-panel.css.js';
import '../../shared/components/button.js';
import '../../shared/components/button-container.js';
import '../../shared/components/branch-name.js';
import '../../shared/components/code-icon.js';
import '../../shared/components/panes/pane-group.js';
import '../../shared/components/avatar/avatar.js';
import '../../shared/components/chips/action-chip.js';
import '../../shared/components/commit/commit-stats.js';
import '../../shared/components/pills/tracking.js';
import '../../shared/components/tree/gl-wip-tree-pane.js';

// Stable references for the inline tree-item actions so each render reuses the same objects
// instead of allocating fresh ones per file. Lit's array diffing in gl-tree-item is identity-
// based, so reusing these also avoids spurious re-renders downstream.
// `single`: conflict-specific diffs (current/incoming side) only make sense for the clicked conflicted
// row — fanning them out to non-conflicted selected files would open wrong/empty content.
const openCurrentChangesAction: TreeItemAction = {
	icon: 'gl-diff-left',
	label: '打开当前更改',
	action: 'file-open-current',
	multiBehavior: 'single',
};
const openIncomingChangesAction: TreeItemAction = {
	icon: 'gl-diff-right',
	label: '打开传入更改',
	action: 'file-open-incoming',
	multiBehavior: 'single',
};
const stageConflictAction: TreeItemAction = {
	icon: 'add',
	label: '暂存',
	action: 'file-stage',
	multiBehavior: 'batch',
};
// `batch`: an inline stage/unstage on a multi-selection fires ONE event carrying the whole set
// (detail.files) so the host runs a single atomic `git add`/`git reset` — N concurrent single-file
// ops would collide on the index lock and leave some files behind.
const stageAction: TreeItemAction = {
	icon: 'plus',
	label: '暂存更改',
	action: 'file-stage',
	multiBehavior: 'batch',
};
const unstageAction: TreeItemAction = {
	icon: 'remove',
	label: '取消暂存更改',
	action: 'file-unstage',
	multiBehavior: 'batch',
};
// `batch`: discarding an inline button on a multi-selection fires ONE `file-discard` carrying the
// whole set (detail.files) so the host shows a single combined confirm, not one per file.
const discardAction: TreeItemAction = {
	icon: 'discard',
	label: '放弃更改...',
	action: 'file-discard',
	multiBehavior: 'batch',
};
// Mixed rows (both staged + unstaged) discard only the unstaged portion on the first click — the
// staged content survives until a second discard. Same `file-discard` action (the host detects
// mixed and applies the partial semantics); only the label differs so it matches that behavior and
// the bulk toolbar button.
const discardUnstagedAction: TreeItemAction = {
	icon: 'discard',
	label: '放弃未暂存更改...',
	action: 'file-discard',
	multiBehavior: 'batch',
};
const openFileAction: TreeItemAction = { icon: 'go-to-file', label: '打开文件', action: 'file-open' };
// `file-compare-wip-staged` is bridged by gl-wip-tree-pane into `file-compare-wip` with
// `staged: true` overridden so the diff resolves to staged ↔ HEAD even though the deduped
// row carries `staged: false` (preferred-unstaged precedence from the tree pane dedup).
// `single`: a specific "staged side" diff for the clicked mixed row; fanning it out to selected files
// without staged changes would open an empty/wrong diff.
const openStagedChangesAction: TreeItemAction = {
	icon: 'diff-single',
	label: '打开已暂存更改',
	action: 'file-compare-wip-staged',
	multiBehavior: 'single',
};
const stashAction: TreeItemAction = {
	icon: 'gl-stash-save',
	label: '存储更改...',
	action: 'file-stash',
	multiBehavior: 'batch',
};

const conflictedCheckboxActions: TreeItemAction[] = [
	openFileAction,
	openCurrentChangesAction,
	openIncomingChangesAction,
];
const conflictedActions: TreeItemAction[] = [...conflictedCheckboxActions, stageConflictAction];
const checkboxDiscardOnly: TreeItemAction[] = [openFileAction, stashAction, discardAction];
const checkboxMixedActions: TreeItemAction[] = [
	openFileAction,
	openStagedChangesAction,
	stashAction,
	discardUnstagedAction,
];
const stagedActions: TreeItemAction[] = [openFileAction, unstageAction, stashAction, discardAction];
const unstagedActions: TreeItemAction[] = [openFileAction, stageAction, stashAction, discardAction];

@customElement('gl-details-wip-panel')
export class GlDetailsWipPanel extends GlDetailsBase {
	static override styles = [
		...detailsBaseStyles,
		detailsWipPanelStyles,
		css`
			:host {
				--gl-avatar-size: 1.6rem;
			}
		`,
	];

	@property({ type: Object })
	wip?: Wip;

	@property({ type: Object })
	pullRequest?: PullRequestShape;

	@property({ type: String, attribute: 'worktree-path' })
	worktreePath?: string;

	@property({ type: Boolean, attribute: 'checkbox-mode' })
	checkboxMode = false;

	/** Opt-in for the bulk "Stage Current/Incoming for All Conflicts" toolbar buttons.
	 * Set true only by hosts that wire the `resolve-all-current/incoming` events AND can
	 * vouch that bulk resolve is supported (currently graph WIP + paused rebase). */
	@property({ type: Boolean, attribute: 'bulk-conflict-actions' })
	bulkConflictActions = false;

	get isUnpublished(): boolean {
		const branch = this.wip?.branch;
		return branch?.upstream == null || branch.upstream.missing === true;
	}

	get filesCount(): number {
		return this.files?.length ?? 0;
	}

	get branchState() {
		const branch = this.wip?.branch;
		if (branch == null) return undefined;

		return {
			ahead: branch.tracking?.ahead ?? 0,
			behind: branch.tracking?.behind ?? 0,
		};
	}

	protected override renderChangedFilesSlottedContent(): TemplateResult<1> | typeof nothing {
		if (this.variant === 'embedded' || !this.files?.length) return nothing;

		return html`<div slot="before-tree" class="section section--actions">
			<button-container>
				<gl-button full appearance="secondary" href="command:workbench.view.scm" tooltip="Commit via SCM"
					><code-icon rotate="45" icon="arrow-up"></code-icon
				></gl-button>
			</button-container>
		</div>`;
	}

	private renderPrimaryAction() {
		if (this.isUnpublished) {
			return html`
				<gl-button full data-action="publish-branch" @click=${() => this.onDataActionClick('publish-branch')}>
					<code-icon icon="cloud-upload" slot="prefix"></code-icon>Publish Branch<span slot="tooltip"
						>Publish (push) <strong>${this.wip?.branch?.name}</strong> to
						${this.wip?.branch?.upstream?.name ?? 'a remote'}</span
					>
				</gl-button>
			`;
		}

		if (this.branchState == null) return undefined;

		const { ahead, behind } = this.branchState;
		if (ahead === 0 && behind === 0) return undefined;

		const fetchLabel = behind > 0 ? 'Pull' : ahead > 0 ? 'Push' : 'Fetch';
		const fetchIcon = behind > 0 ? 'repo-pull' : ahead > 0 ? 'repo-push' : 'repo-fetch';
		const fetchTooltip = behind > 0 ? 'Pull from' : ahead > 0 ? 'Push to' : 'Fetch from';

		return html`
			<gl-button
				full
				data-action="${fetchLabel.toLowerCase()}"
				@click=${() => this.onDataActionClick(fetchLabel.toLowerCase())}
			>
				<code-icon icon="${fetchIcon}" slot="prefix"></code-icon> ${fetchLabel}
				<gl-tracking-pill .ahead=${ahead} .behind=${behind} slot="suffix"></gl-tracking-pill>
				<span slot="tooltip">${fetchTooltip} <strong>${this.wip?.branch?.upstream?.name}</strong></span>
			</gl-button>
		`;
	}

	private renderActions() {
		const primaryAction = this.renderPrimaryAction();
		if (primaryAction == null) return nothing;

		return html`<div class="section section--actions">
			<button-container>${primaryAction}</button-container>
		</div>`;
	}

	private renderPullRequest() {
		if (this.pullRequest == null) return nothing;

		return html`
			<webview-pane
				collapsable
				flexible
				?expanded=${this.preferences?.pullRequestExpanded ?? true}
				data-region="pullrequest-pane"
			>
				<span slot="title">Pull Request #${this.pullRequest?.id}</span>
				<action-nav slot="actions">
					<gl-action-chip
						label="Open Pull Request Changes"
						icon="diff-multiple"
						@click=${() => this.onDataActionClick('open-pr-changes')}
					></gl-action-chip>
					<gl-action-chip
						label="Compare Pull Request"
						icon="compare-changes"
						@click=${() => this.onDataActionClick('open-pr-compare')}
					></gl-action-chip>
					<gl-action-chip
						label="Open Pull Request on Remote"
						icon="globe"
						@click=${() => this.onDataActionClick('open-pr-remote')}
					></gl-action-chip>
				</action-nav>
				<div class="section">
					<issue-pull-request
						type="pr"
						name="${this.pullRequest.title}"
						url="${this.pullRequest.url}"
						identifier="#${this.pullRequest.id}"
						status="${this.pullRequest.state}"
						.date=${this.pullRequest.updatedDate}
						.dateFormat="${this.preferences?.dateFormat}"
						.dateStyle="${this.preferences?.dateStyle}"
						details
					></issue-pull-request>
				</div>
			</webview-pane>
		`;
	}

	private renderIncomingOutgoing() {
		if (this.branchState == null || (this.branchState.ahead === 0 && this.branchState.behind === 0)) return nothing;

		return html`
			<webview-pane collapsable>
				<span slot="title">Incoming / Outgoing</span>
				<gl-tree>
					<gl-tree-item branch .expanded=${false}>
						<code-icon slot="icon" icon="arrow-circle-down"></code-icon>
						Incoming Changes
						<span slot="decorations">${this.branchState.behind ?? 0}</span>
					</gl-tree-item>
					<gl-tree-item branch .expanded=${false}>
						<code-icon slot="icon" icon="arrow-circle-up"></code-icon>
						Outgoing Changes
						<span slot="decorations">${this.branchState.ahead ?? 0}</span>
					</gl-tree-item>
				</gl-tree>
			</webview-pane>
		`;
	}

	override render(): unknown {
		if (this.wip == null) return nothing;

		if (this.variant === 'embedded') {
			return this.renderEmbedded();
		}

		const hasFiles = (this.files?.length ?? 0) > 0;
		if (!hasFiles) {
			return html`
				${this.renderActions()} ${this.renderPausedOpStatus()}
				<gl-details-wip-empty-pane
					.wip=${this.wip}
					.pullRequest=${this.pullRequest}
					@publish-branch=${() => this.onDataActionClick('publish-branch')}
					@pull=${() => this.onDataActionClick('pull')}
					@push=${() => this.onDataActionClick('push')}
					@create-pr=${() => this.onDataActionClick('create-pr')}
					@start-work=${() => this.onDataActionClick('start-work')}
					@switch-branch=${() => this.onDataActionClick('switch')}
					@create-branch=${() => this.onDataActionClick('create-branch')}
					@apply-stash=${() => this.onDataActionClick('apply-stash')}
					@new-worktree=${() => this.onDataActionClick('new-worktree')}
				></gl-details-wip-empty-pane>
			`;
		}

		return html`
			${this.renderActions()} ${this.renderPausedOpStatus()}
			<webview-pane-group flexible>
				${this.renderPullRequest()} ${this.renderChangedFiles('wip')}
			</webview-pane-group>
		`;
	}

	private renderPausedOpStatus() {
		const pausedOpStatus = this.wip?.changes?.pausedOpStatus;
		if (pausedOpStatus == null) return nothing;

		return html`<div class="paused-op">
			<gl-merge-rebase-status
				?conflicts=${this.wip?.changes?.hasConflicts ?? false}
				.pausedOpStatus=${pausedOpStatus}
			></gl-merge-rebase-status>
		</div>`;
	}

	private renderEmbedded() {
		if (this.checkboxMode) {
			return html`<div class="files">
				<webview-pane-group flexible> ${this.renderChangedFiles('wip')} </webview-pane-group>
			</div>`;
		}
		return html`
			${this.renderEmbeddedHeader()}
			<div class="files">
				<webview-pane-group flexible> ${this.renderChangedFiles('wip')} </webview-pane-group>
			</div>
		`;
	}

	override renderChangedFiles(_mode: 'wip'): TemplateResult<1> {
		return html`
			<gl-wip-tree-pane
				.files=${this.files}
				.preferences=${this.preferences}
				.collapsable=${this.filesCollapsable}
				?show-file-icons=${this.fileIcons}
				?checkable=${this.checkboxMode}
				?multi-selectable=${true}
				?bulk-conflict-actions=${this.bulkConflictActions}
				.showSearchBox=${this.showSearchBox}
				.searchBoxFilter=${this.searchBoxFilter}
				.fileActions=${this._getFileActions}
				.fileContext=${this._getFileContext}
				.folderContext=${this._getFolderContext}
				.searchContext=${this.searchContext}
				.multiDiff=${this.getMultiDiffRefs()}
				empty-text=${this.emptyText}
				@file-checked=${this._onFileChecked}
			>
				${this.renderChangedFilesSlottedContent()}
			</gl-wip-tree-pane>
		`;
	}

	private getMultiDiffRefs():
		| { repoPath: string; lhs: string; rhs: string; wip?: boolean; title?: string }
		| undefined {
		const repoPath = this.wip?.repo?.path ?? this.files?.find(f => f.repoPath)?.repoPath;
		if (!repoPath) return undefined;

		// `wip: true` forces the host to per-file HEAD↔index↔working semantics regardless of
		// `lhs`/`rhs`. The OpenMultipleChangesArgs routing switched from `rhs === ''` to an
		// explicit `wip` flag, so the WIP details panel must set it here.
		return { repoPath: repoPath, lhs: 'HEAD', rhs: '', wip: true, title: '工作区更改' };
	}

	// Coalesces the selection-aware checkbox fan-out — gl-file-tree-pane dispatches one synchronous
	// `file-checked` per selected file — into a single stage/unstage, so the host runs ONE atomic
	// `git add`/`git reset` instead of N concurrent ops that collide on `.git/index.lock` and leave
	// some files behind. Flushed on a microtask, after the synchronous fan-out has drained.
	private _checkedBatch?: { checked: boolean; repoPath: string; files: File[] };

	protected override onFileChecked(e: CustomEvent<TreeItemCheckedDetail>): void {
		if (!e.detail.context) return;

		const [file] = e.detail.context as unknown as File[];
		const repoPath = file.repoPath ?? this.wip?.repo?.path;
		if (!repoPath) return;

		// Start a new batch when none is pending or the action flips (check vs uncheck); the fan-out
		// applies a single action across the whole selection, so a batch is action-homogeneous.
		if (this._checkedBatch?.checked !== e.detail.checked) {
			this._checkedBatch = { checked: e.detail.checked, repoPath: repoPath, files: [] };
			queueMicrotask(() => this.flushCheckedBatch());
		}
		this._checkedBatch.files.push(file);
	}

	private flushCheckedBatch(): void {
		const batch = this._checkedBatch;
		this._checkedBatch = undefined;
		if (batch == null) return;
		if (!batch.files.length) return;

		const [first] = batch.files;
		const detail = {
			path: first.path,
			repoPath: batch.repoPath,
			status: first.status,
			staged: first.staged,
			// >1 → carry the whole set so the host stages/unstages them in one atomic op.
			files: batch.files.length > 1 ? batch.files : undefined,
		};

		this.dispatchEvent(
			new CustomEvent(batch.checked ? 'file-stage' : 'file-unstage', {
				detail: detail,
			}),
		);
	}

	private renderEmbeddedHeader() {
		const wip = this.wip;
		if (!wip) return nothing;

		const branchName = wip.branch?.name;
		const filesCount = this.filesCount;
		const stagedCount = this.files?.filter(f => f.staged)?.length ?? 0;
		const unstagedCount = filesCount - stagedCount;

		return html`<div class="header">
			<div class="header__identity">
				<code-icon class="header__wip-icon" icon="diff"></code-icon>
				<div class="header__identity-left">
					<span class="header__wip-title">工作区更改</span>
					<span class="header__wip-subtitle">
						${this.worktreePath
							? html`<code-icon icon="folder"></code-icon> ${this.worktreePath}`
							: html`${stagedCount > 0 || unstagedCount > 0
									? `${stagedCount} 已暂存 · ${unstagedCount} 未暂存`
									: '无更改'}`}
					</span>
				</div>
				<div class="header__identity-right">
					<div class="header__actions">
						<gl-action-chip
							icon="close"
							label="关闭"
							overlay="tooltip"
							@click=${() =>
								this.dispatchEvent(new CustomEvent('close-details', { bubbles: true, composed: true }))}
						></gl-action-chip>
					</div>
				</div>
			</div>
			<div class="header__branch-row">
				${branchName
					? html`<gl-branch-name
							class="header__branch-pill"
							appearance="pill"
							.name=${branchName}
						></gl-branch-name>`
					: nothing}
				${filesCount > 0
					? html`<commit-stats modified="${filesCount}" symbol="icons" appearance="pill"></commit-stats>`
					: nothing}
			</div>
			${this.renderPausedOpStatus()}
		</div>`;
	}

	override getFileActions(file: File, options?: Partial<TreeItemBase>): TreeItemAction[] {
		// Conflicted files get rebase-editor-style "Open Current/Incoming Changes". In non-checkbox
		// mode we also surface Stage — checkbox mode hides it because the row's checkbox already
		// performs staging. Stage routes through the existing `file-stage` event, which prompts
		// when unresolved conflict markers remain.
		if (isConflictStatus(file.status)) {
			return this.checkboxMode ? conflictedCheckboxActions : conflictedActions;
		}

		if (this.checkboxMode) {
			// Mixed (deduped) gets an extra "Open Staged Changes" view button alongside Discard.
			return options?.mixed ? checkboxMixedActions : checkboxDiscardOnly;
		}

		// Non-checkbox mode never sees `options.mixed === true` because gl-wip-tree-pane only
		// computes `mixedPaths` under `if (this.checkable)`. Each row of a mixed file appears in
		// its own staged/unstaged group and gets the natural Stage/Unstage button.
		return file.staged === true ? stagedActions : unstagedActions;
	}

	override getFolderContext(folder: { relativePath: string }): string | undefined {
		return buildFolderContext(this.wip?.repo?.path, folder);
	}

	override getFileContext(file: File): string | undefined {
		if (!this.wip?.repo?.path) return undefined;

		// Two-char `XY` conflict statuses (UU/AA/UD/DU/AU/UA/DD) carry the side semantics
		// the stage-current/incoming commands need; the generic single-char 'U' from
		// `isConflictStatus` doesn't, so we treat it as a regular unstaged file and skip
		// the conflict modifiers. Without this guard, the host's runStageConflictResolution
		// would silently no-op on 'U' files clicked through the new context-menu items.
		let webviewItem: string;
		if (isConflictStatus(file.status) && file.status !== 'U') {
			const conflictStatus = file.status;
			const modifiers: string[] = ['+conflict'];
			if (canStageCurrent(conflictStatus)) {
				modifiers.push('+canStageCurrent');
			}
			if (canStageIncoming(conflictStatus)) {
				modifiers.push('+canStageIncoming');
			}
			webviewItem = `gitlens:file${modifiers.join('')}`;
		} else {
			webviewItem = file.staged ? 'gitlens:file+staged' : 'gitlens:file+unstaged';
		}

		const context: DetailsItemTypedContext = {
			webviewItem: webviewItem,
			webviewItemValue: {
				type: 'file',
				path: file.path,
				repoPath: this.wip.repo.path,
				sha: uncommitted,
				staged: file.staged,
				status: file.status,
			},
		};

		return serializeWebviewItemContext(context);
	}

	private onDataActionClick(name: string) {
		void this.dispatchEvent(new CustomEvent('data-action', { detail: { name: name } }));
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'gl-details-wip-panel': GlDetailsWipPanel;
	}
}
