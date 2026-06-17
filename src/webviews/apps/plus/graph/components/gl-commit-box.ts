import { html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { isMac } from '@env/platform.js';
import { elementBase, scrollableBase } from '../../../shared/components/styles/lit/base.css.js';
import { commitBoxStyles } from './gl-commit-box.css.js';
import '../../../shared/components/button.js';
import '../../../shared/components/branch-name.js';
import '../../../shared/components/checkbox/checkbox.js';
import '../../../shared/components/code-icon.js';
import '../../../shared/components/overlays/tooltip.js';

// Register as a typed custom property so it can be animated/transitioned. @property in a
// constructable stylesheet doesn't reliably register in Chromium; the JS API does.
if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
	try {
		CSS.registerProperty({
			name: '--gl-textarea-thumb-color',
			syntax: '<color>',
			inherits: true,
			initialValue: 'transparent',
		});
	} catch {
		/* already registered */
	}
}

@customElement('gl-commit-box')
export class GlCommitBox extends LitElement {
	static override styles = [elementBase, commitBoxStyles, scrollableBase];

	@property()
	message = '';

	@property({ type: Boolean })
	amend = false;

	@property({ type: Boolean, reflect: true })
	generating = false;

	@property({ type: Boolean, reflect: true })
	committing = false;

	@property()
	branchName = '';

	@property({ type: Boolean })
	canCommit = false;

	@property()
	disabledReason?: 'no-message' | 'no-staged';

	@property({ type: Boolean })
	aiEnabled = false;

	@property()
	commitError?: string;

	override render() {
		return html`
			<div class="options">
				${this.renderAmendToggle()}
				${this.aiEnabled
					? html`<gl-button appearance="secondary" @click=${this.onCompose}>
							<code-icon class="compose-icon" icon="wand" slot="prefix"></code-icon>
							编排
						</gl-button>`
					: nothing}
			</div>
			${this.renderTextarea()} ${this.renderActionBar()}
		`;
	}

	private renderAmendToggle() {
		return html`
			<gl-checkbox
				class="amend-checkbox"
				.checked=${this.amend}
				?disabled=${this.committing}
				@gl-change-value=${this.onAmendChange}
			>
				修补上次提交
			</gl-checkbox>
		`;
	}

	private renderTextarea() {
		const firstLine = this.message.split('\n')[0] ?? '';
		const len = firstLine.length;
		const modifier = isMac ? '\u2318' : 'Ctrl+';

		return html`
			<div class="message">
				${this.aiEnabled
					? html`<svg class="working-ring" aria-hidden="true">
							<rect class="working-ring-base" pathLength="100"></rect>
							<rect class="working-ring-highlight" pathLength="100"></rect>
						</svg>`
					: nothing}
				<textarea
					class="textarea ${this.commitError ? 'has-error' : ''}"
					.value=${this.message}
					?disabled=${this.committing}
					aria-invalid=${this.commitError ? 'true' : 'false'}
					placeholder=${`提交消息（${modifier}Enter 提交）`}
					@input=${this.onMessageInput}
					@keydown=${this.onMessageKeydown}
				></textarea>
				${this.aiEnabled
					? html`<div class="controls">
							<gl-button
								class="sparkle"
								appearance="toolbar"
								density="compact"
								tooltip=${this.generating ? '取消' : '生成提交消息'}
								aria-busy=${this.generating ? 'true' : 'false'}
								@click=${this.onGenerateMessage}
							>
								${this.generating
									? html`<code-icon icon="loading" modifier="spin"></code-icon>`
									: html`<code-icon icon="sparkle"></code-icon>`}
							</gl-button>
						</div>`
					: nothing}
				<div class="controls controls-bottom">
					${len > 50 ? html`<span class="char-count">${len}</span>` : nothing}
					<gl-button
						class="add-coauthors"
						appearance="toolbar"
						density="compact"
						tooltip="Add Co-authors..."
						aria-label="Add Co-authors..."
						?disabled=${this.committing}
						@click=${this.onAddCoauthors}
					>
						<code-icon icon="person-add"></code-icon>
					</gl-button>
				</div>
			</div>
		`;
	}

	private renderActionBar() {
		const label = this.amend ? '修补提交到' : '提交到';
		const action = this.amend ? '修补提交到' : '提交到';
		const branch = this.branchName;
		const enabledTooltip = `${label} ${branch}`;
		const disabledTooltip =
			this.disabledReason === 'no-message'
				? `输入提交消息以${action} ${branch}`
				: this.disabledReason === 'no-staged'
					? `暂存上方更改以${action} ${branch}`
					: '';

		return html`
			<gl-tooltip
				content=${disabledTooltip}
				?disabled=${this.canCommit || this.committing || !disabledTooltip}
				placement="bottom"
			>
				<span class="commit-btn-wrapper">
					<gl-button
						class="commit-btn"
						full
						?disabled=${!this.canCommit || this.committing}
						aria-busy=${this.committing ? 'true' : 'false'}
						variant=${this.amend ? 'warning' : nothing}
						tooltip=${this.canCommit && !this.committing ? enabledTooltip : ''}
						@click=${this.onCommit}
					>
						${this.committing
							? html`<code-icon icon="loading" modifier="spin" slot="prefix"></code-icon>正在提交…`
							: html`${label}&nbsp;<gl-branch-name .name=${branch}></gl-branch-name>`}
					</gl-button>
				</span>
			</gl-tooltip>
		`;
	}

	private onMessageInput(e: Event) {
		this.dispatchEvent(
			new CustomEvent('message-change', {
				detail: { value: (e.target as HTMLTextAreaElement).value },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onMessageKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			if (this.canCommit && !this.committing) {
				this.dispatchEvent(new CustomEvent('commit', { bubbles: true, composed: true }));
			}
		}
	}

	private onAmendChange(e: Event) {
		const target = e.target as HTMLElement & { checked: boolean };
		this.dispatchEvent(
			new CustomEvent('amend-change', {
				detail: { checked: target.checked },
				bubbles: true,
				composed: true,
			}),
		);
	}

	private onCommit() {
		if (this.committing) return;

		this.dispatchEvent(new CustomEvent('commit', { bubbles: true, composed: true }));
	}

	private onGenerateMessage() {
		this.dispatchEvent(new CustomEvent('generate-message', { bubbles: true, composed: true }));
	}

	private onAddCoauthors() {
		if (this.committing) return;

		this.dispatchEvent(new CustomEvent('add-coauthors', { bubbles: true, composed: true }));
	}

	private onCompose() {
		this.dispatchEvent(new CustomEvent('compose', { bubbles: true, composed: true }));
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'gl-commit-box': GlCommitBox;
	}
}
