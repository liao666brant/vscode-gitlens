import { consume } from '@lit/context';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { SubscriptionState } from '../../../../../constants.subscription.js';
import type { BranchAndTargetRefs, BranchRef } from '../../../../shared/branchRefs.js';
import type { OverviewBranch, OverviewBranchMergeTarget } from '../../../../shared/overviewBranches.js';
import { renderBranchName } from '../../../shared/components/branch-name.js';
import { elementBase, linkBase, scrollableBase } from '../../../shared/components/styles/lit/base.css.js';
import type { WebviewContext } from '../../../shared/contexts/webview.js';
import { webviewContext } from '../../../shared/contexts/webview.js';
import { chipStyles } from './chipStyles.js';
import './feature-gate-plus-state.js';
import '../../../shared/components/button.js';
import '../../../shared/components/button-container.js';
import '../../../shared/components/code-icon.js';
import '../../../shared/components/overlays/popover.js';
import '../../../shared/components/overlays/tooltip.js';
import '../../../shared/components/ref-button.js';

type MergeTargetPromise = Promise<OverviewBranchMergeTarget | undefined> | undefined;

const mergeTargetStyles = css`
	.header__actions {
		margin-top: 0.4rem;
		margin-left: auto;
	}

	.content {
		gap: 0.6rem;
	}

	:host-context(.vscode-dark),
	:host-context(.vscode-high-contrast) {
		--color-status--in-sync: #00bb00;
		--color-merge--clean: #00bb00;
		--color-merge--conflict: var(--vscode-gitlens-decorations\\.statusMergingOrRebasingForegroundColor);
	}

	:host-context(.vscode-light),
	:host-context(.vscode-high-contrast-light) {
		--color-status--in-sync: #00aa00;
		--color-merge--clean: #00aa00;
		--color-merge--conflict: var(--vscode-gitlens-decorations\\.statusMergingOrRebasingForegroundColor);
	}

	.header__title > span {
		cursor: help;
	}

	.header__title code-icon:not(.info) {
		margin-bottom: 0.1rem;
	}

	.header__title code-icon.status--warning {
		color: var(--vscode-gitlens-decorations\\.statusMergingOrRebasingForegroundColor);
	}

	.header__title p {
		margin: 0.5rem 0 0 0;
	}

	.header__subtitle {
		font-size: 1.3rem;
		margin: 0.2rem 0 0 0;
	}

	.status--conflict .icon,
	.status--conflict .status-indicator {
		color: var(--vscode-gitlens-decorations\\.statusMergingOrRebasingForegroundColor);
	}

	.status--behind .icon,
	.status--behind .status-indicator {
		color: var(--vscode-gitlens-decorations\\.statusMergingOrRebasingForegroundColor);
	}

	.status--merged .icon,
	.status--merged .status-indicator {
		color: var(--vscode-gitlens-mergedPullRequestIconColor);
	}

	.status--merged .icon {
		transform: rotateY(180deg);
	}

	.status--in-sync .status-indicator {
		color: var(--color-status--in-sync);
	}

	.status--loading {
		cursor: default;
		color: var(--color-foreground--50);
	}

	.status--merge-conflict {
		color: var(--color-merge--conflict);
	}

	.status--merge-clean {
		color: var(--color-merge--clean);
	}

	.status--merge-unknown {
		color: var(--color-foreground--50);
	}

	.status--upgrade {
		color: var(--color-foreground--50);
	}

	.status-indicator {
		margin-left: -0.5rem;
		margin-top: 0.8rem;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		width: 100%;
	}

	.button-container {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		margin-top: 0.4rem;
		margin-bottom: 0.4rem;
		align-items: center;
		justify-content: center;
		width: 100%;
	}

	.button-container gl-button {
		max-width: 30rem;
	}

	p {
		margin: 0 0.4rem;
	}

	p code-icon,
	gl-button code-icon {
		margin-bottom: 0.1rem;
	}

	details {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0;
		position: relative;
		margin: 0 0.2rem 0.4rem;
		overflow: hidden;
		border: 1px solid transparent;
		color: var(--color-foreground--85);
	}

	details[open] {
		border-radius: 0.3rem;
		border: 1px solid var(--vscode-sideBar-border);
	}

	summary {
		position: sticky;
		top: 0;
		color: var(--color-foreground);
		cursor: pointer;
		list-style: none;
		transition: transform ease-in-out 0.1s;
		padding: 0.4rem 0.6rem 0.4rem 0.6rem;
		z-index: 1;
	}

	summary:hover {
		color: var(--vscode-textLink-activeForeground);
	}

	details[open] > summary {
		color: var(--vscode-textLink-foreground);
		border-radius: 0.3rem 0.3rem 0 0;
		margin-left: 0;
		background: var(--vscode-sideBar-background);
	}

	details[open] > summary code-icon {
		transform: rotate(90deg);
	}

	summary code-icon {
		transition: transform 0.2s;
	}

	.files {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;

		max-height: 8rem;
		overflow-y: auto;
		padding: 0.4rem 0.8rem;

		background: var(--vscode-sideBar-background);
	}

	gl-popover {
		--max-width: 60rem;
	}

	.target-edit * {
		text-decoration: underline dotted;
		text-underline-offset: 0.3rem;
	}

	.target-edit gl-branch-name {
		margin: 0;
	}
`;

function formatCommitCount(count: number) {
	return `${count} 个提交`;
}

function formatFileCount(count: number) {
	return `${count} 个文件`;
}

function getBranchOrWorktreeLabel(isWorktree: boolean) {
	return isWorktree ? '工作树' : '分支';
}

@customElement('gl-merge-target-status')
export class GlMergeTargetStatus extends LitElement {
	static override shadowRootOptions: ShadowRootInit = {
		...LitElement.shadowRootOptions,
		delegatesFocus: true,
	};

	static override styles = [elementBase, linkBase, chipStyles, scrollableBase, mergeTargetStyles];

	@consume({ context: webviewContext })
	private _webview!: WebviewContext;

	@property({ type: Object })
	branch!: Pick<OverviewBranch, 'repoPath' | 'id' | 'name' | 'opened' | 'upstream' | 'worktree'>;

	@property({ type: Boolean, reflect: true })
	loading = false;

	@state()
	private _target: Awaited<MergeTargetPromise>;
	get target(): Awaited<MergeTargetPromise> {
		return this._target;
	}

	private _targetPromise: MergeTargetPromise;
	get targetPromise(): MergeTargetPromise {
		return this._targetPromise;
	}
	@property({ type: Object })
	set targetPromise(value: MergeTargetPromise) {
		if (this._targetPromise === value) return;

		this._targetPromise = value;
		if (value == null) {
			this._target = undefined;
			return;
		}

		void value.then(
			r => {
				if (this._targetPromise === value) {
					this._target = r;
				}
			},
			() => {
				if (this._targetPromise === value) {
					this._target = undefined;
				}
			},
		);
	}

	private get conflictResult() {
		return this.target?.potentialConflicts;
	}

	private get conflicts() {
		const result = this.conflictResult;
		return result?.status === 'conflicts' ? result.conflict : undefined;
	}

	private get conflictError() {
		const result = this.conflictResult;
		return result?.status === 'error' ? result : undefined;
	}

	private get mergedStatus() {
		return this.target?.mergedStatus;
	}

	private get status() {
		return this.target?.status;
	}

	private get branchRef(): BranchRef | undefined {
		if (this.branch == null) return undefined;

		return {
			repoPath: this.branch.repoPath,
			branchId: this.branch.id,
			branchName: this.branch.name,
			worktree: this.branch.worktree
				? { name: this.branch.worktree.name, isDefault: this.branch.worktree.isDefault }
				: undefined,
		};
	}

	private get targetBranchRef(): BranchRef | undefined {
		if (this.target == null) return undefined;

		return {
			repoPath: this.target.repoPath,
			branchId: this.target.id,
			branchName: this.target.name,
		};
	}

	override render(): unknown {
		if (!this.status && !this.conflicts) {
			if (this.loading) {
				return html`<gl-tooltip content="Checking merge target status…">
					<span class="chip status--loading" aria-busy="true">
						<code-icon class="icon" icon="gl-merge-target" size="18"></code-icon>
						<code-icon class="status-indicator" icon="sync" size="12"></code-icon>
					</span>
				</gl-tooltip>`;
			}
			return nothing;
		}

		let icon;
		let status;

		if (this.mergedStatus?.merged) {
			icon = 'git-merge';
			status = 'merged';
		} else if (this.conflicts) {
			icon = 'warning';
			status = 'conflict';
		} else if ((this.status?.behind ?? 0) > 0) {
			icon = 'arrow-down';
			status = 'behind';
		} else {
			icon = 'check';
			status = 'in-sync';
		}

		return html`<gl-popover placement="bottom" trigger="hover click focus" hoist>
			<span slot="anchor" class="chip status--${status}" tabindex="0" aria-label="合并目标状态"
				><code-icon class="icon" icon="gl-merge-target" size="18"></code-icon
				><code-icon class="status-indicator icon--${status}" icon="${icon}" size="12"></code-icon>
			</span>
			<div slot="content" class="content">${this.renderContent()}</div>
		</gl-popover>`;
	}

	private renderContent() {
		const target = renderBranchName(this.target?.name);

		const mergeTargetRef =
			this.mergedStatus?.merged && this.mergedStatus.localBranchOnly
				? {
						repoPath: this.branch.repoPath,
						branchId: this.mergedStatus.localBranchOnly.id!,
						branchName: this.mergedStatus.localBranchOnly.name,
						branchUpstreamName: this.mergedStatus.localBranchOnly.upstream?.name,
					}
				: this.target
					? {
							repoPath: this.target.repoPath,
							branchId: this.target.id,
							branchName: this.target.name,
							branchUpstreamName: undefined,
						}
					: undefined;

		if (this.mergedStatus?.merged) {
			if (this.mergedStatus.localBranchOnly) {
				return html`${this.renderHeader(
						`${this.mergedStatus.confidence !== 'highest' ? '分支可能已' : '分支已'}在本地合并到合并目标`,
						'git-merge',
					)}
					<div class="body">
						<p>
							你当前的分支 ${renderBranchName(this.branch.name)} 已
							${this.mergedStatus.confidence !== 'highest' ? '可能' : ''}合并到其合并目标的本地分支
							${renderBranchName(this.mergedStatus.localBranchOnly.name)}。
						</p>
						<div class="button-container">
							<gl-button
								full
								href="${this._webview.createCommandLink<BranchRef>(
									'gitlens.pushBranch:',
									mergeTargetRef,
								)}"
								><span
									>推送 ${renderBranchName(this.mergedStatus.localBranchOnly.name)}</span
								></gl-button
							>
							<gl-button
								full
								appearance="secondary"
								href="${this._webview.createCommandLink<[BranchRef, BranchRef]>(
									'gitlens.deleteBranchOrWorktree:',
									[this.branchRef!, mergeTargetRef!],
								)}"
								><span
									>删除
									${getBranchOrWorktreeLabel(
										this.branch.worktree != null && !this.branch.worktree.isDefault,
									)}
									${renderBranchName(this.branch.name, this.branch.worktree != null)}</span
								></gl-button
							>
						</div>
					</div>`;
			}

			return html`${this.renderHeader(
					`${this.mergedStatus.confidence !== 'highest' ? '分支可能已' : '分支已'}合并到合并目标`,
					'git-merge',
				)}
				<div class="body">
					<p>
						你当前的分支 ${renderBranchName(this.branch.name)} 已
						${this.mergedStatus.confidence !== 'highest' ? '可能' : ''}合并到其合并目标
						${this.renderInlineTargetEdit(this.target)}。
					</p>
					<div class="button-container">
						<gl-button
							full
							href="${this._webview.createCommandLink<[BranchRef, BranchRef]>(
								'gitlens.deleteBranchOrWorktree:',
								[this.branchRef!, mergeTargetRef!],
							)}"
							><span
								>删除
								${getBranchOrWorktreeLabel(
									this.branch.worktree != null && !this.branch.worktree.isDefault,
								)}
								${renderBranchName(this.branch.name, this.branch.worktree != null)}</span
							></gl-button
						>
					</div>
				</div>`;
		}

		if (this.conflicts) {
			return html`${this.renderHeader('与合并目标的潜在冲突', 'warning', 'warning')}
				<div class="body">
					${this.status
						? html`<p>
								你当前的分支 ${renderBranchName(this.branch.name)} 落后于其合并目标
								${this.renderInlineTargetEdit(this.target)} ${formatCommitCount(this.status.behind)}。
							</p>`
						: nothing}
					<div class="button-container">
						<gl-button
							full
							href="${this._webview.createCommandLink<BranchRef>(
								'gitlens.rebaseCurrentOnto:',
								this.targetBranchRef,
							)}"
							><span>将 ${renderBranchName(this.conflicts.branch)} 变基到 ${target}</span></gl-button
						>
						<gl-button
							full
							appearance="secondary"
							href="${this._webview.createCommandLink<BranchRef>(
								'gitlens.mergeIntoCurrent:',
								this.targetBranchRef,
							)}"
							><span>将 ${target} 合并到 ${renderBranchName(this.conflicts.branch)}</span></gl-button
						>
					</div>
					<p class="status--merge-conflict">
						<code-icon icon="warning"></code-icon> 合并将导致
						${formatFileCount(this.conflicts.files.length)}出现冲突，需要你手动解决。
					</p>
					${this.renderFiles(this.conflicts.files)}
				</div>`;
		}

		if (this.status != null) {
			if (this.status.behind > 0) {
				return html`${this.renderHeader(
						`落后合并目标 ${formatCommitCount(this.status.behind)}`,
						'arrow-down',
						'warning',
					)}
					<div class="body">
						<p>
							你当前的分支 ${renderBranchName(this.branch.name)} 落后于其合并目标
							${this.renderInlineTargetEdit(this.target)} ${formatCommitCount(this.status.behind)}。
						</p>
						<div class="button-container">
							<gl-button
								full
								href="${this._webview.createCommandLink<BranchRef>(
									'gitlens.rebaseCurrentOnto:',
									this.targetBranchRef,
								)}"
								><span>将 ${renderBranchName(this.branch.name)} 变基到 ${target}</span></gl-button
							>
							<gl-button
								full
								appearance="secondary"
								href="${this._webview.createCommandLink<BranchRef>(
									'gitlens.mergeIntoCurrent:',
									this.targetBranchRef,
								)}"
								><span>将 ${target} 合并到 ${renderBranchName(this.branch.name)}</span></gl-button
							>
						</div>
						${this.conflictError
							? html`<p class="status--merge-unknown">
									<code-icon icon="error"></code-icon> 无法检测冲突。
								</p>`
							: html`<p class="status--merge-clean">
									<code-icon icon="check"></code-icon> 合并不会产生冲突。
								</p>`}
					</div>`;
			}

			return html`${this.renderHeader('与合并目标保持同步', 'check')}
				<div class="body">
					<p>
						你当前的分支 ${renderBranchName(this.branch.name)} 已与其合并目标
						${this.renderInlineTargetEdit(this.target)} 保持同步。
					</p>
				</div>`;
		}

		return nothing;
	}

	private renderHeader(title: string, icon: string, status?: string) {
		return html`<div class="header">
			<gl-tooltip class="header__title">
				<span>
					<code-icon
						icon="${icon}"
						class="${ifDefined(status ? `status--${status}` : undefined)}"
					></code-icon>
					${title}&nbsp;<code-icon class="info" icon="question" size="16"></code-icon>
				</span>
				<span slot="content"
					>${title}
					<p>“合并目标”是 ${renderBranchName(this.branch.name)} 最有可能合并到的分支。</p>
				</span>
			</gl-tooltip>
			${this.renderHeaderActions()}
		</div>`;
	}

	private renderHeaderActions() {
		const branchRef = this.branchRef;
		const targetRef = this.targetBranchRef;

		return html`<span class="header__actions"
			>${branchRef && targetRef
				? html`<gl-button
							href="${this._webview.createCommandLink<BranchAndTargetRefs>(
								'gitlens.git.branch.setMergeTarget:',
								{
									...branchRef,
									mergeTargetId: targetRef.branchId,
									mergeTargetName: targetRef.branchName,
								},
							)}"
							appearance="toolbar"
							aria-label="更改合并目标"
							><code-icon icon="pencil"></code-icon
							><span slot="tooltip"
								>更改合并目标<br />${renderBranchName(this.target?.name)}</span
							></gl-button
						><gl-button
							href="${this._webview.createCommandLink<BranchAndTargetRefs>(
								'gitlens.openMergeTargetComparison:',
								{
									...branchRef,
									mergeTargetId: targetRef.branchId,
									mergeTargetName: targetRef.branchName,
								},
							)}"
							appearance="toolbar"
							aria-label="比较分支与合并目标"
							@click=${(e: MouseEvent) => this.onCompareClick(e, targetRef.branchName)}
							><code-icon icon="git-compare"></code-icon>
							<span slot="tooltip"
								>比较分支与合并目标<br />${renderBranchName(this.branch.name)}
								<code-icon icon="arrow-both" size="12"></code-icon> ${renderBranchName(
									this.target?.name,
								)}</span
							>
						</gl-button>`
				: nothing}<gl-button
				href="${this._webview.createCommandLink<BranchRef>('gitlens.fetch:', this.targetBranchRef)}"
				appearance="toolbar"
				aria-label="抓取合并目标"
				><code-icon icon="repo-fetch"></code-icon>
				<span slot="tooltip">抓取合并目标<br />${renderBranchName(this.target?.name)}</span>
			</gl-button></span
		>`;
	}

	private onCompareClick(e: MouseEvent, targetBranchName: string) {
		// The merge target is the BASE of the comparison ("what I'm measuring my changes against"),
		// so it goes into `leftRef` per the compare-panel convention (leftRef = Base / older,
		// rightRef = Compare / newer / current branch). The graph compare workflow seeds rightRef
		// from the active WIP/commit selection, so dispatching only leftRef here leaves the
		// selection-derived Compare side intact rather than clobbering it.
		const event = new CustomEvent('compare-with-merge-target', {
			detail: { leftRef: targetBranchName, leftRefType: 'branch' },
			bubbles: true,
			composed: true,
			cancelable: true,
		});
		this.dispatchEvent(event);

		if (event.defaultPrevented) {
			e.preventDefault();
		}
	}

	private renderInlineTargetEdit(target: Awaited<MergeTargetPromise>) {
		return html`<gl-button
			class="target-edit"
			appearance="toolbar"
			density="compact"
			tooltip="更改合并目标"
			href="${this._webview.createCommandLink<BranchAndTargetRefs>('gitlens.git.branch.setMergeTarget:', {
				...this.branchRef!,
				mergeTargetId: this.targetBranchRef!.branchId,
				mergeTargetName: this.targetBranchRef!.branchName,
			})}"
			>${renderBranchName(target?.name)}</gl-button
		>`;
	}

	private renderFiles(files: { path: string }[]) {
		return html`
			<details>
				<summary>
					<code-icon icon="chevron-right"></code-icon>
					显示 ${files.length} 个冲突文件
				</summary>
				<div class="files scrollable">${files.map(file => this.renderFile(file.path))}</div>
			</details>
		`;
	}

	private renderFile(path: string) {
		return html`<span class="files__item"><code-icon icon="file"></code-icon> ${path}</span>`;
	}
}

@customElement('gl-merge-target-upgrade')
export class GlMergeTargetUpgrade extends LitElement {
	static override shadowRootOptions: ShadowRootInit = {
		...LitElement.shadowRootOptions,
		delegatesFocus: true,
	};

	static override styles = [
		elementBase,
		linkBase,
		chipStyles,
		scrollableBase,
		mergeTargetStyles,
		css`
			gl-feature-gate-plus-state {
				display: block;
				margin-inline: 0.5rem;

				p {
					margin-block: 1rem;
					margin-inline: 0;
				}
			}
		`,
	];

	@property({ attribute: false, type: Number })
	state?: SubscriptionState;

	override render(): unknown {
		const icon = 'warning';
		const status = 'upgrade';

		return html`<gl-popover placement="bottom" trigger="hover click focus" hoist>
			<span slot="anchor" class="chip status--${status}" tabindex="0" aria-label="合并目标状态（需要升级）"
				><code-icon class="icon" icon="gl-merge-target" size="18"></code-icon
				><code-icon class="status-indicator icon--${status}" icon="${icon}" size="12"></code-icon>
			</span>
			<gl-feature-gate-plus-state
				slot="content"
				appearance="default"
				featureRestriction="all"
				.source=${{ source: 'home', detail: 'marge-target' } as const}
				.state=${this.state}
			>
				<div slot="feature">
					<span class="header__title">检测潜在合并冲突</span>

					<p>查看当前分支与其合并目标分支何时存在潜在冲突，并及时采取操作解决它们。</p>
				</div>
			</gl-feature-gate-plus-state>
		</gl-popover>`;
	}
}
