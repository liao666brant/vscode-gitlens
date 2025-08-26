import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { SubscriptionState } from '../../../../constants.subscription.js';
import type { Source } from '../../../../constants.telemetry.js';
import type { FeaturePreview } from '../../../../features.js';

declare global {
	interface HTMLElementTagNameMap {
		'gl-feature-gate': GlFeatureGate;
	}

	// interface GlobalEventHandlersEventMap {}
}

@customElement('gl-feature-gate')
export class GlFeatureGate extends LitElement {
	@property({ reflect: true })
	appearance?: 'alert' | 'default';

	@property({ type: Object })
	featurePreview?: FeaturePreview;

	@property({ type: String })
	featurePreviewCommandLink?: string;

	@property()
	featureRestriction?: 'all' | 'private-repos';

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
