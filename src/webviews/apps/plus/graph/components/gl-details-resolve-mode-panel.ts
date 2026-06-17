import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type { GitFileChangeShape } from '@gitlens/git/models/fileChange.js';
import { pluralize } from '@gitlens/utils/string.js';
import type {
	ConflictResolutionStrategy,
	ResolvedFileSummary,
	ResolveFileError,
	ResolveSkippedFile,
} from '../../../../plus/graph/graphService.js';
import type { AiModelInfo } from '../../../../rpc/services/types.js';
import { panelErrorStyles, panelHostStyles, panelLoadingStyles } from './shared-panel.css.js';
import { renderErrorState, renderLoadingState } from './shared-panel-templates.js';
import '../../../shared/components/ai-input.js';
import '../../../shared/components/button.js';
import '../../../shared/components/code-icon.js';
import '../../../shared/components/gl-ai-model-chip.js';
import '../../../shared/components/overlays/tooltip.js';

export type ResolveModeStatus = 'idle' | 'loading' | 'ready' | 'error' | 'applying';

export interface ResolveViewDiffDetail {
	filePath: string;
}

export interface ResolveOpenFileDetail {
	filePath: string;
}

/** Friendly label + icon for each conflict-tools resolution strategy. `skipped` is a warning —
 *  the file was intentionally left conflicted and still needs manual attention. */
const strategyDisplay: Record<ConflictResolutionStrategy, { label: string; icon: string; warn?: boolean }> = {
	ai: { label: '已合并', icon: 'git-merge' },
	'take-ours': { label: '保留当前', icon: 'arrow-left' },
	'take-theirs': { label: '采用传入', icon: 'arrow-right' },
	deleted: { label: '已删除', icon: 'trash' },
	skipped: { label: '需要审查', icon: 'warning', warn: true },
};

/**
 * AI conflict-resolution mode panel for the graph WIP details. A third AI mode alongside compose
 * and review — but simpler: no scope picker (it operates on the paused op's conflicted files) and
 * no Back/Resume (apply is terminal). States: `idle` (the conflicted-file list + a Resolve button),
 * `loading` (streamed progress), `ready` (per-file resolutions + Apply/Discard), `applying`
 * (uncancellable overlay), and `error`.
 */
@customElement('gl-details-resolve-mode-panel')
export class GlDetailsResolveModePanel extends LitElement {
	static override styles = [
		panelHostStyles,
		panelLoadingStyles,
		panelErrorStyles,
		css`
			.resolve-panel {
				display: flex;
				flex-direction: column;
				flex: 1;
				min-height: 0;
			}

			.resolve-intro {
				margin: 0.8rem 1.2rem 0.4rem;
				color: var(--vscode-descriptionForeground);
			}

			.resolve-files {
				list-style: none;
				margin: 0.4rem 0;
				padding: 0;
				overflow-y: auto;
			}

			.resolve-file {
				display: flex;
				flex-direction: column;
				gap: 0.2rem;
				padding: 0.5rem 1.2rem;
				border-top: 1px solid var(--vscode-panel-border);
			}

			.resolve-file__head {
				display: flex;
				align-items: center;
				gap: 0.4rem;
			}

			.resolve-file__path {
				font-weight: 600;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				flex: 1;
			}

			/* Idle-state file link — opens the conflicted working-tree file. Mirrors the review
			   panel's .review-area__file-link affordance (hover background + path underline). */
			.resolve-file__link {
				display: flex;
				align-items: center;
				gap: 0.4rem;
				flex: 1;
				min-width: 0;
				margin: -0.2rem -0.4rem;
				padding: 0.2rem 0.4rem;
				font-size: inherit;
				font-family: inherit;
				color: var(--vscode-textLink-foreground);
				background: transparent;
				border: none;
				cursor: pointer;
				text-align: left;
				border-radius: 0.2rem;
			}

			.resolve-file__link:hover {
				background: var(--vscode-list-hoverBackground);
			}

			/* Underline only the path text on hover — without this scope, the rule applies to the
			   whole button and the icon picks up a stray underline at its baseline. */
			.resolve-file__link:hover .resolve-file__path {
				text-decoration: underline;
			}

			.resolve-file__link code-icon {
				color: var(--vscode-foreground);
				opacity: 0.7;
				flex: none;
			}

			.resolve-file__badge {
				display: inline-flex;
				align-items: center;
				gap: 0.3rem;
				flex: none;
				font-size: 1.1rem;
				padding: 0.1rem 0.5rem;
				border-radius: 0.4rem;
				background: var(--vscode-badge-background);
				color: var(--vscode-badge-foreground);
			}

			.resolve-file__badge--warn {
				background: var(--vscode-inputValidation-warningBackground, var(--vscode-badge-background));
				color: var(--vscode-inputValidation-warningForeground, var(--vscode-badge-foreground));
			}

			.resolve-file__reasoning {
				margin: 0;
				color: var(--vscode-descriptionForeground);
				white-space: pre-wrap;
			}

			.resolve-file__error {
				color: var(--vscode-errorForeground);
			}

			.resolve-footer {
				display: flex;
				justify-content: flex-end;
				gap: 0.6rem;
				padding: 0.6rem 1.2rem;
				border-top: 1px solid var(--vscode-panel-border);
				flex: none;
			}

			.resolve-actions {
				display: flex;
				flex-direction: column;
				gap: 0.4rem;
				padding: 0.6rem 1.2rem;
				flex: none;
			}

			.resolve-loading-actions {
				display: flex;
				justify-content: center;
				padding: 0.4rem;
			}

			/* Per-row feedback input, indented under its file. */
			.resolve-file__feedback {
				display: block;
				margin-top: 0.4rem;
			}

			/* Whole-run "Refine" input between the results list and the footer. */
			.resolve-refine {
				display: block;
				flex: none;
				margin: 0.4rem 1.2rem;
			}
		`,
	];

	@property({ attribute: 'status' }) status: ResolveModeStatus = 'idle';
	@property() errorMessage?: string;
	@property({ type: Array }) resolutions?: readonly ResolvedFileSummary[];
	@property({ type: Array }) errors?: readonly ResolveFileError[];
	@property({ type: Array }) skipped?: readonly ResolveSkippedFile[];
	@property({ type: Array }) conflictedFiles?: readonly GitFileChangeShape[];
	/** Scopes the run to these conflicted files (per-file/multi-select entry); undefined = all. */
	@property({ type: Array }) focusedPaths?: readonly string[];
	@property() progressMessage?: string;
	@property({ type: Object }) aiModel?: AiModelInfo;
	/** Paths currently being re-resolved with feedback — drives the per-row busy state. */
	@property({ type: Object }) retryingFiles?: ReadonlySet<string>;
	/** The whole-run prompt, recalled into the "Refine" input (ArrowUp). */
	@property() lastPrompt?: string;

	/** Rows whose per-file feedback input is expanded. Panel-local UI state. */
	@state() private _expandedRetry = new Set<string>();

	override render(): unknown {
		return html`<div class="resolve-panel">${this.renderContent()}</div>`;
	}

	private renderContent(): unknown {
		switch (this.status) {
			case 'loading':
				return this.renderLoading();
			case 'applying':
				return renderLoadingState('正在应用解决方案…');
			case 'error':
				return renderErrorState(
					this.errorMessage,
					'解决冲突时发生错误。',
					'resolve-error-retry',
					'resolve-error-back',
				);
			case 'ready':
				return this.renderReady();
			default:
				return this.renderIdle();
		}
	}

	private renderLoading(): unknown {
		return html`
			${renderLoadingState(this.progressMessage ?? '正在解决冲突…')}
			<div class="resolve-loading-actions">
				<gl-button appearance="secondary" @click=${() => this.emit('resolve-cancel')}>取消</gl-button>
			</div>
		`;
	}

	private renderIdle(): unknown {
		const focused = this.focusedPaths != null && this.focusedPaths.length > 0 ? this.focusedPaths : undefined;
		const files =
			focused != null ? this.conflictedFiles?.filter(f => focused.includes(f.path)) : this.conflictedFiles;
		const count = files?.length ?? 0;

		return html`
			<p class="resolve-intro">
				${focused?.length === 1
					? html`Resolve the conflict in <strong>${focused[0]}</strong> with AI.`
					: html`Resolve ${focused != null ? 'the selected' : ''} ${pluralize('conflicted file', count)} with
						AI. You'll be able to review each resolution before applying.`}
			</p>
			${count > 0
				? html`<ul class="resolve-files" aria-label="冲突文件">
						${repeat(
							files!,
							f => f.path,
							f =>
								html`<li class="resolve-file">
									<div class="resolve-file__head">
										<button
											class="resolve-file__link"
											title="打开文件"
											aria-label="Open ${f.path}"
											@click=${() => this.emit('resolve-open-file', { filePath: f.path })}
										>
											<code-icon icon="git-merge"></code-icon>
											<span class="resolve-file__path">${f.path}</span>
										</button>
									</div>
								</li>`,
						)}
					</ul>`
				: nothing}
			<div class="resolve-actions">
				<gl-ai-input
					multiline
					active
					rows="2"
					button-label=${focused?.length === 1 ? '用 AI 解决文件冲突' : '用 AI 解决冲突'}
					busy-label="正在解决冲突…"
					event-name="resolve-run"
					placeholder='可选指导 — 例如 "优先使用传入的生成文件"'
					?disabled=${count === 0}
					.value=${this.lastPrompt}
				>
					<gl-ai-model-chip slot="footer" .model=${this.aiModel}></gl-ai-model-chip>
				</gl-ai-input>
			</div>
		`;
	}

	private renderReady(): unknown {
		const resolutions = this.resolutions ?? [];
		const errors = this.errors ?? [];
		const skipped = this.skipped ?? [];
		const applicable = resolutions.filter(r => r.strategy !== 'skipped').length;

		return html`
			<ul class="resolve-files" aria-label="已解决文件">
				${repeat(
					resolutions,
					r => r.filePath,
					r => this.renderResolution(r),
				)}
				${repeat(
					skipped,
					s => s.filePath,
					s => this.renderSkipped(s),
				)}
				${repeat(
					errors,
					e => e.filePath,
					e => this.renderError(e),
				)}
			</ul>
			<gl-ai-input
				class="resolve-refine"
				multiline
				rows="2"
				button-label="优化"
				busy-label="正在重新解决…"
				event-name="resolve-refine"
				placeholder='全部优化 — 例如 "优先使用传入的生成文件"'
				.recall=${this.lastPrompt}
			>
				<gl-ai-model-chip slot="footer" .model=${this.aiModel}></gl-ai-model-chip>
			</gl-ai-input>
			<div class="resolve-footer">
				<gl-button appearance="secondary" @click=${() => this.emit('resolve-discard')}>放弃</gl-button>
				<gl-button ?disabled=${applicable === 0} @click=${() => this.emit('resolve-apply-all')}>
					应用${applicable > 0 ? ` ${applicable} 个解决方案` : '全部'}
				</gl-button>
			</div>
		`;
	}

	private renderResolution(r: ResolvedFileSummary): unknown {
		const display = strategyDisplay[r.strategy];
		const canViewDiff = r.virtualRef != null;
		const retrying = this.retryingFiles?.has(r.filePath) ?? false;
		const expanded = this._expandedRetry.has(r.filePath);
		return html`<li class="resolve-file">
			<div class="resolve-file__head">
				<span class="resolve-file__badge ${display.warn ? 'resolve-file__badge--warn' : ''}" title="解决策略">
					<code-icon icon=${display.icon} size="11"></code-icon>${display.label}
				</span>
				<span class="resolve-file__path">${r.filePath}</span>
				${canViewDiff
					? html`<gl-tooltip content="查看已解决的更改">
							<gl-button
								appearance="toolbar"
								aria-label="查看 ${r.filePath} 的差异"
								@click=${() => this.emit('resolve-view-diff', { filePath: r.filePath })}
							>
								<code-icon icon="diff"></code-icon>
							</gl-button>
						</gl-tooltip>`
					: nothing}
				<gl-tooltip content=${retrying ? '正在重新解决…' : '带反馈重试'}>
					<gl-button
						appearance="toolbar"
						aria-label=${retrying ? `正在重新解决 ${r.filePath}…` : `带反馈重试 ${r.filePath}`}
						aria-expanded=${expanded}
						?disabled=${retrying}
						@click=${() => this.toggleRetry(r.filePath)}
					>
						<code-icon
							icon=${retrying ? 'loading' : 'feedback'}
							modifier=${retrying ? 'spin' : ''}
						></code-icon>
					</gl-button>
				</gl-tooltip>
			</div>
			${r.reasoning ? html`<p class="resolve-file__reasoning">${r.reasoning}</p>` : nothing}
			${expanded
				? html`<gl-ai-input
						class="resolve-file__feedback"
						multiline
						rows="2"
						button-label="重试"
						busy-label="正在重新解决…"
						event-name="resolve-row-retry"
						placeholder='哪里有问题？例如 "保留新的 import，删除旧的"'
						.busy=${retrying}
						@resolve-row-retry=${(e: CustomEvent<{ prompt?: string }>) => this.onRowRetry(r.filePath, e)}
					></gl-ai-input>`
				: nothing}
		</li>`;
	}

	private toggleRetry(filePath: string): void {
		const next = new Set(this._expandedRetry);
		if (next.has(filePath)) {
			next.delete(filePath);
		} else {
			next.add(filePath);
		}
		this._expandedRetry = next;
	}

	/** Re-emit the row's `gl-ai-input` submit as `resolve-retry-file` carrying the file path (the
	 *  input only knows the prompt). Stop the inner event so it doesn't reach the host directly. */
	private onRowRetry(filePath: string, e: CustomEvent<{ prompt?: string }>): void {
		e.stopPropagation();
		const prompt = e.detail?.prompt;
		if (!prompt) return;

		// Collapse the feedback input on submit — while the retry is in flight, the row's feedback
		// toggle shows a spinner instead.
		const next = new Set(this._expandedRetry);
		next.delete(filePath);
		this._expandedRetry = next;

		this.emit('resolve-retry-file', { filePath: filePath, prompt: prompt });
	}

	/** A still-conflicted file the resolver couldn't auto-resolve (no parseable markers — binary,
	 *  unsupported type, …). Not a failure and not retryable: it needs manual resolution. */
	private renderSkipped(s: ResolveSkippedFile): unknown {
		return html`<li class="resolve-file">
			<div class="resolve-file__head">
				<span class="resolve-file__badge resolve-file__badge--warn" title="需要手动解决">
					<code-icon icon="warning" size="11"></code-icon>needs review
				</span>
				<span class="resolve-file__path">${s.filePath}</span>
			</div>
			<p class="resolve-file__reasoning">${s.message}</p>
		</li>`;
	}

	private renderError(e: ResolveFileError): unknown {
		return html`<li class="resolve-file">
			<div class="resolve-file__head">
				<code-icon class="resolve-file__error" icon="error"></code-icon>
				<span class="resolve-file__path">${e.filePath}</span>
			</div>
			<p class="resolve-file__reasoning resolve-file__error">${e.message}</p>
		</li>`;
	}

	private emit(name: string, detail?: unknown): void {
		this.dispatchEvent(new CustomEvent(name, { detail: detail, bubbles: true, composed: true }));
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'gl-details-resolve-mode-panel': GlDetailsResolveModePanel;
	}
}
