import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getAltKeySymbol, getCmdKeySymbol, getShiftKeySymbol, isMac } from '@env/platform.js';
import '../../../shared/components/code-icon.js';
import '../../../shared/components/overlays/dialog.js';

// Platform-aware modifier labels — symbols on macOS, words elsewhere.
const ctrlOrCmd = getCmdKeySymbol();
const alt = getAltKeySymbol();
const shift = getShiftKeySymbol();

// macOS stacks modifier symbols with no separator (⇧↑); elsewhere we join words with `+` (Shift+↑).
const chordSeparator = isMac ? '' : '+';

/** A single key chord, e.g. `['⌘', 'F']` — rendered as one chip joining its keys. */
type Chord = string[];
type Shortcut = { chords: Chord[]; description: string };
type ShortcutGroup = { title: string; shortcuts: Shortcut[] };

// Mirrors the verified handlers: gitkraken-components GraphContainer keydown (navigation),
// gl-graph.react (open), search-box/search-input (search), gl-commit-box (commit), hover/minimap (Esc).
const groups: ShortcutGroup[] = [
	{
		title: '导航',
		shortcuts: [
			{ chords: [['↑'], ['↓']], description: '选择上一个/下一个提交' },
			{ chords: [['←'], ['→']], description: '选择下一个/上一个提交（非拓扑）' },
			{
				chords: [
					[shift, '↑'],
					[shift, '↓'],
				],
				description: '向上/向下扩展选择',
			},
			{
				chords: [
					[ctrlOrCmd, '↑'],
					[ctrlOrCmd, '↓'],
				],
				description: '按拓扑选择（跟随分支血缘）',
			},
			{
				chords: [
					[alt, '↑'],
					[alt, '↓'],
				],
				description: '选择上一个/下一个分支点',
			},
			{ chords: [['Home'], ['End']], description: '选择第一个/最后一个提交' },
			{ chords: [['PgUp'], ['PgDn']], description: '向上/向下翻页移动选择' },
			{
				chords: [
					[alt, 'PgUp'],
					[alt, 'PgDn'],
				],
				description: '选择上一个/下一个引用',
			},
			{ chords: [['H']], description: '选择 HEAD 提交' },
		],
	},
	{
		title: '打开',
		shortcuts: [
			{ chords: [['Enter']], description: '打开选中的提交' },
			{ chords: [['Space']], description: '打开提交，焦点保持在图形中' },
		],
	},
	{
		title: '搜索',
		shortcuts: [
			{ chords: [[ctrlOrCmd, 'F']], description: '聚焦搜索框' },
			{
				chords: isMac ? [['F3'], [ctrlOrCmd, 'G']] : [['F3']],
				description: '跳转到下一个匹配项（按住 Shift 跳转到上一个）',
			},
			{ chords: [['Enter'], [shift, 'Enter']], description: '下一个/上一个匹配项（在搜索框中）' },
			{ chords: [['↑'], ['↓']], description: '搜索历史和自动补全（在搜索框中）' },
			{ chords: [['Esc']], description: '取消搜索' },
		],
	},
	{
		title: '提交',
		shortcuts: [{ chords: [[ctrlOrCmd, 'Enter']], description: '提交已暂存的更改（在提交框中）' }],
	},
	{
		title: '其他',
		shortcuts: [{ chords: [['Esc']], description: '关闭悬停、消除错误或退出缩略图缩放' }],
	},
];

@customElement('gl-graph-keyboard-shortcuts')
export class GlGraphKeyboardShortcuts extends LitElement {
	static override styles = css`
		:host {
			display: contents;
		}

		.shortcuts-dialog::part(base) {
			width: 56rem;
			max-width: 90vw;
		}

		.container {
			display: flex;
			flex-direction: column;
			gap: 1.4rem;
		}

		.header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1.6rem;
		}

		.header h2 {
			display: flex;
			align-items: center;
			gap: 0.8rem;
			margin: 0;
			font-size: 1.5rem;
			font-weight: 600;
		}

		.close {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 0.4rem;
			color: inherit;
			background: none;
			border: none;
			border-radius: 0.3rem;
			cursor: pointer;
		}
		.close:hover {
			background: var(--vscode-toolbar-hoverBackground);
		}

		.groups {
			column-count: 2;
			column-gap: 2.4rem;
		}

		.group {
			break-inside: avoid;
			margin-bottom: 1.2rem;
		}
		.group:last-child {
			margin-bottom: 0;
		}

		.group h3 {
			margin: 0 0 0.4rem;
			font-size: 1.1rem;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05rem;
			color: var(--color-foreground--65, var(--vscode-descriptionForeground));
		}

		.rows {
			display: grid;
			grid-template-columns: max-content 1fr;
			column-gap: 1rem;
			row-gap: 0.4rem;
			align-items: baseline;
		}

		.keys {
			display: inline-flex;
			flex-wrap: wrap;
			gap: 0.6rem;
		}

		kbd {
			display: inline-block;
			min-width: 1.6rem;
			padding: 0.1rem 0.4rem;
			font-family: inherit;
			font-size: 1.1rem;
			line-height: 1.5;
			text-align: center;
			color: var(--vscode-keybindingLabel-foreground, var(--vscode-foreground));
			background-color: var(--vscode-keybindingLabel-background, var(--vscode-toolbar-hoverBackground));
			border: 1px solid var(--vscode-keybindingLabel-border, transparent);
			border-bottom-color: var(
				--vscode-keybindingLabel-bottomBorder,
				var(--vscode-keybindingLabel-border, transparent)
			);
			border-radius: 0.3rem;
		}

		.desc {
			font-size: 1.2rem;
			color: var(--color-foreground--75, var(--vscode-foreground));
		}

		.footnote {
			margin: 0;
			font-size: 1.1rem;
			color: var(--color-foreground--65, var(--vscode-descriptionForeground));
		}
	`;

	@state()
	private open = false;

	show(): void {
		this.open = true;
	}

	private close(): void {
		this.open = false;
	}

	override render(): unknown {
		return html`<gl-dialog
			class="shortcuts-dialog"
			modal
			closedby="any"
			?open=${this.open}
			@gl-dialog-close=${this.close}
		>
			<div class="container">
				<header class="header">
					<h2><code-icon icon="keyboard"></code-icon> Keyboard Shortcuts</h2>
					<button class="close" type="button" aria-label="Close" @click=${this.close}>
						<code-icon icon="close"></code-icon>
					</button>
				</header>
				<div class="groups">${groups.map(g => this.renderGroup(g))}</div>
				<p class="footnote">Shortcuts apply while the Commit Graph has focus.</p>
			</div>
		</gl-dialog>`;
	}

	private renderGroup(group: ShortcutGroup): unknown {
		return html`<section class="group">
			<h3>${group.title}</h3>
			<div class="rows">
				${group.shortcuts.map(
					s =>
						html`<span class="keys">${s.chords.map(c => this.renderChord(c))}</span>
							<span class="desc">${s.description}</span>`,
				)}
			</div>
		</section>`;
	}

	private renderChord(chord: Chord): unknown {
		return html`<kbd>${chord.join(chordSeparator)}</kbd>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'gl-graph-keyboard-shortcuts': GlGraphKeyboardShortcuts;
	}
}
