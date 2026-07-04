import { LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('gl-promo')
export class GlPromo extends LitElement {
	@property({ type: Boolean, reflect: true, attribute: 'has-promo' })
	hasPromo = false;

	override render(): unknown {
		return nothing;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'gl-promo': GlPromo;
	}
}
