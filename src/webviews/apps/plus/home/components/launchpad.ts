import { consume } from '@lit/context';
import { SignalWatcher } from '@lit-labs/signals';
import type { TemplateResult } from 'lit';
import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { ConnectCloudIntegrationsCommandArgs } from '../../../../../commands/cloudIntegrations.js';
import type { LaunchpadCommandArgs } from '../../../../../plus/launchpad/launchpad.js';
import { createCommandLink } from '../../../../../system/commands.js';
import type { GetLaunchpadSummaryResponse } from '../../../../home/protocol.js';
import { fetchLaunchpadSummary } from '../../../home/actions.js';
import type { IntegrationsState } from '../../../shared/contexts/integrations.js';
import { integrationsContext } from '../../../shared/contexts/integrations.js';
import type { LaunchpadState } from '../../../shared/contexts/launchpad.js';
import { launchpadContext } from '../../../shared/contexts/launchpad.js';
import type { WebviewContext } from '../../../shared/contexts/webview.js';
import { webviewContext } from '../../../shared/contexts/webview.js';
import { linkStyles } from '../../shared/components/vscode.css.js';
import '../../../shared/components/button.js';
import '../../../shared/components/button-container.js';
import '../../../shared/components/code-icon.js';
import '../../../shared/components/skeleton-loader.js';
import './branch-section.js';

type LaunchpadSummary = GetLaunchpadSummaryResponse;

function formatPullRequestCount(count: number) {
	return `${count} 个拉取请求`;
}

@customElement('gl-launchpad')
export class GlLaunchpad extends SignalWatcher(LitElement) {
	static override shadowRootOptions: ShadowRootInit = {
		...LitElement.shadowRootOptions,
		delegatesFocus: true,
	};

	static override styles = [
		linkStyles,
		css`
			:host {
				display: block;
				margin-bottom: 2.4rem;
				color: var(--vscode-foreground);
			}
			.summary {
				margin-bottom: 1rem;
			}

			.menu {
				list-style: none;
				padding-inline-start: 0;
				margin-block-start: 0;
				display: flex;
				flex-direction: column;
				gap: 0.4rem;
			}

			.launchpad-action {
				display: flex;
				align-items: center;
				gap: 0.6rem;
				color: inherit;
				text-decoration: none;
			}
			.launchpad-action:hover {
				text-decoration: none;
			}

			.launchpad-action:hover:not(span) span {
				text-decoration: underline;
			}

			.launchpad-action__icon {
				color: var(--gl-launchpad-action-color, inherit);
			}

			.launchpad-action:hover .launchpad-action__icon {
				color: var(--gl-launchpad-action-hover-color, inherit);
			}

			.launchpad-action--mergable {
				--gl-launchpad-action-color: var(--vscode-gitlens-launchpadIndicatorMergeableColor);
				--gl-launchpad-action-hover-color: var(--vscode-gitlens-launchpadIndicatorMergeableHoverColor);
			}

			.launchpad-action--blocked {
				--gl-launchpad-action-color: var(--vscode-gitlens-launchpadIndicatorBlockedColor);
				--gl-launchpad-action-hover-color: var(--vscode-gitlens-launchpadIndicatorBlockedHoverColor);
			}

			.launchpad-action--attention {
				--gl-launchpad-action-color: var(--vscode-gitlens-launchpadIndicatorAttentionColor);
				--gl-launchpad-action-hover-color: var(--vscode-gitlens-launchpadIndicatorAttentionHoverColor);
			}

			.loader {
				display: flex;
				flex-direction: column;
				gap: 0.4rem;
			}

			.section-heading-actions {
				flex: none;
				display: flex;
				align-items: center;
			}

			.section-heading-action {
				--button-padding: 0.2rem;
				--button-line-height: 1.2rem;
			}
		`,
	];

	@consume({ context: launchpadContext })
	private _launchpad!: LaunchpadState;

	@consume({ context: integrationsContext })
	private _integrations!: IntegrationsState;

	@consume({ context: webviewContext })
	private _webview!: WebviewContext;

	override connectedCallback(): void {
		super.connectedCallback?.();

		// Fetch launchpad summary on mount — deferred from initial state load
		const launchpad = this._launchpad.service;
		if (launchpad != null) {
			void fetchLaunchpadSummary(this._launchpad, launchpad);
		}
	}

	private onRefreshClicked = (): void => {
		const launchpad = this._launchpad.service;
		if (launchpad == null) return;

		void fetchLaunchpadSummary(this._launchpad, launchpad);
	};

	get startWorkCommand(): string {
		return this._webview.createCommandLink('gitlens.startWork:');
	}

	get createBranchCommand(): string {
		return this._webview.createCommandLink('gitlens.createBranch:');
	}

	override render(): unknown {
		const isLoading = this._launchpad.launchpadLoading.get();
		return html`
			<gl-section ?loading=${isLoading}>
				<span slot="heading">启动台</span>
				<span class="section-heading-actions" slot="heading-actions">
					<gl-button
						aria-busy=${isLoading ? 'true' : 'false'}
						?disabled=${isLoading}
						class="section-heading-action"
						appearance="toolbar"
						tooltip="刷新启动台"
						@click=${this.onRefreshClicked}
						><code-icon icon="refresh"></code-icon
					></gl-button>
				</span>
				<div class="summary">${this.renderSummaryResult()}</div>
				<button-container grouping="gap-wide">
					<gl-button full class="start-work" href=${this.startWorkCommand}>开始处理问题</gl-button>
					<gl-button
						appearance="secondary"
						density="compact"
						class="start-work"
						href=${this.createBranchCommand}
						tooltip="创建新分支"
						aria-label="创建新分支"
						><code-icon icon="custom-start-work"></code-icon
					></gl-button>
				</button-container>
			</gl-section>
		`;
	}

	private renderSummaryResult() {
		if (this._integrations.hasAnyIntegrationConnected.get() === false) {
			return html`<ul class="menu">
				<li>
					<a
						class="launchpad-action"
						href="${createCommandLink<ConnectCloudIntegrationsCommandArgs>(
							'gitlens.plus.cloudIntegrations.connect',
							{ source: { source: 'home' } },
						)}"
					>
						<code-icon class="launchpad-action__icon" icon="plug"></code-icon>
						<span>连接后即可在此查看 PR 和问题</span>
					</a>
				</li>
			</ul>`;
		}

		const summary = this._launchpad.launchpadSummary.get();
		if (summary == null) {
			return this.renderPending();
		}
		return this.renderSummary(summary);
	}

	private renderPending() {
		return html`
			<div class="loader">
				<skeleton-loader lines="1"></skeleton-loader>
				<skeleton-loader lines="1"></skeleton-loader>
			</div>
		`;
	}

	private renderSummary(summary: LaunchpadSummary | undefined) {
		if (summary == null) return nothing;

		// Total failure: error-only object with no summary data
		if (!('total' in summary)) {
			return html`<ul class="menu">
				<li>无法加载项目</li>
			</ul>`;
		}

		const result: TemplateResult[] = [];

		// Partial success: some integrations failed but items were still loaded
		if (summary.error != null) {
			result.push(
				html`<li>
					<span class="launchpad-action">
						<code-icon class="launchpad-action__icon" icon="warning"></code-icon>
						<span>部分集成加载失败</span>
					</span>
				</li>`,
			);
		}

		if (summary.total === 0) {
			result.push(html`<li>你已全部处理完毕！</li>`);
			return html`<ul class="menu">
				${result}
			</ul>`;
		}
		if (!summary.hasGroupedItems) {
			result.push(
				html`<li>没有需要你关注的拉取请求</li>
					<li>（另外还有 ${summary.total} 个拉取请求）</li>`,
			);
			return html`<ul class="menu">
				${result}
			</ul>`;
		}

		for (const group of summary.groups) {
			let total;
			switch (group) {
				case 'mergeable': {
					total = summary.mergeable?.total ?? 0;
					if (total === 0) continue;

					const commandUrl = `command:gitlens.showLaunchpad?${encodeURIComponent(
						JSON.stringify({
							source: 'home',
							state: {
								initialGroup: 'mergeable',
							},
						} satisfies Omit<LaunchpadCommandArgs, 'command'>),
					)}`;
					result.push(
						html`<li>
							<a href=${commandUrl} class="launchpad-action launchpad-action--mergable">
								<code-icon class="launchpad-action__icon" icon="rocket"></code-icon>
								<span>${formatPullRequestCount(total)}可合并</span>
							</a>
						</li>`,
					);
					break;
				}
				case 'blocked': {
					total = summary.blocked?.total ?? 0;
					if (total === 0) continue;

					const messages: { count: number; message: string }[] = [];
					if (summary.blocked!.unassignedReviewers) {
						messages.push({
							count: summary.blocked!.unassignedReviewers,
							message: '需要审阅者',
						});
					}
					if (summary.blocked!.failedChecks) {
						messages.push({
							count: summary.blocked!.failedChecks,
							message: '存在失败的 CI 检查',
						});
					}
					if (summary.blocked!.conflicts) {
						messages.push({
							count: summary.blocked!.conflicts,
							message: '存在冲突',
						});
					}

					const commandUrl = `command:gitlens.showLaunchpad?${encodeURIComponent(
						JSON.stringify({
							source: 'home',
							state: { initialGroup: 'blocked' },
						} satisfies Omit<LaunchpadCommandArgs, 'command'>),
					)}`;
					if (messages.length === 1) {
						result.push(
							html`<li>
								<a href=${commandUrl} class="launchpad-action launchpad-action--blocked">
									<code-icon class="launchpad-action__icon" icon="error"></code-icon>
									<span>${messages[0].count} 个拉取请求${messages[0].message}</span>
								</a>
							</li>`,
						);
					} else {
						result.push(
							html`<li>
								<a href=${commandUrl} class="launchpad-action launchpad-action--blocked">
									<code-icon class="launchpad-action__icon" icon="error"></code-icon>
									<span
										>${formatPullRequestCount(total)}被阻塞
										（${messages.map(m => `${m.count} 个拉取请求${m.message}`).join('，')}）</span
									>
								</a>
							</li>`,
						);
					}

					break;
				}
				case 'follow-up': {
					total = summary.followUp?.total ?? 0;
					if (total === 0) continue;

					const commandUrl = `command:gitlens.showLaunchpad?${encodeURIComponent(
						JSON.stringify({
							source: 'home',
							state: {
								initialGroup: 'follow-up',
							},
						} satisfies Omit<LaunchpadCommandArgs, 'command'>),
					)}`;
					result.push(
						html`<li>
							<a href=${commandUrl} class="launchpad-action launchpad-action--attention">
								<code-icon class="launchpad-action__icon" icon="report"></code-icon>
								<span>${formatPullRequestCount(total)}需要后续处理</span>
							</a>
						</li>`,
					);
					break;
				}
				case 'needs-review': {
					total = summary.needsReview?.total ?? 0;
					if (total === 0) continue;

					const commandUrl = `command:gitlens.showLaunchpad?${encodeURIComponent(
						JSON.stringify({
							source: 'home',
							state: {
								initialGroup: 'needs-review',
							},
						} satisfies Omit<LaunchpadCommandArgs, 'command'>),
					)}`;
					result.push(
						html`<li>
							<a href=${commandUrl} class="launchpad-action launchpad-action--attention">
								<code-icon class="launchpad-action__icon" icon="comment-unresolved"></code-icon>
								<span>${formatPullRequestCount(total)}需要你审阅</span>
							</a>
						</li>`,
					);
					break;
				}
			}
		}

		return html`<menu class="menu">${result}</menu>`;
	}
}
