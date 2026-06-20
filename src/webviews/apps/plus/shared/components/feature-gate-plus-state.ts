import { consume } from '@lit/context';
import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { urls } from '../../../../../constants.js';
import {
	proFeaturePreviewUsages,
	proTrialLengthInDays,
	SubscriptionState,
} from '../../../../../constants.subscription.js';
import type { Source } from '../../../../../constants.telemetry.js';
import type { FeaturePreview } from '../../../../../features.js';
import { getFeaturePreviewStatus } from '../../../../../features.js';
import type { SubscriptionUpgradeCommandArgs } from '../../../../../plus/gk/models/subscription.js';
import { createCommandLink } from '../../../../../system/commands.js';
import type { GlButton } from '../../../shared/components/button.js';
import type { PromosContext } from '../../../shared/contexts/promos.js';
import { promosContext } from '../../../shared/contexts/promos.js';
import { linkStyles } from './vscode.css.js';
import '../../../shared/components/button.js';
import '../../../shared/components/promo.js';

declare global {
	interface HTMLElementTagNameMap {
		'gl-feature-gate-plus-state': GlFeatureGatePlusState;
	}

	// interface GlobalEventHandlersEventMap {}
}

@customElement('gl-feature-gate-plus-state')
export class GlFeatureGatePlusState extends LitElement {
	static override styles = [
		css`
			:host {
				--gk-action-radius: 0.3rem;

				--link-foreground: var(--vscode-textLink-foreground);
				--link-foreground-active: var(--vscode-textLink-activeForeground);
			}

			:host([appearance='alert']) {
				--link-decoration-default: underline;
				--link-foreground: color-mix(in srgb, var(--section-foreground) 50%, var(--vscode-textLink-foreground));
				--link-foreground-active: color-mix(
					in srgb,
					var(--section-foreground) 50%,
					var(--vscode-textLink-activeForeground)
				);
			}

			:host([appearance='default']) gl-button:only-child {
				width: 100%;
				max-width: 300px;
			}

			@container (max-width: 600px) {
				:host([appearance='default']) gl-button:not(.inline) {
					display: block;
					margin-left: auto;
					margin-right: auto;
				}
			}

			:host([appearance='alert']) gl-button:not(.inline) {
				display: block;
				margin-left: auto;
				margin-right: auto;
			}

			:host-context([appearance='alert']) p:first-child {
				margin-top: 0;
			}

			:host-context([appearance='alert']) p:last-child {
				margin-bottom: 0;
			}

			.centered {
				text-align: center;
			}

			.preview-image {
				width: 100%;
			}

			.actions-row {
				display: flex;
				gap: 0.6em;
				align-items: baseline;
				justify-content: center;
				white-space: nowrap;
			}

			/* Like .actions-row but center-aligned, for a row that mixes a text button with an
			   icon-only button: their baselines don't match (a text baseline vs the synthesized
			   bottom edge of the icon button's flex box), so centering the equal-height button
			   boxes is what lines them up. */
			.actions-row-center {
				display: flex;
				gap: 0.6em;
				align-items: center;
				justify-content: center;
				white-space: nowrap;
			}

			.hint {
				border-bottom: 1px dashed currentColor;
			}

			hr {
				border: none;
				border-top: 1px solid color-mix(in srgb, var(--section-border-color) 20%, transparent);
			}
		`,
		linkStyles,
	];

	@query('gl-button')
	private readonly button!: GlButton;

	@property()
	appearance?: 'alert' | 'default';

	@property({ type: Object })
	featurePreview?: FeaturePreview;

	@property()
	featurePreviewCommandLink?: string;

	@property()
	featureRestriction?: 'all' | 'private-repos';

	@property()
	featureWithArticleIfNeeded?: string;

	@consume({ context: promosContext })
	private promos!: PromosContext;

	@property({ type: Object })
	source?: Source;

	@property({ attribute: false, type: Number })
	state?: SubscriptionState;

	@property()
	webroot?: string;

	protected override firstUpdated(): void {
		if (this.appearance === 'alert') {
			queueMicrotask(() => this.button.focus());
		}
	}

	override render(): unknown {
		const hidden = this.state == null;
		// eslint-disable-next-line lit/no-this-assign-in-render
		this.hidden = hidden;
		if (hidden) return undefined;

		switch (this.state) {
			case SubscriptionState.VerificationRequired:
				return html`
					<slot name="feature"></slot>
					<p class="actions-row-center">
						<gl-button
							class="inline"
							href="${createCommandLink<Source>('gitlens.plus.resendVerification', this.source)}"
							>重新发送邮件</gl-button
						>
						<gl-button
							class="inline"
							href="${createCommandLink<Source>('gitlens.plus.validate', this.source)}"
							><code-icon icon="refresh"></code-icon
						></gl-button>
					</p>
					<hr />
					<p class="centered">继续前请先验证你的邮箱。</p>
				`;

			case SubscriptionState.Community:
				if (this.featurePreview && getFeaturePreviewStatus(this.featurePreview) !== 'expired') {
					return html`${this.renderFeaturePreview(this.featurePreview)}`;
				}

				return html`<slot name="feature"></slot>
					<p class="centered">
						${this.featureRestriction === 'private-repos'
							? html`使用 <a href="${urls.communityVsPro}">GitLens Pro</a> 为私有托管仓库解锁此功能。`
							: html`使用 <a href="${urls.communityVsPro}">GitLens Pro</a> 解锁此功能。`}
					</p>
					<p class="actions-row">
						<gl-button
							class="inline"
							href="${createCommandLink<Source>('gitlens.plus.signUp', this.source)}"
							>&nbsp;试用 GitLens Pro&nbsp;</gl-button
						><span
							>或
							<a href="${createCommandLink<Source>('gitlens.plus.login', this.source)}" title="登录"
								>登录</a
							></span
						>
					</p>
					<hr />
					<p class="centered">
						免费体验 <a href="${urls.communityVsPro}">GitLens Pro</a> ${proTrialLengthInDays}
						天，无需信用卡。
					</p>`;

			case SubscriptionState.TrialExpired:
				return html`<slot name="feature"></slot>
					<p class="centered">
						${this.featureRestriction === 'private-repos'
							? html`使用 <a href="${urls.communityVsPro}">GitLens Pro</a> 为私有托管仓库解锁此功能。`
							: html`使用 <a href="${urls.communityVsPro}">GitLens Pro</a> 解锁此功能。`}
					</p>
					<p class="actions-row">
						<gl-button
							class="inline"
							href="${createCommandLink<SubscriptionUpgradeCommandArgs>('gitlens.plus.upgrade', {
								plan: 'pro',
								...(this.source ?? { source: 'feature-gate' }),
							})}"
							>升级到 Pro</gl-button
						>
					</p>
					<hr />
					<p class="centered">
						你的试用已结束 — 升级以继续使用 ${this.featureWithArticleIfNeeded ?? '所有专业版功能。'}
					</p>
					<p class="centered">${this.renderPromo()}</p>`;

			case SubscriptionState.TrialReactivationEligible:
				return html`<slot name="feature"></slot>
					<p class="actions-row">
						<gl-button
							class="inline"
							href="${createCommandLink<Source>('gitlens.plus.reactivateProTrial', this.source)}"
							>继续</gl-button
						>
					</p>
					<hr />
					<p class="centered">
						重新激活你的 GitLens Pro 试用，再次免费体验
						${this.featureWithArticleIfNeeded ? `${this.featureWithArticleIfNeeded} 和` : ''}所有新 Pro
						功能， 额外获得 ${proTrialLengthInDays} 天！
					</p> `;
		}

		return undefined;
	}

	private renderFeaturePreview(featurePreview: FeaturePreview) {
		const appearance = (this.appearance ?? 'alert') === 'alert' ? 'alert' : undefined;
		const used = featurePreview.usages.length;

		if (used === 0) {
			return html`<slot name="feature"></slot>
				<p class="actions-row">
					<gl-button href="${ifDefined(this.featurePreviewCommandLink)}">继续</gl-button>
				</p>
				<hr />
				<p class="centered">
					已有账户？
					<a href="${createCommandLink<Source>('gitlens.plus.login', this.source)}" title="登录">登录</a
					><br />
					${appearance !== 'alert' ? html`<br />` : ''}
					<a href="${createCommandLink<Source>('gitlens.plus.signUp', this.source)}"
						>想要完整使用所有专业版功能？开始免费试用 ${proTrialLengthInDays} 天 GitLens Pro</a
					>
					— 无需信用卡。
				</p> `;
		}

		const left = proFeaturePreviewUsages - used;

		return html`
			${this.renderFeaturePreviewStep(featurePreview, used)}
			<p class="actions-row">
				<gl-button class="inline" href="${ifDefined(this.featurePreviewCommandLink)}">继续预览</gl-button
				><span
					>或
					<a href="${createCommandLink<Source>('gitlens.plus.login', this.source)}" title="登录"
						>登录</a
					></span
				>
			</p>
			<hr />
			<p class="centered">
				继续后，你还可以再预览 ${left} 次
				${this.featureWithArticleIfNeeded ? this.featureWithArticleIfNeeded : '此功能'}（限私有托管仓库）。<br />
				${appearance !== 'alert' ? html`<br />` : ''}若要完整使用所有 GitLens Pro 功能，
				<a href="${createCommandLink<Source>('gitlens.plus.signUp', this.source)}"
					>开始免费试用 ${proTrialLengthInDays} 天 GitLens Pro</a
				>
				— 无需信用卡。
			</p>
		`;
	}

	private renderFeaturePreviewStep(featurePreview: FeaturePreview, used: number) {
		switch (featurePreview.feature) {
			case 'graph':
				switch (used) {
					case 1:
						return html`<p>试试提交搜索</p>
							<p>
								可按作者、提交消息、SHA、文件、变更或类型在仓库中搜索提交。启用提交过滤器后，
								将仅显示与你查询匹配的提交。
							</p>
							<p>
								<img
									class="preview-image"
									src="${this.webroot ?? ''}/media/graph-commit-search.webp"
									alt="提交图搜索"
								/>
							</p> `;

					case 2:
						return html`
							<p>试试图小地图</p>
							<p>可视化仓库随时间变化的更改量，并在历史中的特定位置查看分支、存储、标签和拉取请求。</p>
							<p>
								<img
									class="preview-image"
									src="${this.webroot ?? ''}/media/graph-minimap.webp"
									alt="图小地图"
								/>
							</p>
						`;

					default:
						return html`<slot name="feature"></slot>`;
				}

			default:
				return html`<slot name="feature"></slot>`;
		}
	}

	private renderPromo() {
		return html`<gl-promo
			.promoPromise=${this.promos.getApplicablePromo(undefined, 'gate')}
			.source=${this.source}
		></gl-promo>`;
	}
}
