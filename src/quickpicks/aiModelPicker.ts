import type { Disposable, QuickInputButton, QuickPickItem } from 'vscode';
import { QuickInputButtons, ThemeIcon, window } from 'vscode';
import { getSettledValue } from '@gitlens/utils/promise.js';
import { ensureAccess } from '../community/stubs/pro.js';
import type {
	AIModel,
	AIModelDescriptor,
	AIModelScope,
	AIProviderDescriptorWithConfiguration,
	AIProviders,
} from '../community/stubs/pro.js';
import type { Source } from '../constants.telemetry.js';
import type { Container } from '../container.js';
import { getQuickPickIgnoreFocusOut } from '../system/-webview/vscode.js';
import { createQuickPickSeparator } from './items/common.js';
import type { DirectiveQuickPickItem } from './items/directive.js';
import { Directive, isDirectiveQuickPickItem } from './items/directive.js';

export interface ModelQuickPickItem extends QuickPickItem {
	model: AIModel;
}

export interface ProviderQuickPickItem extends QuickPickItem {
	provider: AIProviders;
}

const ClearAIKeyButton: QuickInputButton = {
	iconPath: new ThemeIcon('trash'),
	tooltip: '清除 AI 密钥',
};

const ConfigureAIKeyButton: QuickInputButton = {
	iconPath: new ThemeIcon('key'),
	tooltip: '配置 AI 密钥...',
};

export async function showAIProviderPicker(
	container: Container,
	current: AIModelDescriptor | undefined,
	source?: Source,
	titles?: { title?: string; placeholder?: string; scope?: AIModelScope },
): Promise<ProviderQuickPickItem | undefined> {
	if (!(await ensureAccess(container, { showPicker: true }, source))) return undefined;

	const [providersResult, modelResult] = await Promise.allSettled([
		container.ai.getProvidersConfiguration(),
		// Fetch the *scope's* current model when invoked for a scoped operation so the
		// "current model" detail line in the picker reflects the scope, not the global default.
		container.ai.getModel({ silent: true, scope: titles?.scope }, { source: 'ai:picker' }),
	]);

	const providers = getSettledValue(providersResult) ?? new Map<AIProviders, AIProviderDescriptorWithConfiguration>();
	const currentModelName = getSettledValue(modelResult)?.name;

	const quickpick = window.createQuickPick<ProviderQuickPickItem>();
	quickpick.ignoreFocusOut = getQuickPickIgnoreFocusOut();
	quickpick.title = titles?.title ?? '选择 AI 提供程序';
	quickpick.placeholder = titles?.placeholder ?? '选择要使用的 AI 提供程序';

	const disposables: Disposable[] = [];

	try {
		const pickedProvider = current?.provider ?? (providers.get('vscode')?.configured ? 'vscode' : undefined);

		let addedRequiredKeySeparator = false;
		while (true) {
			const items: ProviderQuickPickItem[] = [];
			for (const p of providers.values()) {
				if (!p.primary && !addedRequiredKeySeparator) {
					addedRequiredKeySeparator = true;
					items.push(createQuickPickSeparator<ProviderQuickPickItem>('需要 API 密钥'));
				}

				items.push({
					label: p.name,
					iconPath: p.id === current?.provider ? new ThemeIcon('check') : new ThemeIcon('blank'),
					provider: p.id,
					picked: p.id === pickedProvider,
					detail: p.id === current?.provider && currentModelName ? `      ${currentModelName}` : undefined,
					buttons: !p.primary ? (p.configured ? [ClearAIKeyButton] : [ConfigureAIKeyButton]) : undefined,
				} satisfies ProviderQuickPickItem);
			}

			const pick = await new Promise<ProviderQuickPickItem | 'refresh' | undefined>(resolve => {
				disposables.push(
					quickpick.onDidHide(() => resolve(undefined)),
					quickpick.onDidAccept(() => {
						if (quickpick.activeItems.length !== 0) {
							resolve(quickpick.activeItems[0]);
						}
					}),
					quickpick.onDidTriggerItemButton(e => {
						if (e.button === ClearAIKeyButton) {
							container.ai.resetProviderKey(e.item.provider);
							providers.set(e.item.provider, { ...providers.get(e.item.provider)!, configured: false });
							resolve('refresh');
						} else if (e.button === ConfigureAIKeyButton) {
							resolve(e.item);
						}
					}),
				);

				quickpick.items = items;
				quickpick.activeItems = items.filter(i => i.picked);

				quickpick.show();
			});

			if (pick === 'refresh') continue;

			return pick;
		}
	} finally {
		quickpick.dispose();
		disposables.forEach(d => void d.dispose());
	}
}

export async function showAIModelPicker(
	container: Container,
	provider: AIProviders,
	current?: AIModelDescriptor,
	source?: Source,
	titles?: { title?: string; placeholder?: string },
	_scope?: AIModelScope,
): Promise<ModelQuickPickItem | Directive | undefined> {
	if (!(await ensureAccess(container, { showPicker: true }, source))) return undefined;

	const models = (await container.ai.getModels(provider)) ?? [];

	const items: Array<ModelQuickPickItem | DirectiveQuickPickItem> = [];

	if (!models.length) {
		items.push({
			label: '未找到模型',
			description: provider === 'ollama' ? '请安装模型或检查 Ollama 服务器配置' : undefined,
			iconPath: new ThemeIcon('error'),
			directive: Directive.Noop,
		} satisfies ModelQuickPickItem | DirectiveQuickPickItem);
	} else {
		for (const m of models) {
			if (m.hidden) continue;

			const matchesCurrent = m.provider.id === current?.provider && m.id === current?.model;

			items.push({
				label: m.name,
				description: m.default ? '  推荐' : undefined,
				iconPath: matchesCurrent ? new ThemeIcon('check') : new ThemeIcon('blank'),
				model: m,
				picked: matchesCurrent,
			} satisfies ModelQuickPickItem);
		}
	}

	const quickpick = window.createQuickPick<ModelQuickPickItem | DirectiveQuickPickItem>();
	quickpick.ignoreFocusOut = getQuickPickIgnoreFocusOut();

	const disposables: Disposable[] = [];

	try {
		const pick = await new Promise<ModelQuickPickItem | Directive | undefined>(resolve => {
			disposables.push(
				quickpick.onDidHide(() => resolve(undefined)),
				quickpick.onDidAccept(() => {
					if (quickpick.activeItems.length !== 0) {
						if (!isDirectiveQuickPickItem(quickpick.activeItems[0])) {
							resolve(quickpick.activeItems[0]);
						}
					}
				}),
				quickpick.onDidTriggerButton(e => {
					if (e === QuickInputButtons.Back) {
						resolve(Directive.Back);
					}
				}),
			);

			quickpick.title = titles?.title ?? '选择 AI 模型';
			quickpick.placeholder = titles?.placeholder ?? '选择要使用的 AI 模型';
			quickpick.matchOnDescription = true;
			quickpick.matchOnDetail = true;
			quickpick.items = items;
			quickpick.activeItems = items.filter(i => i.picked);
			quickpick.buttons = [QuickInputButtons.Back];

			quickpick.show();
		});

		return pick;
	} finally {
		quickpick.dispose();
		disposables.forEach(d => void d.dispose());
	}
}
