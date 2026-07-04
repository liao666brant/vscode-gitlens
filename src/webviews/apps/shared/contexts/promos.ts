import { createContext } from '@lit/context';
import type { Promo, PromoLocation, PromoPlans } from '../../../../community/stubs/pro.js';
import type { Disposable } from '../events.js';
import type { HostIpc } from '../ipc.js';

export class PromosContext implements Disposable {
	constructor(ipc: HostIpc) {
		void ipc;
	}

	getApplicablePromo(_plan?: PromoPlans, _location?: PromoLocation): Promise<Promo | undefined> {
		return Promise.resolve(undefined);
	}

	dispose(): void {}
}

export const promosContext = createContext<PromosContext>('promos');
