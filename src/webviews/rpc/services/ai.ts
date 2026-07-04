import type { AiModelInfo, AIState, RpcEventSubscription } from './types.js';

const aiDisabledState: AIState = {
	enabled: false,
	orgEnabled: false,
	mcp: {
		bundled: false,
		settingEnabled: false,
		installed: false,
	},
	hooks: {
		claude: {
			detected: false,
			supported: false,
			installed: false,
		},
		canInstallClaudeHook: false,
	},
	defaultAgent: undefined,
};

const noEvent =
	<T>(): RpcEventSubscription<T> =>
	() =>
	() => {};

export class AIService {
	readonly onModelChanged = noEvent<AiModelInfo | undefined>();
	readonly onStateChanged = noEvent<AIState>();

	getModel(): Promise<AiModelInfo | undefined> {
		return Promise.resolve(undefined);
	}

	getState(): Promise<AIState> {
		return Promise.resolve(aiDisabledState);
	}

	isEnabled(): Promise<boolean> {
		return Promise.resolve(false);
	}
}
