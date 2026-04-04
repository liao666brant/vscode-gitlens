import { consume } from '@lit/context';
import { SignalWatcher } from '@lit-labs/signals';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createCommandLink } from '../../../../system/commands.js';
import { linkStyles } from '../shared/components/vscode.css.js';
import { graphStateContext } from './context.js';
import '../../shared/components/feature-badge.js';
import '../../shared/components/feature-gate.js';

@customElement('gl-graph-gate')
export class GlGraphGate extends SignalWatcher(LitElement) {
	static override styles = [
		linkStyles,
		css`
			gl-feature-gate gl-feature-badge {
				vertical-align: super;
				margin-left: 0.4rem;
				margin-right: 0.4rem;
			}
		`,
	];

	@consume({ context: graphStateContext, subscribe: true })
	graphState!: typeof graphStateContext.__context__;

	override render() {
		return html`<gl-feature-gate
			.featurePreview=${this.graphState.featurePreview}
			featurePreviewCommandLink=${ifDefined(
				this.graphState.featurePreview
					? createCommandLink('gitlens.plus.continueFeaturePreview', {
							feature: this.graphState.featurePreview.feature,
						})
					: undefined,
			)}
			appearance="alert"
			featureRestriction="private-repos"
			featureWithArticleIfNeeded="提交图"
			?hidden=${this.graphState.allowed !== false}
			.source=${{ source: 'graph', detail: 'gate' } as const}
			.state=${this.graphState.subscription?.state}
			.webroot=${this.graphState.webroot}
		>
			<p slot="feature">
				<a href="https://help.gitkraken.com/gitlens/gitlens-features/#commit-graph-pro">提交图</a>
				<gl-feature-badge
					.source=${{ source: 'graph', detail: 'badge' } as const}
					subscription="{subscription}"
				></gl-feature-badge>
				&mdash;
				轻松可视化你的仓库，并跟踪所有进行中的工作。使用强大的提交搜索来查找特定提交、提交消息、作者、已更改文件，甚至某一处具体代码变更。
			</p>
		</gl-feature-gate>`;
	}
}
