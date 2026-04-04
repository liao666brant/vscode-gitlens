import { consume } from '@lit/context';
import { SignalWatcher } from '@lit-labs/signals';
import type { TemplateResult } from 'lit';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { isSubscriptionTrialOrPaidFromState } from '../../../../../plus/gk/utils/subscription.utils.js';
import type { AssociateIssueWithBranchCommandArgs } from '../../../../../plus/startWork/associateIssueWithBranch.js';
import { createCommandLink } from '../../../../../system/commands.js';
import type {
	GetActiveOverviewResponse,
	GetOverviewBranch,
	OpenInGraphParams,
	OpenInTimelineParams,
	State,
} from '../../../../home/protocol.js';
import { ExecuteCommand } from '../../../../protocol.js';
import { stateContext } from '../../../home/context.js';
import type { RepoButtonGroupClickEvent } from '../../../shared/components/repo-button-group.js';
import { ipcContext } from '../../../shared/contexts/ipc.js';
import type { WebviewContext } from '../../../shared/contexts/webview.js';
import { webviewContext } from '../../../shared/contexts/webview.js';
import { linkStyles, ruleStyles } from '../../shared/components/vscode.css.js';
import { branchCardStyles, GlBranchCardBase } from './branch-card.js';
import type { ActiveOverviewState } from './overviewState.js';
import { activeOverviewStateContext } from './overviewState.js';
import '../../../shared/components/breadcrumbs.js';
import '../../../shared/components/button.js';
import '../../../shared/components/code-icon.js';
import '../../../shared/components/skeleton-loader.js';
import '../../../shared/components/card/card.js';
import '../../../shared/components/commit/commit-stats.js';
import '../../../shared/components/menu/menu-divider.js';
import '../../../shared/components/menu/menu-item.js';
import '../../../shared/components/menu/menu-label.js';
import '../../../shared/components/overlays/popover.js';
import '../../../shared/components/pills/tracking.js';
import '../../../shared/components/ref-button.js';
import '../../../shared/components/repo-button-group.js';
import '../../../shared/components/rich/issue-icon.js';
import '../../../shared/components/rich/pr-icon.js';
import '../../shared/components/merge-rebase-status.js';

export const activeWorkTagName = 'gl-active-work';

@customElement(activeWorkTagName)
export class GlActiveWork extends SignalWatcher(LitElement) {
	static override styles = [
		linkStyles,
		branchCardStyles,
		ruleStyles,
		css`
			[hidden] {
				display: none;
			}

			:host {
				display: block;
				margin-bottom: 2.4rem;
				color: var(--vscode-foreground);
			}

			gl-repo-button-group {
				text-transform: none;
			}

			gl-section::part(header) {
				margin-block-end: 0.2rem;
			}

			.section-heading-actions {
				flex: none;
				display: flex;
				align-items: center;
			}

			.section-heading-action {
				--button-padding: 0.2rem;
				--button-line-height: 1.2rem;
				/* margin-block: -1rem; */
			}

			.section-heading-provider {
				color: inherit;
			}

			.tooltip {
				text-transform: none;
			}

			.uppercase {
				text-transform: uppercase;
			}

			gl-breadcrumbs {
				--gl-tooltip-text-transform: none;
			}

			.heading-branch-breadcrumb {
				text-transform: none;
			}
		`,
	];

	@consume({ context: activeOverviewStateContext })
	private _activeOverviewState!: ActiveOverviewState;

	@consume<State>({ context: stateContext, subscribe: true })
	@state()
	private _homeState!: State;

	@consume({ context: ipcContext })
	private _ipc!: typeof ipcContext.__context__;

	@consume({ context: webviewContext })
	private _webview!: WebviewContext;

	@state()
	private repoCollapsed = true;

	get isPro() {
		return isSubscriptionTrialOrPaidFromState(this._homeState.subscription.state);
	}

	override connectedCallback(): void {
		super.connectedCallback?.();

		if (this._homeState.repositories.openCount > 0) {
			this._activeOverviewState.run();
		}
	}

	private onBranchSelectorClicked() {
		this._ipc.sendCommand(ExecuteCommand, {
			command: 'gitlens.switchToBranch:home',
			args: [{ repoPath: this._activeOverviewState.state?.active.repoPath }],
		});
	}

	override render(): unknown {
		if (this._homeState.discovering) {
			return this.renderLoader();
		}

		if (this._homeState.repositories.openCount === 0) {
			return nothing;
		}

		return this._activeOverviewState.render({
			pending: () => this.renderPending(),
			complete: overview => this.renderComplete(overview),
			error: () => html`<span>错误</span>`,
		});
	}

	private renderLoader() {
		return html`
			<gl-section>
				<skeleton-loader slot="heading" lines="1"></skeleton-loader>
				<skeleton-loader lines="3"></skeleton-loader>
			</gl-section>
		`;
	}

	private renderPending() {
		if (this._activeOverviewState.state == null) {
			return this.renderLoader();
		}
		return this.renderComplete(this._activeOverviewState.state, true);
	}

	private renderComplete(overview: GetActiveOverviewResponse, isFetching = false) {
		const repo = overview?.repository;
		const activeBranch = overview?.active;
		if (!repo || !activeBranch) return html`<span>无</span>`;
		const hasMultipleRepositories = this._homeState.repositories.openCount > 1;

		return html`
			<gl-section ?loading=${isFetching}>
				<gl-breadcrumbs slot="heading">
					<gl-breadcrumb-item collapsibleState="none" class="heading-repo-breadcrumb"
						><gl-repo-button-group
							.repository=${repo}
							?disabled=${!hasMultipleRepositories}
							?hasMultipleRepositories=${hasMultipleRepositories}
							.source=${{ source: 'graph' } as const}
							?expandable=${true}
							@gl-click=${this.onRepositorySelectorClicked}
							><span slot="tooltip">
								切换到其他仓库...
								<hr />
								${repo.name}
							</span></gl-repo-button-group
						></gl-breadcrumb-item
					>
					<gl-breadcrumb-item collapsibleState="none" icon="git-branch" class="heading-branch-breadcrumb"
						><gl-ref-button .ref=${activeBranch.reference} @click=${this.onBranchSelectorClicked}
							><span slot="tooltip">切换到其他分支... </span></gl-ref-button
						></gl-breadcrumb-item
					>
				</gl-breadcrumbs>
				<span class="section-heading-actions" slot="heading-actions">
					<gl-button
						aria-busy="${ifDefined(isFetching)}"
						?disabled=${isFetching}
						class="section-heading-action"
						appearance="toolbar"
						tooltip="抓取全部"
						aria-label="抓取全部"
						href=${this._webview.createCommandLink('gitlens.fetch:')}
						><code-icon icon="repo-fetch"></code-icon
					></gl-button>
					<gl-button
						aria-busy="${ifDefined(isFetching)}"
						?disabled=${isFetching}
						class="section-heading-action"
						appearance="toolbar"
						tooltip="可视化仓库历史"
						aria-label="可视化仓库历史"
						href=${this._webview.createCommandLink<OpenInTimelineParams>('gitlens.visualizeHistory.repo:', {
							type: 'repo',
							repoPath: this._activeOverviewState.state!.repository.path,
						})}
						><code-icon icon="graph-scatter"></code-icon></gl-button
					><gl-button
						aria-busy="${ifDefined(isFetching)}"
						?disabled=${isFetching}
						class="section-heading-action"
						appearance="toolbar"
						tooltip="在提交图中打开"
						aria-label="在提交图中打开"
						href=${this._webview.createCommandLink<OpenInGraphParams>('gitlens.showInCommitGraph:', {
							type: 'repo',
							repoPath: this._activeOverviewState.state!.repository.path,
						})}
						><code-icon icon="gl-graph"></code-icon
					></gl-button>
				</span>
				${this.renderRepoBranchCard(activeBranch, repo.path, isFetching)}
			</gl-section>
		`;
	}

	private renderRepoBranchCard(branch: GetOverviewBranch, repo: string, isFetching: boolean) {
		return html`<gl-active-branch-card
			.branch=${branch}
			.repo=${repo}
			?busy=${isFetching}
			?showUpgrade=${!this.isPro}
		></gl-active-branch-card>`;
	}

	private onRepositorySelectorClicked(e: CustomEvent<RepoButtonGroupClickEvent>) {
		if (e.detail.part === 'label') {
			this._activeOverviewState.changeRepository();
		}
	}
}

declare global {
	interface HTMLElementTagNameMap {
		[activeWorkTagName]: GlActiveWork;
	}
}

@customElement('gl-active-branch-card')
export class GlActiveBranchCard extends GlBranchCardBase {
	static override styles = [
		linkStyles,
		branchCardStyles,
		css`
			:host {
				display: flex;
				flex-direction: column;
				gap: 0.8rem;
			}

			span.branch-item__missing {
				color: var(--vscode-descriptionForeground);
				font-style: italic;
			}

			gl-work-item {
				--gl-card-vertical-padding: 0.4rem;
			}

			.associate-issue-action {
				--button-padding: 0.2rem;
				--button-line-height: 1.2rem;
			}
		`,
	];

	override connectedCallback(): void {
		super.connectedCallback?.();

		this.toggleExpanded(true);
	}

	override render(): unknown {
		return html`
			${this.renderBranchIndicator()}${this.renderIssuesItem()}${this.renderBranchItem(
				html`${this.renderBranchStateActions()}${this.renderBranchActions()}`,
			)}${this.renderPrItem()}
		`;
	}

	private renderActionsMenu() {
		const aiEnabled = this._homeState.orgSettings.ai && this._homeState.aiEnabled;
		const isFetching = this.busy;
		const workingTreeState = this.wip?.workingTreeState;
		const hasWip =
			workingTreeState != null &&
			workingTreeState.added + workingTreeState.changed + workingTreeState.deleted > 0;

		const actions = [];
		if (aiEnabled) {
			if (hasWip) {
				actions.push(
					html`<menu-item
						?disabled=${isFetching}
						href=${createCommandLink('gitlens.ai.generateCommitMessage', {
							repoPath: this.repo,
							source: 'home',
						})}
						>生成提交消息</menu-item
					>`,
				);
				actions.push(html`<menu-divider></menu-divider>`);
				actions.push(
					html`<menu-item
						?disabled=${isFetching}
						href=${this.createWebviewCommandLinkWithBranchRef('gitlens.ai.explainWip:')}
						>解释工作区更改（预览）</menu-item
					>`,
				);
			}

			actions.push(
				html`<menu-item
					?disabled=${isFetching}
					href=${this.createWebviewCommandLinkWithBranchRef('gitlens.ai.explainBranch:')}
					>解释分支更改（预览）</menu-item
				>`,
			);

			if (hasWip) {
				actions.push(html`<menu-divider></menu-divider>`);
				actions.push(
					html`<menu-item
						?disabled=${isFetching}
						href=${this.createWebviewCommandLinkWithBranchRef('gitlens.createCloudPatch:')}
						>分享为云补丁</menu-item
					>`,
				);
			}
		} else if (hasWip) {
			return html`
				<gl-button
					aria-busy=${ifDefined(isFetching)}
					?disabled=${isFetching}
					href=${this.createWebviewCommandLinkWithBranchRef('gitlens.createCloudPatch:')}
					appearance="secondary"
					tooltip="分享为云补丁"
					aria-label="分享为云补丁"
					><code-icon icon="gl-cloud-patch-share"></code-icon>
				</gl-button>
			`;
		}

		if (actions.length === 0) return undefined;

		return html`<gl-popover
			appearance="menu"
			trigger="click focus"
			placement="bottom-end"
			.arrow=${false}
			distance="0"
		>
			<gl-button
				slot="anchor"
				appearance="toolbar"
				tooltipPlacement="top"
				tooltip="更多操作"
				aria-label="更多操作"
			>
				<code-icon icon="ellipsis"></code-icon>
			</gl-button>
			<div slot="content">${actions}</div>
		</gl-popover>`;
	}

	private renderBranchStateActions() {
		const { name, upstream } = this.branch;

		const actions: TemplateResult[] = [];

		const wrappedActions = () => {
			if (actions.length === 0) return this.renderActionsMenu();
			return html`<div><button-container>${actions}${this.renderActionsMenu()}</button-container></div>`;
		};

		const isFetching = this.busy;
		const workingTreeState = this.wip?.workingTreeState;
		const hasWip =
			workingTreeState != null &&
			workingTreeState.added + workingTreeState.changed + workingTreeState.deleted > 0;

		if (hasWip) {
			actions.push(html`
				<gl-button
					aria-busy=${ifDefined(isFetching)}
					?disabled=${isFetching}
					href=${this.createWebviewCommandLinkWithBranchRef('gitlens.composeCommits:')}
					appearance="secondary"
					density="compact"
					><code-icon icon="wand" slot="prefix"></code-icon>组合提交...<span slot="tooltip"
						><strong>组合提交</strong>（预览）<br /><i>自动或交互式地将更改整理为有意义的提交</i></span
					></gl-button
				>
			`);
		}

		if (this.wip?.pausedOpStatus != null) {
			return wrappedActions();
		}

		if (upstream?.missing !== false) {
			// TODO: Upstream will never exist here -- we need to look at remotes
			actions.push(html`
				<gl-button
					aria-busy=${ifDefined(isFetching)}
					?disabled=${isFetching}
					href=${this.createWebviewCommandLinkWithBranchRef('gitlens.publishBranch:')}
					appearance="secondary"
					density="compact"
				>
					<code-icon icon="cloud-upload" slot="${ifDefined(hasWip ? undefined : 'prefix')}"></code-icon>
					${hasWip ? '' : '发布分支'}
					<span slot="tooltip">发布（推送）<strong>${name}</strong> 到 ${upstream?.name ?? '某个远程'}</span>
				</gl-button>
			`);

			return wrappedActions();
		}

		if (upstream?.state?.ahead || upstream?.state?.behind) {
			const isAhead = Boolean(upstream.state.ahead);
			const isBehind = Boolean(upstream.state.behind);
			if (isAhead && isBehind) {
				actions.push(html`
					<gl-button
						aria-busy=${ifDefined(isFetching)}
						?disabled=${isFetching}
						href=${this._webview.createCommandLink('gitlens.pull:')}
						appearance="secondary"
						density="compact"
					>
						<code-icon icon="repo-pull" slot="${ifDefined(hasWip ? undefined : 'prefix')}"></code-icon>
						${hasWip ? '' : '拉取'}
						<gl-tracking-pill
							.ahead=${upstream.state.ahead}
							.behind=${upstream.state.behind}
							slot="suffix"
						></gl-tracking-pill>
						<span slot="tooltip"
							>拉取${upstream?.name ? html` 自 <strong>${upstream.name}</strong>` : ''}</span
						>
					</gl-button>
					<gl-button
						aria-busy=${ifDefined(isFetching)}
						?disabled=${isFetching}
						href=${this._webview.createCommandLink<{ force?: boolean }>('gitlens.push:', { force: true })}
						appearance="secondary"
						density="compact"
					>
						<code-icon icon="repo-force-push"></code-icon>
						<span slot="tooltip"
							>强制推送${upstream?.name ? html` 到 <strong>${upstream.name}</strong>` : ''}</span
						>
					</gl-button>
				`);

				return wrappedActions();
			}

			if (isBehind) {
				actions.push(html`
					<gl-button
						aria-busy=${ifDefined(isFetching)}
						?disabled=${isFetching}
						href=${this._webview.createCommandLink('gitlens.pull:')}
						appearance="secondary"
						density="compact"
					>
						<code-icon icon="repo-pull" slot="${ifDefined(hasWip ? undefined : 'prefix')}"></code-icon>
						${hasWip ? '' : '拉取'}
						<gl-tracking-pill
							.ahead=${upstream.state.ahead}
							.behind=${upstream.state.behind}
							slot="suffix"
						></gl-tracking-pill>
						<span slot="tooltip"
							>拉取${upstream?.name ? html` 自 <strong>${upstream.name}</strong>` : ''}</span
						>
					</gl-button>
				`);

				return wrappedActions();
			}

			if (isAhead) {
				actions.push(html`
					<gl-button
						aria-busy=${ifDefined(isFetching)}
						?disabled=${isFetching}
						href=${this._webview.createCommandLink('gitlens.push:')}
						appearance="secondary"
						density="compact"
					>
						<code-icon icon="repo-push" slot="prefix"></code-icon>
						${hasWip ? '' : '推送'}
						<gl-tracking-pill
							.ahead=${upstream.state.ahead}
							.behind=${upstream.state.behind}
							slot="suffix"
						></gl-tracking-pill>
						<span slot="tooltip"
							>推送${upstream?.name ? html` 到 <strong>${upstream.name}</strong>` : ''}</span
						>
					</gl-button>
				`);

				return wrappedActions();
			}
		}

		return wrappedActions();
	}

	protected renderBranchIndicator(): TemplateResult | undefined {
		const wip = this.wip;
		if (wip?.pausedOpStatus == null) return undefined;

		return html`<gl-merge-rebase-status
			?conflicts=${wip.hasConflicts}
			.pausedOpStatus=${wip.pausedOpStatus}
		></gl-merge-rebase-status>`;
	}

	protected getBranchActions(): TemplateResult[] {
		return [];
	}

	protected getPrActions(): TemplateResult[] {
		return [
			html`<action-item
				label="打开拉取请求更改"
				icon="request-changes"
				href=${this.createWebviewCommandLinkWithBranchRef('gitlens.openPullRequestChanges:')}
			></action-item>`,
			html`<action-item
				label="比较拉取请求"
				icon="git-compare"
				href=${this.createWebviewCommandLinkWithBranchRef('gitlens.openPullRequestComparison:')}
			></action-item>`,
			html`<action-item
				label="打开拉取请求详情"
				icon="eye"
				href=${this.createWebviewCommandLinkWithBranchRef('gitlens.openPullRequestDetails:')}
			></action-item>`,
		];
	}

	protected getCollapsedActions(): TemplateResult[] {
		return [];
	}

	protected override renderIssuesItem(): TemplateResult | NothingType {
		const issues = [...(this.issues ?? []), ...(this.autolinks ?? [])];
		if (!issues.length) {
			if (!this.expanded) return nothing;

			return html`<div class="branch-item__row" full>
				<span class="branch-item__missing" full>当前工作项</span>
				<gl-button
					class="associate-issue-action"
					appearance="toolbar"
					href=${createCommandLink<AssociateIssueWithBranchCommandArgs>('gitlens.associateIssueWithBranch', {
						command: 'associateIssueWithBranch',
						branch: this.branch.reference,
						source: 'home',
					})}
					tooltip="将问题与分支关联"
					aria-label="将问题与分支关联"
					><issue-icon></issue-icon>
				</gl-button>
			</div>`;
		}
		return super.renderIssuesItem();
	}
}

type NothingType = typeof nothing;
