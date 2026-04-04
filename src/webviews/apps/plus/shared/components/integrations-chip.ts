import { consume } from '@lit/context';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import type {
	ConnectCloudIntegrationsCommandArgs,
	ManageCloudIntegrationsCommandArgs,
} from '../../../../../commands/cloudIntegrations.js';
import type { IntegrationFeatures } from '../../../../../constants.integrations.js';
import { SubscriptionState } from '../../../../../constants.subscription.js';
import type { Source } from '../../../../../constants.telemetry.js';
import type { SubscriptionUpgradeCommandArgs } from '../../../../../plus/gk/models/subscription.js';
import { isSubscriptionTrialOrPaidFromState } from '../../../../../plus/gk/utils/subscription.utils.js';
import { createCommandLink } from '../../../../../system/commands.js';
import type { IntegrationState, State } from '../../../../home/protocol.js';
import { stateContext } from '../../../home/context.js';
import { elementBase, linkBase } from '../../../shared/components/styles/lit/base.css.js';
import { chipStyles } from './chipStyles.js';
import '../../../shared/components/button.js';
import '../../../shared/components/button-container.js';
import '../../../shared/components/code-icon.js';
import '../../../shared/components/overlays/popover.js';
import '../../../shared/components/overlays/tooltip.js';
import '../../../shared/components/feature-badge.js';

@customElement('gl-integrations-chip')
export class GlIntegrationsChip extends LitElement {
	static override shadowRootOptions: ShadowRootInit = {
		...LitElement.shadowRootOptions,
		delegatesFocus: true,
	};

	static override styles = [
		elementBase,
		linkBase,
		chipStyles,
		css`
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
				align-items: flex-start;
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
		`,
	];

	@query('#chip')
	private _chip!: HTMLElement;

	@consume<State>({ context: stateContext, subscribe: true })
	@state()
	private _state!: State;

	private get hasAccount() {
		return this._state.subscription?.account != null;
	}

	private get isPaidAccount() {
		return this._state.subscription?.state === SubscriptionState.Paid;
	}

	private get isProAccount() {
		return isSubscriptionTrialOrPaidFromState(this._state.subscription?.state);
	}

	private get hasConnectedIntegrations() {
		return this.hasAccount && this.integrations.some(i => i.connected);
	}

	private get ai() {
		return this._state.ai;
	}

	private get aiSettingEnabled() {
		return this._state.aiEnabled;
	}

	private get aiOrgEnabled() {
		return this._state.orgSettings?.ai ?? true;
	}

	private get aiEnabled() {
		return this.aiSettingEnabled && this.aiOrgEnabled;
	}

	private get integrations() {
		return this._state.integrations;
	}

	override focus(): void {
		this._chip.focus();
	}

	override render(): unknown {
		const anyConnected = this.hasConnectedIntegrations;
		const statusFilter = createStatusIconFilter(this.integrations);

		return html`<gl-popover placement="bottom" trigger="hover click focus" hoist>
			<span slot="anchor" class="chip" tabindex="0" aria-label="打开集成菜单"
				>${!anyConnected ? html`<span class="chip__label">连接</span>` : ''}${this.integrations
					.filter(statusFilter)
					.map(i => this.renderIntegrationStatus(i))}${this.renderAIStatus()}</span
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
												integrationIds: this.integrations.map(i => i.id),
												source: { source: 'home', detail: 'integrations' },
											},
										)}"
										>连接集成</gl-button
									>
								</button-container>`
						: this.integrations.map(i => this.renderIntegrationRow(i))
				}${this.renderAIRow()}</div>
			</div>
		</gl-popover>`;
	}

	private renderIntegrationStatus(integration: IntegrationState) {
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

	private renderIntegrationRow(integration: IntegrationState) {
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
										integrationIds: [integration.id],
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
		return html`<span
			class="integration status--${this.aiEnabled && this.ai?.model != null ? 'connected' : 'disconnected'}"
			slot="anchor"
		>
			<code-icon icon="${this.aiEnabled && this.ai?.model != null ? 'sparkle-filled' : 'sparkle'}"></code-icon>
		</span>`;
	}

	private renderAIRow() {
		const { model } = this.ai;

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
								禁用${!this.aiSettingEnabled ? '（通过设置）' : '（由你的 GitKraken 管理员禁用）'}</span
							>
						</span>
						${!this.aiSettingEnabled
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
}

const featureMap = new Map<IntegrationFeatures, string>([
	['prs', '拉取请求'],
	['issues', '问题'],
]);

function getIntegrationDetails(integration: IntegrationState): string {
	const features = integration.supports.map(feature => featureMap.get(feature)!);

	if (features.length === 0) return '';
	if (features.length === 1) return `支持 ${features[0]}`;

	const last = features.pop();
	return `支持 ${features.join('、')}，以及 ${last}`;
}

function createStatusIconFilter(integrations: IntegrationState[]) {
	const groupedIconMap = new Map<string, IntegrationState>();

	// Group the integrations by icon, and if one is connected
	for (const integration of integrations) {
		const existing = groupedIconMap.get(integration.icon);
		if (!existing || (integration.connected && !existing.connected)) {
			groupedIconMap.set(integration.icon, integration);
		}
	}

	return (integration: IntegrationState) => groupedIconMap.get(integration.icon) === integration;
}
