import { LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('gl-feature-gate')
export class GlFeatureGate extends LitElement {
	override render(): unknown {
		return nothing;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'gl-feature-gate': GlFeatureGate;
	}
}
