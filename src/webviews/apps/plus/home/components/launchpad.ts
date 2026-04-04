import { consume } from '@lit/context';
import { SignalWatcher } from '@lit-labs/signals';
import type { TemplateResult } from 'lit';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { ConnectCloudIntegrationsCommandArgs } from '../../../../../commands/cloudIntegrations.js';
import type { LaunchpadCommandArgs } from '../../../../../plus/launchpad/launchpad.js';
import { createCommandLink } from '../../../../../system/commands.js';
import type { GetLaunchpadSummaryResponse, State } from '../../../../home/protocol.js';
import { DidChangeLaunchpad, GetLaunchpadSummary } from '../../../../home/protocol.js';
import { stateContext } from '../../../home/context.js';
import { AsyncComputedState } from '../../../shared/components/signal-utils.js';
import { ipcContext } from '../../../shared/contexts/ipc.js';
import type { WebviewContext } from '../../../shared/contexts/webview.js';
import { webviewContext } from '../../../shared/contexts/webview.js';
import type { Disposable } from '../../../shared/events.js';
import type { HostIpc } from '../../../shared/ipc.js';
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

			.launchpad-action:hover span {
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
		`,
	];

	@consume<State>({ context: stateContext, subscribe: true })
	@state()
	private _homeState!: State;

	@consume({ context: ipcContext })
	private _ipc!: HostIpc;

	@consume({ context: webviewContext })
	private _webview!: WebviewContext;

	private _disposable: Disposable[] = [];

	// private _summary = signal<GetLaunchpadSummaryResponse | undefined>(undefined);

	private _summaryState = new AsyncComputedState<LaunchpadSummary>(async _abortSignal => {
		const rsp = await this._ipc.sendRequest(GetLaunchpadSummary, {});
		return rsp;
	});

	get startWorkCommand(): string {
		return this._webview.createCommandLink('gitlens.startWork:');
	}

	get createBranchCommand(): string {
		return this._webview.createCommandLink('gitlens.createBranch:');
	}

	override connectedCallback(): void {
		super.connectedCallback?.();

		this._disposable.push(
			this._ipc.onReceiveMessage(msg => {
				switch (true) {
					case DidChangeLaunchpad.is(msg):
						this._summaryState.run(true);
						break;
				}
			}),
		);

		this._summaryState.run();
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback?.();

		this._disposable.forEach(d => d.dispose());
	}

	override render(): unknown {
		return html`
			<gl-section ?loading=${this._summaryState.computed.status === 'pending'}>
				<span slot="heading">启动台</span>
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
		if (this._homeState.hasAnyIntegrationConnected === false) {
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

		return this._summaryState.render({
			pending: () => this.renderPending(),
			complete: summary => this.renderSummary(summary),
			error: () =>
				html`<ul class="menu">
					<li>加载摘要时出错</li>
				</ul>`,
		});
	}

	private renderPending() {
		if (this._summaryState.state == null) {
			return html`
				<div class="loader">
					<skeleton-loader lines="1"></skeleton-loader>
					<skeleton-loader lines="1"></skeleton-loader>
				</div>
			`;
		}
		return this.renderSummary(this._summaryState.state);
	}

	private renderSummary(summary: LaunchpadSummary | undefined) {
		if (summary == null) return nothing;

		if ('error' in summary) {
			return html`<ul class="menu">
				<li>无法加载项目</li>
			</ul>`;
		}

		if (summary.total === 0) {
			return html`<ul class="menu">
				<li>你已全部处理完毕！</li>
			</ul>`;
		}
		if (!summary.hasGroupedItems) {
			return html`<ul class="menu">
				<li>没有需要你关注的拉取请求</li>
				<li>（另外还有 ${summary.total} 个拉取请求）</li>
			</ul>`;
		}

		const result: TemplateResult[] = [];
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
