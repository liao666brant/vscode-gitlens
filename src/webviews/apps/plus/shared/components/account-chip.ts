import { consume } from '@lit/context';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { when } from 'lit/directives/when.js';
import { urls } from '../../../../../constants.js';
import { proTrialLengthInDays, SubscriptionState } from '../../../../../constants.subscription.js';
import type { Source } from '../../../../../constants.telemetry.js';
import type { PromoPlans } from '../../../../../plus/gk/models/promo.js';
import type { SubscriptionUpgradeCommandArgs } from '../../../../../plus/gk/models/subscription.js';
import {
	compareSubscriptionPlans,
	getSubscriptionPlanName,
	getSubscriptionProductPlanNameFromState,
	getSubscriptionTimeRemaining,
	isSubscriptionPaid,
	isSubscriptionTrial,
	isSubscriptionTrialOrPaidFromState,
} from '../../../../../plus/gk/utils/subscription.utils.js';
import { createCommandLink } from '../../../../../system/commands.js';
import type { State } from '../../../../home/protocol.js';
import { stateContext } from '../../../home/context.js';
import type { GlPopover } from '../../../shared/components/overlays/popover.js';
import type { GlPromo } from '../../../shared/components/promo.js';
import { focusableBaseStyles } from '../../../shared/components/styles/lit/a11y.css.js';
import { elementBase, linkBase } from '../../../shared/components/styles/lit/base.css.js';
import type { PromosContext } from '../../../shared/contexts/promos.js';
import { promosContext } from '../../../shared/contexts/promos.js';
import { chipStyles } from './chipStyles.js';
import { ruleStyles } from './vscode.css.js';
import '../../../shared/components/button.js';
import '../../../shared/components/button-container.js';
import '../../../shared/components/code-icon.js';
import '../../../shared/components/overlays/popover.js';

@customElement('gl-account-chip')
export class GlAccountChip extends LitElement {
	static override shadowRootOptions: ShadowRootInit = {
		...LitElement.shadowRootOptions,
		delegatesFocus: true,
	};

	static override styles = [
		elementBase,
		linkBase,
		focusableBaseStyles,
		chipStyles,
		ruleStyles,
		css`
			:host {
				display: inline-flex;
				align-items: center;
				gap: 0.8rem;
			}

			:host-context(.vscode-dark),
			:host-context(.vscode-high-contrast) {
				--gl-account-chip-color: color-mix(in lab, var(--vscode-sideBar-background), #fff 10%);
				--gl-account-chip-media-color: color-mix(in lab, var(--vscode-sideBar-background), #fff 25%);
				--gl-account-account-media-color: color-mix(in lab, var(--vscode-sideBar-background), #fff 20%);
			}

			:host-context(.vscode-light),
			:host-context(.vscode-high-contrast-light) {
				--gl-account-chip-color: color-mix(in lab, var(--vscode-sideBar-background), #000 7%);
				--gl-account-chip-media-color: color-mix(in lab, var(--vscode-sideBar-background), #000 18%);
				--gl-account-account-media-color: color-mix(in lab, var(--vscode-sideBar-background), #000 15%);
			}

			.chip {
				padding-right: 0.6rem;

				font-size: 1.1rem;
				font-weight: 400;
				text-transform: uppercase;
				line-height: 2rem;
				background-color: var(--gl-account-chip-color);
			}

			.chip--outlined {
				background-color: transparent;
				border: 1px solid var(--gl-account-chip-color);
			}

			.chip__media {
				flex: 0 0 auto;
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 0.2rem;
			}

			img.chip__media {
				width: 1.6rem;
				aspect-ratio: 1 / 1;
				border-radius: 50%;
				background-color: var(--gl-account-chip-media-color);
			}

			.chip-group {
				display: inline-flex;
				flex-direction: row;
				gap: 0.8rem;
				cursor: pointer;
			}

			.account-info {
				display: flex;
				flex-direction: column;
				gap: 0.2rem;
			}

			.row {
				position: relative;
				display: flex;
				flex-direction: row;
				gap: 0 0.6rem;
				align-items: center;
			}

			.row:last-of-type {
				margin-bottom: 0.6rem;
			}

			.row__media {
				flex: 0 0 auto;
				width: 3.4rem;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.row__media code-icon {
				color: var(--color-foreground--65);
			}

			.row__media img {
				width: 2rem;
				aspect-ratio: 1 / 1;
				border-radius: 50%;
				background-color: var(--gl-account-account-media-color);
			}

			.details {
				flex: 1;
				display: flex;
				flex-direction: column;
				justify-content: center;
			}

			.details__title {
				font-size: 1.3rem;
				font-weight: 600;
				margin: 0;
			}

			.details__subtitle {
				font-size: 1.1rem;
				font-weight: 400;
				margin: 0;
				color: var(--color-foreground--65);
			}

			.details__button {
				flex: none;
				display: flex;
				gap: 0.2rem;
				flex-direction: row;
				align-items: center;
				justify-content: center;
			}

			.org__badge {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 2.4rem;
				height: 2.4rem;
				line-height: 2.4rem;
				font-size: 1rem;
				font-weight: 600;
				color: var(--color-foreground--65);
				background-color: var(--vscode-toolbar-hoverBackground);
				border-radius: 50%;
				margin-right: 0.6rem;
			}

			.account-status > :first-child {
				margin-block-start: 0;
			}
			.account-status > :last-child {
				margin-block-end: 0;
			}

			button-container {
				margin-bottom: 1.3rem;
			}

			button-container .button-suffix {
				display: inline-flex;
				align-items: center;
				white-space: nowrap;
				gap: 0.2em;
				margin-left: 0.4rem;
			}

			.upgrade > * {
				margin-block: 0.8rem 0;
			}

			.upgrade ul {
				padding-inline-start: 2rem;
			}

			.upgrade li {
				text-wrap: pretty;
			}

			.upgrade gl-promo::part(text) {
				margin-block-start: 0;
				/* border-radius: 0.3rem;
				padding: 0.2rem 0.4rem;
				background-color: var(--gl-account-chip-color); */
			}

			.upgrade gl-promo:not([has-promo]) {
				display: none;
			}

			.upgrade-button {
				text-transform: uppercase;
				font-size: 1rem;
			}
		`,
	];

	private _showUpgrade = false;
	@property({ type: Boolean, reflect: true, attribute: 'show-upgrade' })
	get showUpgrade() {
		return this._showUpgrade;
	}
	private set showUpgrade(value: boolean) {
		this._showUpgrade = value;
	}

	@query('#chip')
	private _chip!: HTMLElement;

	@query('gl-popover')
	private _popover!: GlPopover;

	@consume<State>({ context: stateContext, subscribe: true })
	@state()
	private _state!: State;

	private get accountAvatar() {
		return this.hasAccount && this._state.avatar;
	}

	private get accountName() {
		return this.subscription?.account?.name ?? '';
	}

	private get accountEmail() {
		return this.subscription?.account?.email ?? '';
	}

	private get hasAccount() {
		return this.subscription?.account != null;
	}

	get isReactivatedTrial(): boolean {
		return (
			this.subscriptionState === SubscriptionState.Trial &&
			(this.subscription?.plan.effective.trialReactivationCount ?? 0) > 0
		);
	}
	private get planId() {
		return this._state.subscription?.plan.actual.id ?? 'pro';
	}
	private get effectivePlanId() {
		return this._state.subscription?.plan.effective.id ?? 'pro';
	}

	private get planName() {
		return getSubscriptionProductPlanNameFromState(this.subscriptionState, this.planId, this.effectivePlanId);
	}

	private get planTier() {
		if (isSubscriptionTrial(this.subscription)) {
			return this.subscription.plan.effective.id === 'student' ? 'Student' : 'Pro Trial';
		}

		return getSubscriptionPlanName(this.planId);
	}

	private get planTierLabel() {
		if (isSubscriptionTrial(this.subscription)) {
			return this.subscription.plan.effective.id === 'student' ? '学生试用' : 'Pro 试用';
		}

		return this.planTier;
	}

	private get isStudentTrialPlan() {
		return isSubscriptionTrial(this.subscription) && this.subscription.plan.effective.id === 'student';
	}

	@consume({ context: promosContext })
	private promos!: PromosContext;

	private get subscription() {
		return this._state.subscription;
	}

	private get subscriptionState() {
		return this.subscription?.state;
	}

	private get trialDaysRemaining() {
		if (this.subscription == null) return 0;

		return getSubscriptionTimeRemaining(this.subscription, 'days') ?? 0;
	}

	override focus(): void {
		this._chip.focus();
	}

	override render(): unknown {
		return html`<gl-popover placement="bottom" trigger="hover focus click" hoist>
				<span id="chip" slot="anchor" class="chip" tabindex="0" aria-label="打开账户菜单">
					${this.accountAvatar
						? html`<img class="chip__media" src=${this.accountAvatar} />`
						: html`<code-icon class="chip__media" icon="gl-gitlens" size="16"></code-icon>`}
					<span>${this.planTierLabel}</span>
				</span>
				<div slot="content" class="content" tabindex="-1">
					<div class="header">
						<span class="header__title">${this.planName}</span>
						<span class="header__actions">
							${this.hasAccount
								? html`<gl-button
											appearance="toolbar"
											href="${createCommandLink<Source>('gitlens.plus.validate', {
												source: 'account',
											})}"
											tooltip="同步状态"
											aria-label="同步状态"
											><code-icon icon="sync"></code-icon
										></gl-button>
										<gl-button
											appearance="toolbar"
											href="${createCommandLink<Source>('gitlens.plus.manage', {
												source: 'account',
											})}"
											tooltip="管理账户"
											aria-label="管理账户"
											><code-icon icon="gear"></code-icon
										></gl-button>
										<gl-button
											appearance="toolbar"
											href="${createCommandLink<Source>('gitlens.plus.logout', {
												source: 'account',
											})}"
											tooltip="退出登录"
											aria-label="退出登录"
											><code-icon icon="sign-out"></code-icon
										></gl-button>`
								: nothing}
						</span>
					</div>
					${this.renderAccountInfo()} ${this.renderAccountState()}
				</div>
			</gl-popover>
			${this.renderUpgradeContent()}`;
	}

	show(): void {
		void this._popover.show();
		this.focus();
	}

	private renderAccountInfo() {
		const organization = this._state.subscription?.activeOrganization?.name ?? '';
		if (!this.hasAccount || !organization) return nothing;

		return html`<div class="account-info">
			<span class="row">
				<span class="row__media"
					>${this._state.avatar
						? html`<img src=${this._state.avatar} />`
						: html`<code-icon icon="gl-gitlens" size="20"></code-icon>`}</span
				>
				<span class="details"
					><p class="details__title">${this.accountName}</p>
					<p class="details__subtitle">${this.accountEmail}</p></span
				>
			</span>
			<span class="row">
				<span class="row__media"><code-icon icon="organization" size="20"></code-icon></span>
				<span class="details"><p class="details__title">${organization}</p></span>
				${when(
					this._state.organizationsCount! > 1,
					() =>
						html`<div class="details__button">
							<gl-button
								appearance="toolbar"
								href="${createCommandLink<Source>('gitlens.gk.switchOrganization', {
									source: 'account',
									detail: {
										organization: this._state.subscription?.activeOrganization?.id,
									},
								})}"
								aria-label="切换当前组织"
								><span class="org__badge">+${this._state.organizationsCount! - 1}</span
								><code-icon icon="arrow-swap"></code-icon
								><span slot="tooltip"
									>切换当前组织
									<hr />
									你当前还位于 ${this._state.organizationsCount! - 1} 个其他组织中</span
								></gl-button
							>
						</div>`,
				)}
			</span>
			${when(
				isSubscriptionTrialOrPaidFromState(this.subscription.state),
				() =>
					html`<span class="row">
						<span class="row__media"><code-icon icon="unlock" size="20"></code-icon></span>
						<span class="details"
							><p class="details__title">
								${isSubscriptionTrial(this.subscription)
									? html`${getSubscriptionPlanName(this.effectivePlanId)} 计划
											<span class="details__subtitle">（试用）</span>`
									: html`${getSubscriptionPlanName(this.planId)} 计划`}
							</p></span
						>
						${isSubscriptionPaid(this.subscription) && compareSubscriptionPlans(this.planId, 'advanced') < 0
							? html`<div class="details__button">
									<gl-button
										appearance="secondary"
										href="${createCommandLink<SubscriptionUpgradeCommandArgs>(
											'gitlens.plus.upgrade',
											{
												plan: 'advanced',
												source: 'account',
												detail: {
													location: 'plan-section:upgrade-button',
													organization: this._state.subscription?.activeOrganization?.id,
													plan: 'advanced',
												},
											},
										)}"
										aria-label="升级到 Advanced"
										><span class="upgrade-button">升级</span>${this.renderPromo(
											'advanced',
											'icon',
											'suffix',
										)}
										<span slot="tooltip"
											>升级到 Advanced 计划，以使用自托管集成、高级 AI 功能（每周 1M tokens）等
											${this.renderPromo('advanced', 'info')}
										</span>
									</gl-button>
								</div>`
							: nothing}
					</span>`,
			)}
		</div>`;
	}

	private renderAccountState() {
		switch (this.subscriptionState) {
			case SubscriptionState.Paid:
				return html`<div class="account-status">
					${this.renderIncludesDevEx()}${this.renderReferFriend()}
				</div> `;

			case SubscriptionState.VerificationRequired:
				return html`<div class="account-status">
					<p>访问 Pro 功能前，你必须先验证邮箱。</p>
					<button-container layout="editor">
						<gl-button
							full
							href="${createCommandLink<Source>('gitlens.plus.resendVerification', {
								source: 'account',
							})}"
							>重新发送邮件</gl-button
						>
						<gl-button
							appearance="secondary"
							href="${createCommandLink<Source>('gitlens.plus.validate', {
								source: 'account',
							})}"
							><code-icon size="20" icon="refresh"></code-icon>
						</gl-button>
					</button-container>
				</div>`;

			case SubscriptionState.Trial: {
				const days = this.trialDaysRemaining;

				return html`<div class="account-status">
					${this.isReactivatedTrial
						? html`<p>
								<code-icon icon="megaphone"></code-icon>
								查看 GitLens
								<a href="${urls.releaseNotes}">新功能</a>
							</p>`
						: nothing}
					<p>
						你的 ${this.isStudentTrialPlan ? '学生版' : 'Pro'} 试用还剩
						<strong>${days < 1 ? '少于 1 天' : `${days} 天`}</strong
						>。试用结束后，你将只能在公开托管的仓库中使用 Pro 功能。
					</p>
					<button-container layout="editor">
						<gl-button
							full
							href="${createCommandLink<SubscriptionUpgradeCommandArgs>('gitlens.plus.upgrade', {
								plan: 'pro',
								source: 'account',
								detail: {
									location: 'upgrade-button',
									organization: this._state.subscription?.activeOrganization?.id,
									plan: 'pro',
								},
							})}"
							>升级到 Pro</gl-button
						>
					</button-container>
					${this.renderPromo('pro')} ${this.renderIncludesDevEx()} ${this.renderReferFriend()}
				</div>`;
			}

			case SubscriptionState.TrialExpired:
				return html`<div class="account-status">
					<p>感谢你试用 <a href="${urls.communityVsPro}">GitLens Pro</a>。</p>
					<p>立即升级，以继续在私有托管仓库中使用 Pro 功能和工作流。</p>
					<button-container layout="editor">
						<gl-button
							full
							href="${createCommandLink<SubscriptionUpgradeCommandArgs>('gitlens.plus.upgrade', {
								plan: 'pro',
								source: 'account',
								detail: {
									location: 'upgrade-button',
									organization: this._state.subscription?.activeOrganization?.id,
									plan: 'pro',
								},
							})}"
							>升级到 Pro</gl-button
						>
					</button-container>
					${this.renderPromo('pro')} ${this.renderIncludesDevEx()} ${this.renderReferFriend()}
				</div>`;

			case SubscriptionState.TrialReactivationEligible:
				return html`<div class="account-status">
					<p>
						重新激活你的 GitLens Pro 试用，再次免费体验所有新 Pro 功能，额外获得 ${proTrialLengthInDays}
						天。
					</p>
					<button-container layout="editor">
						<gl-button
							full
							href="${createCommandLink<Source>('gitlens.plus.reactivateProTrial', {
								source: 'account',
							})}"
							tooltip="再次激活你的 Pro 试用，额外获得 ${proTrialLengthInDays} 天"
							>重新激活 GitLens Pro 试用</gl-button
						>
					</button-container>
					${this.renderReferFriend()}
				</div>`;

			default:
				return html`<div class="account-status">
					<p>
						解锁私有仓库的高级功能和工作流，加速评审并简化协作，
						<a href="${urls.communityVsPro}">GitLens Pro</a>。
					</p>
					<button-container layout="editor">
						<gl-button
							full
							href="${createCommandLink<Source>('gitlens.plus.signUp', {
								source: 'account',
							})}"
							>试用 GitLens Pro</gl-button
						>
						<span class="button-suffix"
							>或
							<a
								href="${createCommandLink<Source>('gitlens.plus.login', {
									source: 'account',
								})}"
								>登录</a
							></span
						>
					</button-container>
					<p>免费体验 ${proTrialLengthInDays} 天 GitLens Pro —— 无需信用卡。</p>
				</div>`;
		}
	}

	private renderIncludesDevEx() {
		return html`<p>包含对 <a href="${urls.platform}">GitKraken DevEx 平台</a> 的访问权限</p>`;
	}

	private renderReferFriend() {
		if (!isSubscriptionPaid(this.subscription)) return nothing;

		return html`<p>
			<a
				href="${createCommandLink<Source>('gitlens.plus.referFriend', {
					source: 'account',
				})}"
				>推荐好友</a
			>
			&mdash; 送出 5 折优惠，并获得最高 $20 奖励
		</p>`;
	}

	private renderUpgradeContent() {
		if (isSubscriptionPaid(this.subscription)) {
			this.showUpgrade = false;
			return nothing;
		}

		this.showUpgrade = true;

		return html`<gl-popover placement="bottom" trigger="hover focus click" hoist>
			<span slot="anchor" class="chip chip--outlined" tabindex="0" aria-label="打开升级选项">
				<span>升级</span>
			</span>
			<div slot="content" class="content" tabindex="-1">
				<div class="header">
					<span class="header__title">GitLens Pro 的优势</span>
				</div>
				<div class="upgrade">
					<button-container layout="editor">
						<gl-button
							full
							href="${createCommandLink<SubscriptionUpgradeCommandArgs>('gitlens.plus.upgrade', {
								plan: 'pro',
								source: 'account',
								detail: {
									location: 'upgrade-chip:upgrade-button',
									organization: this._state.subscription?.activeOrganization?.id,
									plan: 'pro',
								},
							})}"
							>升级到 Pro</gl-button
						>
					</button-container>
					${this.renderPromo('pro')}

					<ul>
						<li>无限云集成</li>
						<li>智能 AI 功能 &mdash; 每周 250K tokens</li>
						<li>强大工具 &mdash; 私有仓库可用的提交图、可视化历史和 Git 工作树</li>
						<li>精简工作流 &mdash; 从问题开始工作、处理拉取请求评审</li>
					</ul>

					<br />
					<button-container>
						<gl-button
							full
							href="${createCommandLink<SubscriptionUpgradeCommandArgs>('gitlens.plus.upgrade', {
								plan: 'advanced',
								source: 'account',
								detail: {
									location: 'upgrade-chip:upgrade-button',
									organization: this._state.subscription?.activeOrganization?.id,
									plan: 'advanced',
								},
							})}"
							>升级到 Advanced</gl-button
						>
					</button-container>
					${this.renderPromo('advanced')}

					<ul>
						<li>自托管集成</li>
						<li>高级 AI 功能 &mdash; 每周 1M tokens</li>
					</ul>
				</div>
			</div>
		</gl-popover>`;
	}

	private renderPromo(plan: PromoPlans, type: GlPromo['type'] = 'info', slot?: string): unknown {
		return html`<gl-promo
			slot=${ifDefined(slot)}
			.promoPromise=${this.promos.getApplicablePromo(plan, 'account')}
			.type=${type}
			.source="${{ source: 'account' } as const}"
		></gl-promo>`;
	}
}
