import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { SubscriptionState } from '../../../../constants.subscription';
import type { Source } from '../../../../constants.telemetry';
import type { FeaturePreview } from '../../../../features';
import '../../plus/shared/components/feature-gate-plus-state';

declare global {
	interface HTMLElementTagNameMap {
		'gl-feature-gate': GlFeatureGate;
	}

	// interface GlobalEventHandlersEventMap {}
}

@customElement('gl-feature-gate')
export class GlFeatureGate extends LitElement {
	@property({ reflect: true })
	appearance?: 'alert' | 'welcome';

	@property({ type: Object })
	featurePreview?: FeaturePreview;

	@property({ type: String })
	featurePreviewCommandLink?: string;

	@property()
	featureWithArticleIfNeeded?: string;

	@property({ type: Object })
	source?: Source;

	@property({ attribute: false, type: Number })
	state?: SubscriptionState;

	@property({ type: String })
	webroot?: string;

	override render(): unknown {
		return undefined;
	}
}
