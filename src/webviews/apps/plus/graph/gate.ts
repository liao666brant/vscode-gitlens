import { consume } from '@lit/context';
import { SignalWatcher } from '@lit-labs/signals';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createCommandLink } from '../../../../system/commands.js';
import { linkStyles } from '../shared/components/vscode.css.js';
import { graphStateContext } from './context.js';
import '../../shared/components/code-icon.js';
import '../../shared/components/feature-badge.js';
import '../../shared/components/feature-gate.js';

@customElement('gl-graph-gate')
export class GlGraphGate extends SignalWatcher(LitElement) {
	static override styles = [
		linkStyles,
		css`
			gl-feature-gate::part(section) {
				width: 90vw;
				max-width: 90rem;
			}

			.intro {
				display: flex;
				flex-direction: column;
				gap: 1rem;
				margin-block: 0.2rem 1.2rem;
			}

			.intro__title {
				display: flex;
				align-items: baseline;
				flex-wrap: wrap;
				gap: 0.6rem;
				margin: 0;
				font-size: 1.6rem;
				font-weight: 600;
				line-height: 1.2;
			}

			.intro__title gl-feature-badge {
				margin: 0;
				transform: translateY(-0.4rem);
			}

			.intro__lede {
				margin: 0;
				color: var(--color-foreground--85);
				line-height: 1.5;
			}

			.intro__lede--sub {
				display: inline-block;
				margin: 0;
				color: var(--color-foreground--85);
				line-height: 1.5;
				font-size: 1.1rem;
			}

			.intro__features {
				list-style: none;
				margin-block: 0.6rem;
				margin-inline: 0;
				padding: 1.2rem;
				display: grid;
				grid-template-columns: repeat(2, 1fr);
				gap: 1.2rem;
				background: color-mix(in srgb, #000 18%, transparent);
				border-radius: 0.6rem;
			}

			.intro__feature {
				display: flex;
				align-items: flex-start;
				gap: 0.8rem;
				line-height: 1.5;
				font-size: 1.1rem;
				opacity: 0.9;
			}

			.intro__feature strong {
				text-transform: uppercase;
				margin-right: 0.4rem;
				font-size: 1.2rem;
				opacity: 1;
			}

			.intro__feature code-icon {
				color: var(--vscode-textLink-foreground);
				margin-top: 0.2rem;
				flex-shrink: 0;
			}
		`,
	];

	@consume({ context: graphStateContext, subscribe: true })
	graphState!: typeof graphStateContext.__context__;

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
			?hidden=${this.graphState.allowed !== false}
			.source=${{ source: 'graph', detail: 'gate' } as const}
			.state=${this.graphState.subscription?.state}
			.webroot=${this.graphState.webroot}
		>
			<div slot="feature" class="intro">
				<h2 class="intro__title">
					<span>体验全新提交图</span>
					<gl-feature-badge
						.source=${{ source: 'graph', detail: 'badge' } as const}
						subscription="{subscription}"
					></gl-feature-badge>
				</h2>
				<p class="intro__lede">
					你的开发与智能体工作流在此交汇
					<span class="intro__lede--sub"
						>并行化你的工作流——管理多个活动工作树，编排并发智能体，并执行完整的 Git
						生命周期，无需上下文切换</span
					>
				</p>
				<ul class="intro__features">
					<li class="intro__feature">
						<code-icon icon="layout"></code-icon>
						<span
							><strong>统一工作区</strong>
							通过侧边栏和可停靠的详情面板集中你的工作流。将提交图分离到单独的窗口中，最大化编辑器空间</span
						>
					</li>

					<li class="intro__feature">
						<code-icon icon="robot"></code-icon>
						<span
							><strong>编排智能体</strong>
							从提交图、智能体侧边栏或看板启动、监控和交互智能体，审批权限并查看内联执行计划</span
						>
					</li>
					<li class="intro__feature">
						<code-icon icon="shield"></code-icon>
						<span
							><strong>命令中心</strong>
							审查更改、暂存文件、创建或组合提交，并解决冲突。在干净的工作树上，详情面板会引导你进行下一步操作——如拉取、推送或起草
							PR</span
						>
					</li>
					<li class="intro__feature">
						<code-icon icon="arrow-swap"></code-icon>
						<span
							><strong>并行工作</strong>
							在单个视图中管理多个活动工作树和智能体会话。即时将提交图聚焦到特定更改，实时审查和跟踪智能体的工作位置</span
						>
					</li>
					<li class="intro__feature">
						<code-icon icon="wand"></code-icon>
						<span
							><strong>AI 组合与审查</strong>
							从混乱中理出秩序。自动将更改重组为清晰、可审查的提交。通过严重性标记的审查尽早发现问题，你可以直接委托给智能体处理</span
						>
					</li>
					<li class="intro__feature">
						<code-icon icon="pulse"></code-icon>
						<span
							><strong>深度可视化</strong>
							使用可视化历史分析仓库演变。通过文件、提交和智能体活动树状图精确定位热点和趋势，或实时查看智能体活动</span
						>
					</li>
				</ul>
			</div>
		</gl-feature-gate>`;
	}
}
