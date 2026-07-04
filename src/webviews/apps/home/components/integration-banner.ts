import { consume } from '@lit/context';
import { SignalWatcher } from '@lit-labs/signals';
import { css, LitElement, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import type { GlButton } from '../../shared/components/button.js';
import type { IntegrationsState } from '../../shared/contexts/integrations.js';
import { integrationsContext } from '../../shared/contexts/integrations.js';
import type { OnboardingState } from '../../shared/contexts/onboarding.js';
import { onboardingContext } from '../../shared/contexts/onboarding.js';
import '../../shared/components/button.js';
import '../../shared/components/button-container.js';
import '../../shared/components/card/card.js';

export const integrationBannerTagName = 'gl-integration-banner';

@customElement(integrationBannerTagName)
export class GlIntegrationBanner extends SignalWatcher(LitElement) {
	static override shadowRootOptions: ShadowRootInit = {
		...LitElement.shadowRootOptions,
		delegatesFocus: true,
	};

	static override styles = [
		css`
			gl-card::part(base) {
				margin-block-end: 1.2rem;
			}
		`,
	];

	@consume({ context: integrationsContext })
	private _integrations!: IntegrationsState;

	@consume({ context: onboardingContext })
	private _onboarding!: OnboardingState;

	@state()
	private closed = false;

	@query('gl-button')
	private _button!: GlButton;

	override render(): unknown {
		void this.closed;
		void this._integrations;
		void this._onboarding;
		return nothing;
	}

	private onClose() {
		this.closed = true;

		this._onboarding.dismiss('integrationBanner');
	}

	override focus(): void {
		this._button.focus();
	}
}

declare global {
	interface HTMLElementTagNameMap {
		[integrationBannerTagName]: GlIntegrationBanner;
	}
}
