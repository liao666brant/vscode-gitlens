import { consume } from '@lit/context';
import { SignalWatcher } from '@lit-labs/signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import type {
	ConnectCloudIntegrationsCommandArgs,
	ManageCloudIntegrationsCommandArgs,
} from '../../../../../commands/cloudIntegrations.js';
import type { SupportedCloudIntegrationIds } from '../../../../../constants.integrations.js';
import { SubscriptionState } from '../../../../../constants.subscription.js';
import type { Source } from '../../../../../constants.telemetry.js';
import type { SubscriptionUpgradeCommandArgs } from '../../../../../plus/gk/models/subscription.js';
import { isSubscriptionTrialOrPaidFromState } from '../../../../../plus/gk/utils/subscription.utils.js';
import { createCommandLink } from '../../../../../system/commands.js';
import type { AIState, IntegrationStateInfo } from '../../../../rpc/services/types.js';
import { elementBase, linkBase } from '../../../shared/components/styles/lit/base.css.js';
import type { AIContextState } from '../../../shared/contexts/ai.js';
import { aiContext } from '../../../shared/contexts/ai.js';
import type { IntegrationsState } from '../../../shared/contexts/integrations.js';
import { integrationsContext } from '../../../shared/contexts/integrations.js';
import type { SubscriptionContextState } from '../../../shared/contexts/subscription.js';
import { subscriptionContext } from '../../../shared/contexts/subscription.js';
import { chipStyles } from './chipStyles.js';
import '../../../shared/components/button.js';
import '../../../shared/components/button-container.js';
import '../../../shared/components/code-icon.js';
import '../../../shared/components/overlays/popover.js';
import '../../../shared/components/overlays/tooltip.js';
import '../../../shared/components/feature-badge.js';

@customElement('gl-integrations-chip')
export class GlIntegrationsChip extends SignalWatcher(LitElement) {
	@consume({ context: subscriptionContext, subscribe: true })
	private _subscription!: SubscriptionContextState;

	@consume({ context: integrationsContext })
	private _integrations!: IntegrationsState;

	@consume({ context: aiContext })
	private _ai!: AIContextState;

	static override shadowRootOptions: ShadowRootInit = {
		...LitElement.shadowRootOptions,
		delegatesFocus: true,
	};

	static override styles = [
		elementBase,
		linkBase,
		chipStyles,
		css`
			:host-context(.vscode-dark),
			:host-context(.vscode-high-contrast) {
				--gl-chip-skeleton-bg: color-mix(in lab, var(--vscode-sideBar-background), #fff 10%);
			}

			:host-context(.vscode-light),
			:host-context(.vscode-high-contrast-light) {
				--gl-chip-skeleton-bg: color-mix(in lab, var(--vscode-sideBar-background), #000 7%);
			}

			.chip {
				gap: 0.6rem;
				padding: 0.2rem 0.4rem 0.4rem 0.4rem;
				align-items: baseline;
			}

			.chip__label {
				font-size: 1.1rem;
				font-weight: 400;
				text-transform: uppercase;
				color: var(--color-foreground--75);
				margin-right: 0.4rem;
			}

			.integration {
				white-space: nowrap;
			}

			.content {
				gap: 0.6rem;
			}

			:host-context(.vscode-dark),
			:host-context(.vscode-high-contrast) {
				--status-color--connected: #00dd00;
			}

			:host-context(.vscode-light),
			:host-context(.vscode-high-contrast-light) {
				--status-color--connected: #00aa00;
			}

			.status--disconnected.integration {
				color: var(--color-foreground--25);
			}

			.status--connected:not(.is-locked) .status-indicator {
				color: var(--status-color--connected);
			}

			gl-tooltip.status-indicator {
				margin-right: 0.4rem;
			}

			.integrations {
				display: flex;
				flex-direction: column;
				gap: 0.8rem;
				width: 100%;
			}

			.integration-row {
				display: flex;
				gap: 1rem;
				align-items: center;
			}

			.integration-row--ai {
				border-top: 1px solid var(--color-foreground--25);
				padding-top: 0.6rem;
			}

			.integration-row--mcp,
			.integration-row--default-agent,
			.integration-row--hooks {
				padding-top: 0;
			}

			.status--disconnected .integration__icon {
				color: var(--color-foreground--25);
			}

			.integration__content {
				flex: 1 1 auto;
				display: block;
			}

			.integration__title {
				display: flex;
				justify-content: space-between;
			}

			.integration__title gl-feature-badge {
				vertical-align: super;
			}

			.integration__details {
				display: block;
				color: var(--color-foreground--75);
				font-size: 1rem;
			}

			.status--disconnected .integration__title,
			.status--disconnected .integration__details {
				color: var(--color-foreground--50);
			}

			.integration__actions {
				flex: none;
				display: flex;
				gap: 0.2rem;
				flex-direction: row;
				align-items: center;
				justify-content: flex-end;
			}

			button-container {
				margin-bottom: 0.4rem;
				width: 100%;
			}

			p {
				margin: 0;
			}

			gl-popover::part(body) {
				--max-width: 90vw;
			}

			@keyframes shimmer {
				100% {
					transform: translateX(100%);
				}
			}

			.chip--skeleton {
				position: relative;
				overflow: hidden;
				width: 9rem;
				height: 2.2rem;
				background-color: var(--gl-chip-skeleton-bg);
				cursor: default;
			}

			.chip--skeleton::before {
				content: '';
				position: absolute;
				inset: 0;
				background-image: linear-gradient(
					to right,
					transparent 0%,
					var(--color-background--lighten-15) 20%,
					var(--color-background--lighten-30) 60%,
					transparent 100%
				);
				transform: translateX(-100%);
				animation: shimmer 2s ease-in-out infinite;
			}
		`,
	];

	@query('#chip')
	private _chip!: HTMLElement;

	private get hasAccount() {
		return this._subscription.subscription.get()?.account != null;
	}

	private get isPaidAccount() {
		return this._subscription.subscription.get()?.state === SubscriptionState.Paid;
	}

	private get isProAccount() {
		return isSubscriptionTrialOrPaidFromState(this._subscription.subscription.get()?.state);
	}

	private get hasConnectedIntegrations() {
		return this.hasAccount && this.integrations.some(i => i.connected);
	}

	private get ai(): AIState {
		return this._ai.state.get();
	}

	private get aiEnabled(): boolean {
		return this.ai.enabled && this.ai.orgEnabled;
	}

	private get integrations() {
		return this._integrations.integrations.get();
	}

	override focus(): void {
		this._chip.focus();
	}

	override render(): unknown {
		// Don't show integration state until subscription data has loaded —
		// otherwise we'd flash "Connect" with an empty list.
		if (this._subscription.subscription.get() === undefined) {
			return html`<span
				id="chip"
				class="chip chip--skeleton"
				tabindex="-1"
				aria-label="加载集成状态"
				role="status"
			></span>`;
		}

		const anyConnected = this.hasConnectedIntegrations;
		const statusFilter = createStatusIconFilter(this.integrations);

		return html`<gl-popover placement="bottom" trigger="hover click focus" hoist>
			<span slot="anchor" class="chip" tabindex="0" aria-label="打开集成菜单"
				>${!anyConnected ? html`<span class="chip__label">连接</span>` : ''}${this.integrations
					.filter(statusFilter)
					.map(i =>
						this.renderIntegrationStatus(i),
					)}${this.renderAIStatus()}${this.renderMcpStatus()}${this.renderDefaultAgentStatus()}${this.renderHooksStatus()}</span
			>
			<div slot="content" class="content">
				<div class="header">
					<span class="header__title">集成</span>
					<span class="header__actions"></span>
						<gl-button
							appearance="toolbar"
							href="${createCommandLink<Source>('gitlens.plus.validate', {
								source: 'home',
								detail: 'integrations',
							})}"
							tooltip="同步状态"
							aria-label="同步状态"
							><code-icon icon="sync"></code-icon
						></gl-button>
						<gl-button
							appearance="toolbar"
							href="${createCommandLink<ManageCloudIntegrationsCommandArgs>('gitlens.plus.cloudIntegrations.manage', {
								source: { source: 'home' },
							})}"
							tooltip="管理集成"
							aria-label="管理集成"
							><code-icon icon="gear"></code-icon></gl-button
					></span>
				</div>
				<div class="integrations">${
					!anyConnected
						? html`<p>
									连接像 <strong>GitHub</strong> 这样的代码托管服务和像
									<strong>Jira</strong> 这样的问题跟踪服务，以跟踪进度并对与你分支相关的 PR
									和问题采取行动。
								</p>
								<button-container>
									<gl-button
										full
										href="${createCommandLink<ConnectCloudIntegrationsCommandArgs>(
											'gitlens.plus.cloudIntegrations.connect',
											{
												integrationIds: this.integrations.map(
													i => i.id as SupportedCloudIntegrationIds,
												),
												source: { source: 'home', detail: 'integrations' },
											},
										)}"
										>连接集成</gl-button
									>
								</button-container>`
						: this.integrations.map(i => this.renderIntegrationRow(i))
				}${this.renderAIRow()}${this.renderMcpRow()}${this.renderDefaultAgentRow()}${this.renderHooksRow()}</div>
			</div>
		</gl-popover>`;
	}

	private renderIntegrationStatus(integration: IntegrationStateInfo) {
		if (integration.requiresPro && !this.isProAccount) {
			return html`<span
				class="integration status--${integration.connected ? 'connected' : 'disconnected'} is-locked"
				slot="anchor"
				><code-icon icon="${integration.icon}"></code-icon
			></span>`;
		}

		return html`<span
			class="integration status--${integration.connected ? 'connected' : 'disconnected'}"
			slot="anchor"
			><code-icon icon="${integration.icon}"></code-icon
		></span>`;
	}

	private renderIntegrationRow(integration: IntegrationStateInfo) {
		const showLock = integration.requiresPro && !this.isProAccount;
		const showProBadge = integration.requiresPro && !this.isPaidAccount;
		return html`<div
			class="integration-row status--${integration.connected ? 'connected' : 'disconnected'}${showLock
				? ' is-locked'
				: ''}"
		>
			<span class="integration__icon"><code-icon icon="${integration.icon}"></code-icon></span>
			<span class="integration__content">
				<span class="integration__title">
					<span>${integration.name}</span>
					${showProBadge
						? html` <gl-feature-badge
								placement="right"
								.source=${{ source: 'home', detail: 'integrations' } as const}
								cloud
							></gl-feature-badge>`
						: nothing}
				</span>
				<span class="integration__details">${getIntegrationDetails(integration)}</span>
			</span>
			<span class="integration__actions">
				${showLock
					? html`<gl-button
							appearance="toolbar"
							href="${createCommandLink<SubscriptionUpgradeCommandArgs>('gitlens.plus.upgrade', {
								plan: 'pro',
								source: 'home',
								detail: 'integrations',
							})}"
							tooltip="使用 GitLens Pro 解锁 ${integration.name} 功能"
							aria-label="使用 GitLens Pro 解锁 ${integration.name} 功能"
							><code-icon class="status-indicator" icon="lock"></code-icon
						></gl-button>`
					: integration.connected
						? html`<gl-tooltip
								class="status-indicator status--connected"
								placement="bottom"
								content="已连接"
								><code-icon class="status-indicator" icon="check"></code-icon
							></gl-tooltip>`
						: html`<gl-button
								appearance="toolbar"
								href="${createCommandLink<ConnectCloudIntegrationsCommandArgs>(
									'gitlens.plus.cloudIntegrations.connect',
									{
										integrationIds: [integration.id as SupportedCloudIntegrationIds],
										source: { source: 'home', detail: 'integrations' },
									},
								)}"
								tooltip="连接 ${integration.name}"
								aria-label="连接 ${integration.name}"
								><code-icon icon="plug"></code-icon
							></gl-button>`}
			</span>
		</div>`;
	}

	private renderAIStatus() {
		const model = this._ai.model.get();
		return html`<span
			class="integration status--${this.aiEnabled && model != null ? 'connected' : 'disconnected'}"
			slot="anchor"
		>
			<code-icon icon="${this.aiEnabled && model != null ? 'sparkle-filled' : 'sparkle'}"></code-icon>
		</span>`;
	}

	private renderAIRow() {
		const model = this._ai.model.get();

		const connectedAndEnabled = this.aiEnabled && model != null;
		const showLock = !this.aiEnabled;
		const showProBadge = false;
		const icon = connectedAndEnabled ? 'sparkle-filled' : 'sparkle'; // TODO: Provider?

		return html`<div
			class="integration-row integration-row--ai status--${connectedAndEnabled
				? 'connected'
				: 'disconnected'}${showLock ? ' is-locked' : ''}"
		>
			<span class="integration__icon"><code-icon icon="${icon}"></code-icon></span>
			${this.aiEnabled
				? html`<span class="integration__content">
							${model?.provider.name
								? html`<span class="integration__title">
										<span>${model.provider.name}</span>
										${showProBadge
											? html` <gl-feature-badge
													placement="right"
													.source=${{ source: 'home', detail: 'integrations' } as const}
													cloud
												></gl-feature-badge>`
											: nothing}
									</span>`
								: html`<span class="integration_details">选择 AI 模型以启用 AI 功能</span>`}
							${model?.name ? html`<span class="integration__details">${model.name}</span>` : nothing}
						</span>
						<span class="integration__actions">
							<gl-button
								appearance="toolbar"
								href="${createCommandLink<Source>('gitlens.ai.switchProvider', {
									source: 'home',
									detail: 'integrations',
								})}"
								tooltip="切换 AI 提供商/模型"
								aria-label="切换 AI 提供商/模型"
								><code-icon icon="arrow-swap"></code-icon
							></gl-button>
						</span>`
				: html`<span class="integration__content">
							<span class="integration_details"
								>GitLens AI 功能已
								禁用${!this.ai.enabled ? '（通过设置）' : '（由你的 GitKraken 管理员禁用）'}</span
							>
						</span>
						${!this.ai.enabled
							? html` <span class="integration__actions">
									<gl-button
										appearance="toolbar"
										href="${createCommandLink<Source>('gitlens.ai.enable', {
											source: 'home',
											detail: 'integrations',
										})}"
										tooltip="重新启用 AI 功能"
										aria-label="重新启用 AI 功能"
										><code-icon icon="unlock"></code-icon
									></gl-button>
								</span>`
							: nothing}`}
		</div>`;
	}

	private renderMcpStatus() {
		const { mcp } = this.ai;
		const active = this.aiEnabled && mcp.settingEnabled && mcp.installed;
		return html`<span class="integration status--${active ? 'connected' : 'disconnected'}" slot="anchor">
			<code-icon icon="mcp"></code-icon>
		</span>`;
	}

	private renderMcpRow() {
		const { mcp } = this.ai;
		const mcpEnabled = this.aiEnabled && mcp.settingEnabled;
		const active = mcpEnabled && mcp.installed;

		return html`<div class="integration-row integration-row--mcp status--${active ? 'connected' : 'disconnected'}">
			<span class="integration__icon"><code-icon icon="mcp"></code-icon></span>
			${mcpEnabled
				? mcp.installed
					? html`<span class="integration__content">
								<span class="integration__title">GitKraken MCP</span>
								<span class="integration__details">在 AI 聊天中利用 Git 和集成</span>
							</span>
							<span class="integration__actions">
								<gl-button
									appearance="toolbar"
									href="${createCommandLink<Source>('gitlens.ai.mcp.selectAgents', {
										source: 'home',
										detail: 'integrations',
									})}"
									tooltip="连接更多代理"
									aria-label="连接更多代理"
									><code-icon icon="plug"></code-icon
								></gl-button>
								<gl-button
									appearance="toolbar"
									href="${createCommandLink<Source>('gitlens.ai.mcp.reinstall', {
										source: 'home',
										detail: 'integrations',
									})}"
									tooltip="重新安装 GitKraken MCP"
									aria-label="重新安装 GitKraken MCP"
									><code-icon icon="sync"></code-icon
								></gl-button>
								<gl-tooltip
									class="status-indicator status--connected"
									placement="bottom"
									content="已安装${mcp.bundled ? '（捆绑版）' : ''}"
									><code-icon class="status-indicator" icon="check"></code-icon
								></gl-tooltip>
							</span>`
					: html`<span class="integration__content">
								<span class="integration__title">GitKraken MCP</span>
								<span class="integration__details">在 AI 聊天中利用 Git 和集成</span>
							</span>
							<span class="integration__actions">
								<gl-button
									appearance="toolbar"
									href="${createCommandLink<Source>('gitlens.ai.mcp.install', {
										source: 'home',
										detail: 'integrations',
									})}"
									tooltip="安装 GitKraken MCP"
									aria-label="安装 GitKraken MCP"
									><code-icon icon="plug"></code-icon
								></gl-button>
							</span>`
				: !this.aiEnabled
					? html`<span class="integration__content">
								<span class="integration_details"
									>GitKraken MCP 已
									禁用${!this.ai.enabled ? '（通过设置）' : '（由你的 GitKraken 管理员禁用）'}</span
								>
							</span>
							${!this.ai.enabled
								? html` <span class="integration__actions">
										<gl-button
											appearance="toolbar"
											href="${createCommandLink<Source>('gitlens.ai.enable', {
												source: 'home',
												detail: 'integrations',
											})}"
											tooltip="重新启用 AI 功能"
											aria-label="重新启用 AI 功能"
											><code-icon icon="unlock"></code-icon
										></gl-button>
									</span>`
								: nothing}`
					: html`<span class="integration__content">
								<span class="integration_details">GitKraken MCP has been disabled via settings</span>
							</span>
							<span class="integration__actions">
								<gl-button
									appearance="toolbar"
									href="${createCommandLink<Source>('gitlens.ai.mcp.install', {
										source: 'home',
										detail: 'integrations',
									})}"
									tooltip="重新启用 MCP"
									aria-label="重新启用 MCP"
									><code-icon icon="unlock"></code-icon
								></gl-button>
							</span>`}
		</div>`;
	}

	private renderDefaultAgentStatus() {
		if (!this.aiEnabled) return nothing;

		const agent = this.ai.defaultAgent;
		return html`<span class="integration status--${agent != null ? 'connected' : 'disconnected'}" slot="anchor">
			<code-icon icon="robot"></code-icon>
		</span>`;
	}

	private renderDefaultAgentRow() {
		if (!this.aiEnabled) return nothing;

		const agent = this.ai.defaultAgent;
		return html`<div
			class="integration-row integration-row--default-agent status--${agent != null
				? 'connected'
				: 'disconnected'}"
		>
			<span class="integration__icon"><code-icon icon="robot"></code-icon></span>
			<span class="integration__content">
				<span class="integration__title">默认编程代理</span>
				<span class="integration__details">${agent != null ? agent.label : '未选择默认代理'}</span>
			</span>
			<span class="integration__actions">
				<gl-button
					appearance="toolbar"
					href="${createCommandLink('gitlens.agents.switchDefaultAgent')}"
					tooltip="切换默认代理"
					aria-label="切换默认代理"
					><code-icon icon="arrow-swap"></code-icon
				></gl-button>
			</span>
		</div>`;
	}

	private renderHooksStatus() {
		if (!this.aiEnabled || !this.ai.hooks.canInstallClaudeHook) return nothing;
		return html`<span class="integration status--disconnected" slot="anchor">
			<code-icon icon="search-sparkle"></code-icon>
		</span>`;
	}

	private renderHooksRow() {
		if (!this.aiEnabled) return nothing;

		const claude = this.ai.hooks.claude;
		// Don't render at all if gkcli says hooks aren't supported for Claude on this machine, or
		// if Claude isn't detected — there's nothing to install OR uninstall.
		if (!claude.supported || !claude.detected) return nothing;

		if (claude.installed) {
			return html`<div class="integration-row integration-row--hooks status--connected">
				<span class="integration__icon"><code-icon icon="search-sparkle"></code-icon></span>
				<span class="integration__content">
					<span class="integration__title">GitKraken Claude Code Hooks</span>
					<span class="integration__details">已安装 — Claude 显示代理状态</span>
				</span>
				<span class="integration__actions">
					<gl-button
						appearance="toolbar"
						href="${createCommandLink('gitlens.agents.uninstallClaudeHook')}"
						tooltip="卸载 Claude Hooks"
						aria-label="卸载 Claude Hooks"
						><code-icon icon="debug-disconnect"></code-icon
					></gl-button>
				</span>
			</div>`;
		}

		return html`<div class="integration-row integration-row--hooks status--disconnected">
			<span class="integration__icon"><code-icon icon="search-sparkle"></code-icon></span>
			<span class="integration__content">
				<span class="integration__title">GitKraken Claude Code Hooks</span>
				<span class="integration__details">配置 Claude 以显示代理状态</span>
			</span>
			<span class="integration__actions">
				<gl-button
					appearance="toolbar"
					href="${createCommandLink('gitlens.agents.installClaudeHook')}"
					tooltip="安装 Claude Hooks"
					aria-label="安装 Claude Hooks"
					><code-icon icon="plug"></code-icon
				></gl-button>
			</span>
		</div>`;
	}
}

const featureMap = new Map<string, string>([
	['prs', '拉取请求'],
	['issues', '问题'],
]);

function getIntegrationDetails(integration: IntegrationStateInfo): string {
	const features = integration.supports.map(feature => featureMap.get(feature)!);

	if (features.length === 0) return '';
	if (features.length === 1) return `支持 ${features[0]}`;

	const last = features.pop();
	return `支持 ${features.join('、')}，以及 ${last}`;
}

function createStatusIconFilter(integrations: IntegrationStateInfo[]) {
	const groupedIconMap = new Map<string, IntegrationStateInfo>();

	// Group the integrations by icon, and if one is connected
	for (const integration of integrations) {
		const existing = groupedIconMap.get(integration.icon);
		if (!existing || (integration.connected && !existing.connected)) {
			groupedIconMap.set(integration.icon, integration);
		}
	}

	return (integration: IntegrationStateInfo) => groupedIconMap.get(integration.icon) === integration;
}
