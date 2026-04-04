import { consume } from '@lit/context';
import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import type { State } from '../../../home/protocol.js';
import { GlElement } from '../../shared/components/element.js';
import { linkBase } from '../../shared/components/styles/lit/base.css.js';
import { stateContext } from '../context.js';
import { alertStyles, homeBaseStyles } from '../home.css.js';
import '../../shared/components/button.js';

@customElement('gl-repo-alerts')
export class GlRepoAlerts extends GlElement {
	static override styles = [
		linkBase,
		homeBaseStyles,
		alertStyles,
		css`
			.alert {
				margin-bottom: 0;
			}

			.centered {
				text-align: center;
			}

			.one-line {
				white-space: nowrap;
			}

			gl-button.is-basic {
				max-width: 300px;
				width: 100%;
			}
			gl-button.is-basic + gl-button.is-basic {
				margin-top: 1rem;
			}
		`,
	];

	@property({ type: Boolean, reflect: true, attribute: 'has-alerts' })
	get hasAlerts(): boolean | undefined {
		return this.alertVisibility.header !== true ? undefined : true;
	}

	@consume<State>({ context: stateContext, subscribe: true })
	@state()
	private _state!: State;

	get alertVisibility() {
		const sections = {
			header: false,
			untrusted: false,
			noRepo: false,
			unsafeRepo: false,
		};
		if (this._state == null || this._state.discovering) {
			return sections;
		}

		if (!this._state.repositories.trusted) {
			sections.header = true;
			sections.untrusted = true;
		} else if (this._state.repositories.openCount === 0) {
			sections.header = true;
			sections.noRepo = true;
		} else if (this._state.repositories.hasUnsafe) {
			sections.header = true;
			sections.unsafeRepo = true;
		}

		return sections;
	}

	override render(): unknown {
		if (this._state == null || !this.alertVisibility.header) {
			return;
		}

		return html`
			${when(
				this.alertVisibility.noRepo,
				() => html`
					<div id="no-repo-alert" class="alert alert--info mb-0">
						<h1 class="alert__title">未检测到仓库</h1>
						<div class="alert__description">
							<p>要使用 GitLens，请打开包含 Git 仓库的文件夹，或在资源管理器中通过 URL 克隆仓库。</p>
							<p class="centered">
								<gl-button class="is-basic" href="command:workbench.view.scm"
									>打开文件夹或仓库</gl-button
								>
							</p>
							<p class="mb-0">
								如果你已打开包含仓库的文件夹，请通过
								<a class="one-line" href="https://github.com/gitkraken/vscode-gitlens/issues/new/choose"
									>创建 Issue</a
								>.
							</p>
						</div>
					</div>
				`,
			)}
			${when(
				this.alertVisibility.unsafeRepo,
				() => html`
					<div id="unsafe-repo-alert" class="alert alert--info mb-0">
						<h1 class="alert__title">不安全的仓库</h1>
						<div class="alert__description">
							<p>由于文件夹不属于当前用户，Git 将其阻止为潜在不安全，因此无法打开任何仓库。</p>
							<p class="centered">
								<gl-button class="is-basic" href="command:workbench.view.scm"
									>在源代码管理中管理</gl-button
								>
							</p>
						</div>
					</div>
				`,
			)}
			${when(
				this.alertVisibility.untrusted,
				() => html`
					<div id="untrusted-alert" class="alert alert--info mb-0" aria-hidden="true">
						<h1 class="alert__title">未受信任的工作区</h1>
						<div class="alert__description">
							<p>在受限模式下无法打开仓库。</p>
							<p class="centered">
								<gl-button class="is-basic" href="command:workbench.trust.manage"
									>管理工作区信任</gl-button
								>
							</p>
						</div>
					</div>
				`,
			)}
		`;
	}
}
