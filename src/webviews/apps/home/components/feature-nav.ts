import { consume } from '@lit/context';
import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import type {
	ConnectCloudIntegrationsCommandArgs,
	ManageCloudIntegrationsCommandArgs,
} from '../../../../commands/cloudIntegrations.js';
import type { OpenWalkthroughCommandArgs } from '../../../../commands/walkthroughs.js';
import type { Source } from '../../../../constants.telemetry.js';
import { createCommandLink } from '../../../../system/commands.js';
import type { State } from '../../../home/protocol.js';
import { GlElement } from '../../shared/components/element.js';
import { linkBase } from '../../shared/components/styles/lit/base.css.js';
import { stateContext } from '../context.js';
import { homeBaseStyles, navListStyles } from '../home.css.js';
import '../../shared/components/code-icon.js';
import '../../shared/components/feature-badge.js';
import '../../shared/components/overlays/tooltip.js';

@customElement('gl-feature-nav')
export class GlFeatureNav extends GlElement {
	static override styles = [linkBase, homeBaseStyles, navListStyles, css``];

	@property({ type: Object })
	private badgeSource: Source = { source: 'home', detail: 'badge' };

	@consume<State>({ context: stateContext, subscribe: true })
	@state()
	private _state!: State;

	get orgAllowsDrafts(): boolean {
		return this._state.orgSettings.drafts;
	}

	private get blockRepoFeatures() {
		if (!this._state) return true;

		const {
			repositories: { openCount, hasUnsafe, trusted },
		} = this._state;
		return !trusted || openCount === 0 || hasUnsafe;
	}

	private onRepoFeatureClicked(e: MouseEvent) {
		if (this.blockRepoFeatures) {
			e.preventDefault();
			e.stopPropagation();
			return false;
		}

		return true;
	}

	override render(): unknown {
		return html`
			${when(
				this.blockRepoFeatures,
				() => html` <p><code-icon icon="question"></code-icon> 需要仓库的功能当前 不可用</p> `,
			)}
			<nav class="nav-list">
				<h2 class="nav-list__title t-eyebrow sticky">设置</h2>
				<div class="nav-list__item">
					<a class="nav-list__link" href="command:gitlens.showSettingsPage" aria-label="打开 GitLens 设置"
						><code-icon class="nav-list__icon" icon="gear"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="打开 GitLens 设置">
							<span>打开 GitLens 设置</span></gl-tooltip
						>
					</a>
				</div>
				${when(
					!this._state.hasAnyIntegrationConnected,
					() => html`
						<div class="nav-list__item" data-integrations="none">
							<a
								class="nav-list__link"
								href="${createCommandLink<ConnectCloudIntegrationsCommandArgs>(
									'gitlens.plus.cloudIntegrations.connect',
									{ source: { source: 'home', detail: 'old-home' } },
								)}"
								aria-label="在 GitKraken.dev 上连接集成"
								><code-icon class="nav-list__icon" icon="gl-unplug"></code-icon
								><gl-tooltip hoist class="nav-list__label" content="在 GitKraken.dev 上连接集成"
									><span>连接集成</span></gl-tooltip
								>
							</a>
						</div>
					`,
					() => html`
						<div class="nav-list__item" data-integrations="connected">
							<a
								class="nav-list__link"
								href="${createCommandLink<ManageCloudIntegrationsCommandArgs>(
									'gitlens.plus.cloudIntegrations.manage',
									{
										source: { source: 'home', detail: 'old-home' },
									},
								)}"
								aria-label="在 GitKraken.dev 上管理集成"
								><code-icon class="nav-list__icon" icon="settings"></code-icon
								><gl-tooltip hoist class="nav-list__label" content="在 GitKraken.dev 上管理集成"
									><span>管理集成</span></gl-tooltip
								>
							</a>
						</div>
					`,
				)}
				<div class="nav-list__item">
					<a
						class="nav-list__link"
						href="command:gitlens.showSettingsPage!autolinks"
						aria-label="打开自动链接设置"
						><code-icon class="nav-list__icon" icon="link"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="打开自动链接设置"
							><span>配置自动链接</span></gl-tooltip
						>
					</a>
				</div>
			</nav>
			<nav class="nav-list">
				<h2 class="nav-list__title t-eyebrow sticky">热门</h2>
				<div class="nav-list__item">
					<a
						class="nav-list__link${this.blockRepoFeatures ? ' is-disabled' : ''}"
						href="command:gitlens.showGraph"
						aria-label="显示提交图"
						data-requires="repo"
						@click=${(e: MouseEvent) => this.onRepoFeatureClicked(e)}
					>
						<code-icon class="nav-list__icon" icon="gl-graph"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="显示提交图">
							<span>提交图</span>
						</gl-tooltip>
					</a>
					<gl-feature-badge
						.source=${this.badgeSource}
						.subscription=${this._state.subscription}
						placement="left"
						class="nav-list__access"
					></gl-feature-badge>
				</div>
				<div class="nav-list__item">
					<a
						class="nav-list__link"
						href="command:gitlens.showLaunchpad?%7B%22source%22%3A%22home%22%7D"
						aria-label="打开启动台"
						><code-icon class="nav-list__icon" icon="rocket"></code-icon
						><gl-tooltip hoist class="nav-list__group" content="打开启动台"
							><span class="nav-list__label">启动台</span
							><span class="nav-list__desc">新!</span></gl-tooltip
						>
					</a>
					<gl-feature-badge
						.source=${this.badgeSource}
						.subscription=${this._state.subscription}
						placement="left"
						class="nav-list__access"
						cloud
					></gl-feature-badge>
				</div>
				<div class="nav-list__item">
					<a
						class="nav-list__link${this.blockRepoFeatures ? ' is-disabled' : ''}"
						href="command:gitlens.showCommitsView"
						aria-label="显示提交视图"
						data-requires="repo"
						><code-icon class="nav-list__icon" icon="gl-commits-view"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="显示提交视图">
							<span>提交</span></gl-tooltip
						>
					</a>
				</div>
				<div class="nav-list__item">
					<a
						class="nav-list__link${this.blockRepoFeatures ? ' is-disabled' : ''}"
						href="command:gitlens.showCommitDetailsView"
						aria-label="显示检查视图"
						data-requires="repo"
						><code-icon class="nav-list__icon" icon="gl-commit-view"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="显示检查视图">
							<span>检查</span></gl-tooltip
						>
					</a>
				</div>
				${when(
					this.orgAllowsDrafts,
					() => html`
						<div class="nav-list__item">
							${when(
								this._state.walkthroughSupported,
								() =>
									html` <a
										class="nav-list__link${this.blockRepoFeatures ? ' is-disabled' : ''}"
										href="${createCommandLink<OpenWalkthroughCommandArgs>(
											'gitlens.openWalkthrough',
											{
												step: 'accelerate-pr-reviews',
												source: { source: 'home', detail: 'old-home' },
											},
										)}"
										data-requires="repo"
										data-org-requires="drafts"
										aria-label="打开代码建议演练"
										><code-icon class="nav-list__icon" icon="gl-code-suggestion"></code-icon
										><gl-tooltip hoist class="nav-list__group" content="打开代码建议演练"
											><span class="nav-list__label">代码建议</span
											><span class="nav-list__desc">新!</span></gl-tooltip
										>
									</a>`,
							)}
							<gl-feature-badge
								.source=${this.badgeSource}
								.subscription=${this._state.subscription}
								placement="left"
								class="nav-list__access"
								cloud
								preview
							></gl-feature-badge>
						</div>
						<div class="nav-list__item">
							<a
								class="nav-list__link${this.blockRepoFeatures ? ' is-disabled' : ''}"
								href="command:gitlens.showDraftsView"
								data-requires="repo"
								data-org-requires="drafts"
								aria-label="显示云补丁视图"
								><code-icon class="nav-list__icon" icon="gl-cloud-patch"></code-icon
								><gl-tooltip hoist class="nav-list__group" content="显示云补丁视图"
									><span class="nav-list__label">云补丁</span
									><span class="nav-list__desc">新!</span></gl-tooltip
								>
							</a>
							<gl-feature-badge
								.source=${this.badgeSource}
								.subscription=${this._state.subscription}
								placement="left"
								class="nav-list__access"
								cloud
								preview
							></gl-feature-badge>
						</div>
					`,
				)}
				<div class="nav-list__item">
					<a
						class="nav-list__link${this.blockRepoFeatures ? ' is-disabled' : ''}"
						href="command:gitlens.showFileHistoryView"
						aria-label="显示文件历史视图"
						data-requires="repo"
						><code-icon class="nav-list__icon" icon="gl-history-view"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="显示文件历史视图">
							<span>文件历史</span></gl-tooltip
						>
					</a>
				</div>
				<div class="nav-list__item">
					<a
						class="nav-list__link${this.blockRepoFeatures ? ' is-disabled' : ''}"
						href="command:gitlens.showTimelineView"
						aria-label="显示可视化文件历史视图"
						data-requires="repo"
						><code-icon class="nav-list__icon" icon="graph-scatter"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="显示可视化文件历史视图">
							<span>可视化文件历史</span></gl-tooltip
						>
					</a>
					<gl-feature-badge
						.source=${this.badgeSource}
						.subscription=${this._state.subscription}
						placement="left"
						class="nav-list__access"
					></gl-feature-badge>
				</div>
				<div class="nav-list__item">
					<a
						class="nav-list__link${this.blockRepoFeatures ? ' is-disabled' : ''}"
						href="command:gitlens.showStashesView"
						aria-label="显示存储视图"
						data-requires="repo"
						><code-icon class="nav-list__icon" icon="gl-stashes-view"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="显示存储视图">
							<span>存储</span></gl-tooltip
						>
					</a>
				</div>
				<div class="nav-list__item">
					<a
						class="nav-list__link${this.blockRepoFeatures ? ' is-disabled' : ''}"
						href="command:gitlens.showSearchAndCompareView"
						aria-label="显示搜索与比较视图"
						data-requires="repo"
						><code-icon class="nav-list__icon" icon="gl-search-view"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="显示搜索与比较视图">
							<span>搜索与比较</span></gl-tooltip
						>
					</a>
				</div>
				<div class="nav-list__item">
					<a
						class="nav-list__link${this.blockRepoFeatures ? ' is-disabled' : ''}"
						href="command:gitlens.showWorkspacesView"
						aria-label="显示云工作区视图"
						data-requires="repo"
						><code-icon class="nav-list__icon" icon="gl-workspaces-view"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="显示云工作区视图">
							<span>云工作区</span></gl-tooltip
						>
					</a>
					<gl-feature-badge
						.source=${this.badgeSource}
						.subscription=${this._state.subscription}
						placement="left"
						class="nav-list__access"
						cloud
						preview
					></gl-feature-badge>
				</div>
				<div class="nav-list__item">
					<a
						class="nav-list__link${this.blockRepoFeatures ? ' is-disabled' : ''}"
						href="command:gitlens.showWorktreesView"
						aria-label="显示工作树视图"
						data-requires="repo"
						><code-icon class="nav-list__icon" icon="gl-worktrees-view"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="显示工作树视图">
							<span>工作树</span></gl-tooltip
						>
					</a>
					<gl-feature-badge
						.source=${this.badgeSource}
						.subscription=${this._state.subscription}
						placement="left"
						class="nav-list__access"
					></gl-feature-badge>
				</div>
			</nav>
			<nav class="nav-list">
				<h2 class="nav-list__title t-eyebrow sticky">活动栏</h2>
				<div class="nav-list__item">
					<a
						class="nav-list__link"
						href="command:workbench.view.extension.gitlens"
						aria-label="显示 GitLens 侧边栏"
						><code-icon class="nav-list__icon" icon="gl-gitlens"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="显示 GitLens 侧边栏"
							><span>GitLens</span></gl-tooltip
						>
					</a>
				</div>
				<div class="nav-list__item">
					<a
						class="nav-list__link${this.blockRepoFeatures ? ' is-disabled' : ''}"
						href="command:workbench.view.extension.gitlensInspect"
						aria-label="显示 GitLens 检查侧边栏"
						data-requires="repo"
						><code-icon class="nav-list__icon" icon="gl-gitlens-inspect"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="显示 GitLens 检查侧边栏"
							><span>GitLens 检查</span></gl-tooltip
						>
					</a>
				</div>
				<div class="nav-list__item">
					<a
						class="nav-list__link${this.blockRepoFeatures ? ' is-disabled' : ''}"
						href="command:workbench.view.scm"
						aria-label="显示源代码管理侧边栏"
						data-requires="repo"
						><code-icon class="nav-list__icon" icon="source-control"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="显示源代码管理侧边栏"
							><span>源代码管理</span></gl-tooltip
						>
					</a>
				</div>
			</nav>
			<nav class="nav-list">
				<h3 class="nav-list__title t-eyebrow sticky">命令</h3>
				<div class="nav-list__item">
					<a
						class="nav-list__link"
						href=${'command:workbench.action.quickOpen?%22>GitLens%3A%22'}
						aria-label="显示 GitLens 命令"
						><code-icon class="nav-list__icon" icon="symbol-event"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="显示 GitLens 命令"
							><span>命令</span></gl-tooltip
						>
					</a>
				</div>
				<div class="nav-list__item">
					<a
						class="nav-list__link${this.blockRepoFeatures ? ' is-disabled' : ''}"
						href="command:gitlens.gitCommands"
						aria-label="打开 Git 命令面板"
						data-requires="repo"
						><code-icon class="nav-list__icon" icon="symbol-color"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="打开 Git 命令面板"
							><span>Git 命令面板</span></gl-tooltip
						>
					</a>
				</div>
			</nav>
			<nav class="nav-list">
				<h2 class="nav-list__title t-eyebrow sticky">配套工具</h2>
				<div class="nav-list__item">
					<a
						class="nav-list__link"
						href=${'https://gitkraken.com/browser-extension?utm_source=gitlens-extension&utm_medium=in-app-links'}
						aria-label="试用 GitKraken 浏览器扩展"
						><code-icon class="nav-list__icon" icon="extensions"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="试用 GitKraken 浏览器扩展"
							><span>GitKraken 浏览器扩展</span></gl-tooltip
						>
					</a>
				</div>
				<div class="nav-list__item">
					<a
						class="nav-list__link"
						href=${'https://gitkraken.com/cli?utm_source=gitlens-extension&utm_medium=in-app-links'}
						aria-label="试用 GitKraken CLI"
						><code-icon class="nav-list__icon" icon="terminal"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="试用 GitKraken CLI"
							><span>GitKraken CLI</span></gl-tooltip
						>
					</a>
				</div>
				<div class="nav-list__item">
					<a
						class="nav-list__link"
						href=${'https://gitkraken.dev?utm_source=gitlens-extension&utm_medium=in-app-links'}
						aria-label="试用 GitKraken.dev"
						><code-icon class="nav-list__icon" icon="globe"></code-icon
						><gl-tooltip hoist class="nav-list__label" content="试用 GitKraken.dev"
							><span>GitKraken.dev</span></gl-tooltip
						>
					</a>
				</div>
			</nav>
		`;
	}
}
