import { consume } from '@lit/context';
import { SignalWatcher } from '@lit-labs/signals';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createCommandLink } from '../../../../system/commands.js';
import { ChooseRepositoryCommand } from '../../../plus/graph/protocol.js';
import { featureGateContentStyles } from '../../shared/components/feature-gate.css.js';
import { ipcContext } from '../../shared/contexts/ipc.js';
import { linkStyles } from '../shared/components/vscode.css.js';
import { graphStateContext } from './context.js';
import '../../shared/components/code-icon.js';
import '../../shared/components/feature-badge.js';
import '../../shared/components/feature-gate.js';

@customElement('gl-graph-gate')
export class GlGraphGate extends SignalWatcher(LitElement) {
	static override styles = [
		linkStyles,
		featureGateContentStyles,
		css`
			gl-feature-gate::part(section) {
				width: 90vw;
				max-width: 90rem;
			}
		`,
	];

	@consume({ context: graphStateContext, subscribe: true })
	graphState!: typeof graphStateContext.__context__;

	@consume({ context: ipcContext })
	private readonly _ipc!: typeof ipcContext.__context__;

	override render() {
		return html`<gl-feature-gate
			.featurePreview=${this.graphState.featurePreview}
			featurePreviewCommandLink=${ifDefined(
				this.graphState.featurePreview
					? createCommandLink('gitlens.plus.continueFeaturePreview', {
							feature: this.graphState.featurePreview.feature,
						})
					: undefined,
			)}
			appearance="alert"
			featureRestriction="private-repos"
			featureWithArticleIfNeeded="提交图"
			?allowRepoSwitch=${this.graphState.allowRepoSwitch}
			.source=${{ source: 'graph', detail: 'gate' } as const}
			.state=${this.graphState.subscription?.state}
			.webroot=${this.graphState.webroot}
			@gl-switch-repos=${this.onSwitchRepos}
		>
			<section slot="feature" class="feature">
				<header class="feature__header">
					<div class="icon-cube feature__feature-icon"><code-icon icon="gl-gitlens"></code-icon></div>
					<hgroup>
						<h2 class="feature__title">
							<span>体验全新提交图</span>
							<gl-feature-badge
								.source=${{ source: 'graph', detail: 'badge' } as const}
								.subscription=${this.graphState.subscription}
							></gl-feature-badge>
						</h2>
						<p class="feature__lede">你的开发与智能体工作流在此交汇</p>
					</hgroup>
				</header>

				<p class="feature__sub">
					并行化你的工作流——管理多个活跃工作树，编排并发智能体，并在不切换上下文的情况下执行整个 Git 生命周期
				</p>

				<ul class="list">
					<li class="list__item">
						<span class="icon-cube"><code-icon icon="layout"></code-icon></span>
						<span class="list__copy"
							><strong>统一工作区</strong>
							通过侧边栏和可停靠的详情面板集中你的工作流。将提交图分离到单独的窗口中，最大化编辑器空间</span
						>
					</li>

					<li class="list__item">
						<span class="icon-cube"><code-icon icon="robot"></code-icon></span>
						<span class="list__copy"
							><strong>编排智能体</strong>
							从提交图、智能体侧边栏或看板启动、监控和交互智能体，批准权限并内联查看执行计划</span
						>
					</li>
					<li class="list__item">
						<span class="icon-cube"><code-icon icon="shield"></code-icon></span>
						<span class="list__copy"
							><strong>命令中心</strong>
							审查更改、暂存文件、创建或组合提交，并解决冲突。在干净的工作树上，详情面板会引导你进行下一步操作——如拉取、推送或起草
							PR</span
						>
					</li>
					<li class="list__item">
						<span class="icon-cube"><code-icon icon="arrow-swap"></code-icon></span>
						<span class="list__copy"
							><strong>并行工作</strong>
							在单个视图中管理多个活跃工作树和智能体会话。即时将提交图聚焦到特定更改，实时审查和跟踪智能体的工作位置</span
						>
					</li>
					<li class="list__item">
						<span class="icon-cube"><code-icon icon="wand"></code-icon></span>
						<span class="list__copy"
							><strong>AI 组合与审查</strong>
							从混乱中理出秩序。自动将更改重组为清晰、可审查的提交。通过严重性标记的审查尽早发现问题，你可以直接委托给智能体处理</span
						>
					</li>
					<li class="list__item">
						<span class="icon-cube"><code-icon icon="pulse"></code-icon></span>
						<span class="list__copy"
							><strong>深度可视化</strong>
							使用可视化历史分析仓库演变。通过文件、提交和智能体活动树状图精确定位热点和趋势，或实时查看智能体活动</span
						>
					</li>
				</ul>
			</section>
		</gl-feature-gate>`;
	}

	private onSwitchRepos(): void {
		this._ipc.sendCommand(ChooseRepositoryCommand);
	}
}
