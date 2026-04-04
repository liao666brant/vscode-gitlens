import { consume } from '@lit/context';
import { html, LitElement, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { urls } from '../../../../constants.js';
import { SubscriptionState } from '../../../../constants.subscription.js';
import { createCommandLink } from '../../../../system/commands.js';
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
			<p>
				GitLens 社区版可让你跟踪代码变更，并通过行内 blame 注释、悬停提示等功能查看是谁做了这些更改，完全免费。
			</p>
			<p>
				使用 <strong>GitLens Pro</strong>（14 天免费试用），你将获得高级可视化、协作和内置 AI 的完整访问权限：
			</p>
			<ul>
				<li><strong>Commit Graph：</strong>可视化每个分支与提交之间的关系</li>
				<li><strong>Visual File History：</strong>通过图谱查看文件如何演进，以及何时发生了哪些变化</li>
				<li><strong>Launchpad 与 Worktrees：</strong>在一个中心管理 PR 和分支</li>
				<li><strong>GitKraken AI：</strong>为你撰写提交、PR 和变更日志。</li>
			</ul>
			<div class="card-part--centered">
				<gl-button class="start-trial-button" href="command:gitlens.welcome.plus.signUp"
					>开始使用 GitLens Pro</gl-button
				>
			</div>
			<p>或 <a href="command:gitlens.welcome.plus.login">登录</a></p>
		`,
		condition: state => !state.plusState || state.plusState < SubscriptionState.Trial,
	},

	{
		id: 'welcome-in-trial',
		walkthroughKey: 'gettingStarted',
		title: '欢迎使用 GitLens Pro',
		body: html`
			<p>感谢你开启 <strong>GitLens Pro</strong> 试用。</p>
			<p>完成此引导，体验增强的 PR 评审工具、更深入的代码历史可视化，以及更流畅的协作，从而提升生产力。</p>
			<a href="#continue-walkthrough">继续引导</a>
			<p>
				试用结束后，你将回到 <strong>GitLens 社区版</strong>，依然可以使用编辑器内 blame
				注释、悬停提示、CodeLens 等功能。
			</p>
			<div class="card-part--centered">
				<gl-button class="start-trial-button" href="command:gitlens.welcome.plus.upgrade"
					>升级到 GitLens Pro</gl-button
				>
			</div>
		`,
		condition: state => state.plusState === SubscriptionState.Trial,
	},

	{
		id: 'welcome-in-trial-expired',
		walkthroughKey: 'gettingStarted',
		title: '充分发挥 GitLens 的价值',
		body: html`
			<p>感谢你安装 GitLens 并体验 GitLens Pro。</p>
			<p>
				你当前使用的是 <strong>GitLens 社区版</strong>。可通过编辑器内 blame 注释、悬停提示、CodeLens
				等功能免费跟踪代码变更并查看是谁做了这些修改。
			</p>
			<p>
				了解
				<a href="command:gitlens.welcome.openCommunityVsPro">GitLens 社区版与 Pro 版的区别</a>。
			</p>
			<p><strong>使用 GitLens Pro 解锁更强大的工具</strong></p>
			<div class="card-part--centered">
				<gl-button class="start-trial-button" href="command:gitlens.welcome.plus.upgrade"
					>升级到 GitLens Pro</gl-button
				>
			</div>
			<p>
				借助 GitLens Pro，你可以加速 PR 评审、深入可视化代码历史，并增强团队协作。这是精简 VS Code
				工作流的理想升级。
			</p>
		`,
		condition: state => state.plusState === SubscriptionState.TrialExpired,
	},

	{
		id: 'welcome-in-trial-expired-eligible',
		walkthroughKey: 'gettingStarted',
		title: '充分发挥 GitLens 的价值',
		body: html`
			<p>感谢你安装 GitLens 并体验 GitLens Pro。</p>
			<p>
				你当前使用的是 <strong>GitLens 社区版</strong>。可通过编辑器内 blame 注释、悬停提示、CodeLens
				等功能免费跟踪代码变更并查看是谁做了这些修改。
			</p>
			<p><strong>解锁更强大的工具，重新体验 GitLens Pro</strong>，再享 14 天免费试用。</p>
			<div class="card-part--centered">
				<gl-button class="start-trial-button" href="command:gitlens.welcome.plus.reactivate"
					>重新激活 GitLens Pro 试用</gl-button
				>
			</div>
			<p>
				借助 GitLens Pro，你可以加速 PR 评审、深入可视化代码历史，并增强团队协作。这是精简 VS Code
				工作流的理想升级。
			</p>
		`,
		condition: state => state.plusState === SubscriptionState.TrialReactivationEligible,
	},

	{
		id: 'welcome-paid',
		walkthroughKey: 'gettingStarted',
		title: '探索 GitLens Pro 的优势',
		body: html`
			<p>
				作为 GitLens Pro 用户，你可以使用强大的工具来加速 PR 评审、提供更深入的代码历史可视化，并简化团队协作。
			</p>
			<div class="card-part--centered">
				<gl-button href="#continue-walkthrough">继续引导</gl-button>
			</div>
			<p class="card-part--tip">
				<em>提示：</em>为充分发挥 GitLens Pro 的价值，建议完成引导并访问帮助中心查看深入指南。
			</p>
			<a href="command:gitlens.welcome.openHelpCenter">在帮助中心了解更多</a>
		`,
		condition: state => state.plusState === SubscriptionState.Paid,
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
		id: 'visualize-code-history',
		walkthroughKey: 'visualizeCodeHistory',
		title: '提交图谱：查看代码演进脉络',
		body: html`
			<p>借助可搜索、颜色编码的提交时间线，轻松浏览复杂仓库，快速理解分支关系、作者模式和提交序列。</p>
			<p>可选择多个提交批量执行 cherry-pick 等操作，或用一条命令生成 AI 变更日志。</p>
			<div class="card-part--centered">
				<gl-button href="command:gitlens.welcome.showGraph">探索你的提交图谱</gl-button>
			</div>
		`,
	},

	{
		id: 'ai-features',
		walkthroughKey: 'aiFeatures',
		title: '更智能地提交，而不是更费力',
		body: html`
			<p>
				让 AI 承担繁重工作，从把你的改动整理成清晰、逻辑明确的提交，到快速理解他人的工作上下文。GitLens 的 AI
				功能让评审更高效，提交历史更整洁。
			</p>
			<ul>
				<li><strong>自动编排提交：</strong>在交互式编辑器中即时生成带描述性摘要的一组提交</li>
				<li><strong>解释提交和分支：</strong>无需耗时深挖 diff 也能理解改动</li>
				<li><strong>生成 PR 标题与描述：</strong>每次评审可为审阅者节省 10+ 分钟</li>
			</ul>
			<p>
				始终保持掌控。可在最终提交前审阅并编辑 AI 建议，同时
				<a href="command:gitlens.ai.switchProvider">配置你偏好的 AI 提供商</a>
				和模型以满足需求。
			</p>
			<div class="card-part--centered">
				<gl-button href="command:gitlens.welcome.showComposer">使用 AI 编排提交</gl-button>
			</div>
		`,
	},

	{
		id: 'git-blame',
		walkthroughKey: 'gitBlame',
		title: '了解每一行代码背后的原因',
		body: html`
			<p>无需离开编辑器，即可查看某行由谁、何时、为何修改。</p>
			<p>悬停在 blame 注释上可：</p>
			<ul>
				<li>查看文件历史版本</li>
				<li>打开相关 PR</li>
				<li>跳转到提交图谱中的提交</li>
				<li>与之前版本对比</li>
			</ul>
			<div class="card-part--centered">
				<gl-button href="command:gitlens.showSettingsPage!current-line">配置行内 Blame</gl-button>
			</div>
		`,
	},

	{
		id: 'accelerate-pr-reviews',
		walkthroughKey: 'prReviews',
		title: '在一个地方管理全部工作',
		body: html`
			<p>借助 Launchpad 与 Worktrees，让所有工作触手可及。</p>
			<ul>
				<li><strong>Launchpad：</strong>在一个中心查看并管理你的全部 PR 与分支</li>
				<li><strong>Worktrees：</strong>在多个分支并行开发、测试与评审</li>
				<li><strong>集成：</strong>连接来自 GitHub、GitLab、Jira、Azure DevOps 等平台的 PR 和 Issue</li>
			</ul>
			<p>保持专注，更快交付，且不遗漏真正重要的事项。</p>
			<div class="card-part--centered">
				<gl-button href="command:gitlens.welcome.showLaunchpad">打开 Launchpad</gl-button>
			</div>
		`,
	},

	{
		id: 'mcp-bundled',
		walkthroughKey: 'mcpFeatures',
		title: 'GitKraken MCP',
		body: html`
			<p>GitKraken MCP 已在你的 AI 聊天中启用，可利用 Git 与你的集成提供上下文并执行操作。</p>
			<p><a href="${urls.helpCenterMCP}">在帮助中心了解更多</a></p>
		`,
		condition: state => state.mcpNeedsInstall === false && !state.mcpShowCleanupNotice,
	},
	{
		id: 'mcp-bundled-cleanup',
		walkthroughKey: 'mcpFeatures',
		title: 'GitKraken MCP',
		body: html`
			<p>GitKraken MCP 已在你的 AI 聊天中启用，可利用 Git 与你的集成提供上下文并执行操作。</p>
			<p>
				<strong>注意：</strong>你的 Cursor <code>mcp.json</code> 中可能有此前安装留下的重复项。删除
				<code>mcpServers.GitKraken</code> 即可清理。
			</p>
			<p><a href="${urls.helpCenterMCP}">在帮助中心了解更多</a></p>
		`,
		condition: state => state.mcpNeedsInstall === false && state.mcpShowCleanupNotice,
	},

	{
		id: 'mcp-install',
		walkthroughKey: 'mcpFeatures',
		title: '安装适用于 GitLens 的 GitKraken MCP',
		body: html`
			<p>利用 Git 与你的集成（Issue、PR 等），在 AI 聊天中提供上下文并执行操作。</p>
			<div class="card-part--centered">
				<gl-button href="${createCommandLink('gitlens.ai.mcp.install', { source: 'welcome' })}"
					>安装 GitKraken MCP</gl-button
				>
			</div>
			<p><a href="${urls.helpCenterMCP}">了解更多</a></p>
		`,
		condition: state => state.mcpNeedsInstall === true,
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
				<div class="section section--centered">
					<p>
						你还可访问
						<a href="https://gitkraken.dev/tools" target="_blank">GitKraken DevEx 平台</a>，在
						IDE、桌面端、浏览器和终端等工作场景中释放强大的 Git 可视化与生产力能力。
					</p>
				</div>
			</div>
		`;
	}
}
