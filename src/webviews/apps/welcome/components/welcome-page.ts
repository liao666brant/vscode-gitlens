import { consume } from '@lit/context';
import { html, LitElement, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import type { State } from '../../../welcome/protocol.js';
import { scrollableBase } from '../../shared/components/styles/lit/base.css.js';
import { ipcContext } from '../../shared/contexts/ipc.js';
import type { TelemetryContext } from '../../shared/contexts/telemetry.js';
import { telemetryContext } from '../../shared/contexts/telemetry.js';
import { stateContext } from '../context.js';
import { welcomeStyles } from './welcome-page.css.js';
import '../../shared/components/gitlens-logo-circle.js';
import '../../shared/components/button.js';
import '../../shared/components/code-icon.js';
import './welcome-parts.js';
import type { GlWalkthrough, WalkthroughStep } from './welcome-parts.js';

declare global {
	interface HTMLElementTagNameMap {
		'gl-welcome-page': GlWelcomePage;
	}
}

const walkthroughSteps: WalkthroughStep[] = [
	{
		id: 'get-started-community',
		walkthroughKey: 'gettingStarted',
		title: '欢迎使用 GitLens',
		body: html`
			<p>GitLens 社区版保留本地 Git 工作流能力，帮助你查看提交、分支、文件历史和工作区更改。</p>
			<ul>
				<li><strong>仓库视图：</strong>浏览分支、提交、标签、stash 和工作区状态</li>
				<li><strong>Inspect：</strong>查看提交详情、文件变更和相关历史</li>
				<li><strong>比较工具：</strong>比较分支、提交和工作区更改</li>
				<li><strong>Worktrees：</strong>在多个分支间并行处理本地工作</li>
			</ul>
			<div class="card-part--centered">
				<gl-button href="command:gitlens.showRepositoriesView">打开仓库视图</gl-button>
			</div>
		`,
	},

	{
		id: 'home-view',
		walkthroughKey: 'homeView',
		title: '使用 Home 视图简化工作流',
		body: html`
			<p>简化你的工作流，在一个直观的中心轻松跟踪、管理并协作处理分支和拉取请求。</p>
			<div class="card-part--centered">
				<gl-button href="command:gitlens.welcome.showHomeView">打开 Home 视图</gl-button>
			</div>
		`,
	},

	{
		id: 'inspect-history',
		walkthroughKey: 'gitBlame',
		title: '查看提交与文件历史',
		body: html`
			<p>通过 Inspect、提交视图和比较命令查看代码变更的上下文。</p>
			<ul>
				<li>打开提交详情</li>
				<li>查看文件在不同版本间的差异</li>
				<li>比较分支、标签或任意提交</li>
			</ul>
			<div class="card-part--centered">
				<gl-button href="command:gitlens.showCommitsView">打开提交视图</gl-button>
			</div>
		`,
	},

	{
		id: 'worktrees',
		walkthroughKey: 'visualizeCodeHistory',
		title: '使用 Worktrees 并行工作',
		body: html`
			<p>为不同分支创建独立工作目录，减少切换分支时的上下文损耗。</p>
			<div class="card-part--centered">
				<gl-button href="command:gitlens.views.createWorktree">创建 Worktree</gl-button>
			</div>
		`,
	},
];

@customElement('gl-welcome-page')
export class GlWelcomePage extends LitElement {
	static override styles = [scrollableBase, welcomeStyles];

	@property({ type: Boolean })
	closeable = false;

	@property({ type: String })
	webroot?: string;

	@property({ type: Boolean })
	private isLightTheme = false;

	@consume<State>({ context: stateContext, subscribe: true })
	@state()
	private _state!: State;

	@consume({ context: ipcContext })
	_ipc!: typeof ipcContext.__context__;

	@consume({ context: telemetryContext as { __context__: TelemetryContext } })
	_telemetry!: TelemetryContext;

	@query('gl-walkthrough')
	private walkthrough?: GlWalkthrough;

	private readonly handleWalkthroughFocusCommand = () => {
		return this.walkthrough?.resetToDefaultAndFocus();
	};

	private readonly handleClick = (e: MouseEvent) => {
		const target = e.composedPath()[0] as HTMLElement;
		const anchor = target.closest?.('a[href="#continue-walkthrough"]');
		const button = (e.target as HTMLElement).closest?.('gl-button[href="#continue-walkthrough"]');
		if (anchor != null || button != null) {
			e.preventDefault();
			e.stopPropagation();
			void this.walkthrough?.resetToDefaultAndFocus();
		}
	};

	override connectedCallback(): void {
		super.connectedCallback?.();
		this._telemetry.sendEvent({
			name: 'welcome/action',
			data: {
				name: 'shown',
			},
			source: { source: 'welcome' },
		});

		window.addEventListener('gl-walkthrough-focus-command', this.handleWalkthroughFocusCommand);
		this.addEventListener('click', this.handleClick);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback?.();
		window.removeEventListener('gl-walkthrough-focus-command', this.handleWalkthroughFocusCommand);
		this.removeEventListener('click', this.handleClick);
	}

	override render(): unknown {
		if (!this._state) return nothing;

		return this.renderMainWalkthrough();
	}

	private renderMainWalkthrough(): unknown {
		return html`
			<div part="page" class="welcome scrollable">
				<div class="section header">
					<h1><gitlens-logo-circle></gitlens-logo-circle><span>开始使用 GitLens</span></h1>
					<p>增强 Git 能力，挖掘仓库中尚未利用的知识，更好地理解、编写和评审代码。</p>
				</div>
				<gl-walkthrough-progress
					class="section"
					.doneCount=${this._state.walkthroughProgress?.doneCount ?? 0}
					.allCount=${this._state.walkthroughProgress?.allCount ?? 0}
				></gl-walkthrough-progress>
				<gl-walkthrough class="section">
					${walkthroughSteps
						.filter(step => !step.condition || step.condition(this._state))
						.map(
							step => html`
								<gl-walkthrough-step
									class="card"
									stepId=${step.id}
									.completed=${step.walkthroughKey != null &&
									this._state.walkthroughProgress?.state[step.walkthroughKey] === true}
								>
									<h1 slot="title">${step.title}</h1>
									${step.body}
								</gl-walkthrough-step>
							`,
						)}
				</gl-walkthrough>
			</div>
		`;
	}
}
