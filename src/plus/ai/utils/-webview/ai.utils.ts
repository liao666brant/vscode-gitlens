import type { CancellationToken, Disposable, QuickInputButton } from 'vscode';
import { env, ThemeIcon, Uri, window } from 'vscode';
import type { AIProviders } from '../../../../constants.ai.js';
import { Schemes } from '../../../../constants.js';
import type { Source } from '../../../../constants.telemetry.js';
import type { Container } from '../../../../container.js';
import type { MarkdownContentMetadata } from '../../../../documents/markdown.js';
import { CancellationError } from '../../../../errors.js';
import type { GitRepositoryService } from '../../../../git/gitRepositoryService.js';
import { decodeGitLensRevisionUriAuthority } from '../../../../git/gitUri.authority.js';
import { createDirectiveQuickPickItem, Directive } from '../../../../quickpicks/items/directive.js';
import { configuration } from '../../../../system/-webview/configuration.js';
import { getContext } from '../../../../system/-webview/context.js';
import { openSettingsEditor } from '../../../../system/-webview/vscode/editors.js';
import { formatNumeric } from '../../../../system/date.js';
import { Logger } from '../../../../system/logger.js';
import { getSettledValue } from '../../../../system/promise.js';
import { getPossessiveForm } from '../../../../system/string.js';
import type { OrgAIConfig, OrgAIProvider } from '../../../gk/models/organization.js';
import { ensureAccountQuickPick } from '../../../gk/utils/-webview/acount.utils.js';
import type { AIResponse, AIResultContext } from '../../aiProviderService.js';
import type { AIActionType, AIModel } from '../../models/model.js';

export async function ensureAccount(container: Container, silent: boolean): Promise<boolean> {
	const result = await ensureAccountQuickPick(
		container,
		createDirectiveQuickPickItem(Directive.Noop, undefined, {
			label: '使用 AI 驱动的 GitLens 功能，例如生成提交信息、解释提交等',
			iconPath: new ThemeIcon('sparkle'),
		}),
		{ source: 'ai' },
		silent,
	);

	if (!result && !silent) {
		throw new CancellationError();
	}

	return result;
}

export function getActionName(action: AIActionType): string {
	switch (action) {
		case 'explain-changes':
			return '解释变更';
		case 'generate-commitMessage':
			return '生成提交信息';
		case 'generate-stashMessage':
			return '生成暂存消息';
		case 'generate-changelog':
			return '生成变更日志（预览）';
		case 'generate-create-cloudPatch':
			return '创建 Cloud Patch 详情';
		case 'generate-create-codeSuggestion':
			return '创建代码建议详情';
		case 'generate-create-pullRequest':
			return '创建拉取请求详情（预览）';
		case 'generate-commits':
			return '生成提交（预览）';
		case 'generate-searchQuery':
			return '生成搜索查询（预览）';
	}
}

export const estimatedCharactersPerToken = 2.8;

export async function getOrPromptApiKey(
	container: Container,
	provider: {
		readonly id: AIProviders;
		readonly name: string;
		readonly requiresAccount: boolean;
		readonly validator: (value: string) => boolean;
		readonly url?: string;
	},
	silent?: boolean,
): Promise<string | undefined> {
	let apiKey = await container.storage.getSecret(`gitlens.${provider.id}.key`);
	if (apiKey) return apiKey;
	if (silent) return undefined;

	if (provider.requiresAccount) {
		const result = await ensureAccount(container, false);
		if (!result) return undefined;
	}

	const input = window.createInputBox();
	input.ignoreFocusOut = true;

	const disposables: Disposable[] = [];

	try {
		const infoButton: QuickInputButton = {
			iconPath: new ThemeIcon(`link-external`),
			tooltip: `打开 ${provider.name} API 密钥页面`,
		};

		apiKey = await new Promise<string | undefined>(resolve => {
			disposables.push(
				input.onDidHide(() => resolve(undefined)),
				input.onDidChangeValue(value => {
					if (value && !provider.validator(value)) {
						input.validationMessage = `请输入有效的 ${provider.name} API 密钥`;
						return;
					}
					input.validationMessage = undefined;
				}),
				input.onDidAccept(() => {
					const value = input.value.trim();
					if (!value || !provider.validator(value)) {
						input.validationMessage = `请输入有效的 ${provider.name} API 密钥`;
						return;
					}

					resolve(value);
				}),
				input.onDidTriggerButton(e => {
					if (e === infoButton && provider.url) {
						void env.openExternal(Uri.parse(provider.url));
					}
				}),
			);

			input.password = true;
			input.title = `连接到 ${provider.name}`;
			input.placeholder = `请输入您的 ${provider.name} API 密钥以使用此功能`;
			input.prompt = `输入您的 ${
				provider.url
					? `[${provider.name} API 密钥](${provider.url} "获取您的 ${provider.name} API 密钥")`
					: `${provider.name} API 密钥`
			}`;
			if (provider.url) {
				input.buttons = [infoButton];
			}

			input.show();
		});
	} finally {
		input.dispose();
		disposables.forEach(d => void d.dispose());
	}

	if (!apiKey) return undefined;

	void container.storage.storeSecret(`gitlens.${provider.id}.key`, apiKey).catch();

	return apiKey;
}

export function getValidatedTemperature(model: AIModel, modelTemperature?: number | null): number | undefined {
	if (modelTemperature === null) return undefined;
	// GPT5 doesn't support anything but the default temperature
	if (model.id.startsWith('gpt-5')) return undefined;

	modelTemperature ??= Math.max(0, Math.min(configuration.get('ai.modelOptions.temperature'), 2));
	return modelTemperature;
}

/**
 * Calculates the reduced max input tokens for retry attempts when context length is exceeded.
 *
 * If `estimatedTokens` is provided, calculates based on the actual overage ratio.
 * Otherwise, uses a hybrid strategy: conservative fixed reduction, then escalating percentages.
 *
 * @param maxInputTokens - Current max input tokens limit
 * @param retryCount - Current retry attempt (1-based, use value after incrementing)
 * @param estimatedTokens - Optional: estimated tokens in the prompt (if known)
 * @returns New max input tokens value
 */
export function getReducedMaxInputTokens(maxInputTokens: number, retryCount: number, estimatedTokens?: number): number {
	// If we know the estimated tokens, calculate reduction based on overage
	if (estimatedTokens != null && estimatedTokens > maxInputTokens) {
		const overageRatio = estimatedTokens / maxInputTokens;
		// Target below the limit with some buffer (5-15% below based on retry)
		const bufferPercent = 0.05 + retryCount * 0.05;
		const targetRatio = 1 / overageRatio - bufferPercent;
		return Math.floor(maxInputTokens * Math.max(0.5, targetRatio));
	}

	// Fallback: progressive reduction without knowing exact overage
	switch (retryCount) {
		case 1:
			// Conservative fixed reduction for small overages
			return maxInputTokens - 1000;
		case 2:
			// Moderate percentage-based reduction
			return Math.floor(maxInputTokens * 0.9);
		case 3:
		default:
			// Aggressive percentage-based reduction
			return Math.floor(maxInputTokens * 0.75);
	}
}

export async function showLargePromptWarning(estimatedTokens: number, threshold: number): Promise<boolean> {
	const confirm = { title: '继续' };
	const changeThreshold = { title: `修改阈值` };
	const cancel = { title: '取消', isCloseAffordance: true };
	const result = await window.showWarningMessage(
		`本次请求预计将使用约 ${formatNumeric(estimatedTokens)} 个 token，已超过已配置的 ${formatNumeric(
			threshold,
		)} 大提示词 token 阈值。\n\n是否继续？`,
		{ modal: true },
		confirm,
		changeThreshold,
		cancel,
	);

	if (result === changeThreshold) {
		void openSettingsEditor({ query: 'gitlens.ai.largePromptWarningThreshold' });
	}
	return result === confirm;
}

export function showPromptTruncationWarning(model: AIModel): void {
	void window.showWarningMessage(`提示词已被截断，以满足 ${getPossessiveForm(model.provider.name)} 的限制。`);
}

export function isAzureUrl(url: string): boolean {
	return url.includes('.azure.com');
}

export function getOrgAIConfig(): OrgAIConfig {
	return {
		aiEnabled: getContext('gitlens:gk:organization:ai:enabled', true),
		enforceAiProviders: getContext('gitlens:gk:organization:ai:enforceProviders', false),
		aiProviders: getContext('gitlens:gk:organization:ai:providers', {}),
	};
}

export function getOrgAIProviderOfType(type: AIProviders, orgAIConfig?: OrgAIConfig): OrgAIProvider {
	orgAIConfig ??= getOrgAIConfig();
	if (!orgAIConfig.aiEnabled) return { type: type, enabled: false };
	if (!orgAIConfig.enforceAiProviders) return { type: type, enabled: true };
	return orgAIConfig.aiProviders[type] ?? { type: type, enabled: false };
}

export function isProviderEnabledByOrg(type: AIProviders, orgAIConfig?: OrgAIConfig): boolean {
	return getOrgAIProviderOfType(type, orgAIConfig).enabled;
}

/**
 * If the input value (userUrl) matches to the org configuration it returns it.
 */
export function ensureOrgConfiguredUrl(type: AIProviders, userUrl: null | undefined | string): string | undefined {
	const provider = getOrgAIProviderOfType(type);
	if (!provider.enabled) return undefined;

	return provider.url || userUrl || undefined;
}

export async function ensureAccess(
	container: Container,
	options?: { showPicker?: boolean },
	source?: Source,
): Promise<boolean> {
	const showPicker = options?.showPicker ?? false;

	if (!container.ai.allowed) {
		if (showPicker) {
			await window.showQuickPick([{ label: '确定' }], {
				title: 'AI 已禁用',
				placeHolder: 'GitLens AI 功能已被您的 GitKraken 管理员禁用',
				canPickMany: false,
			});
		} else {
			await window.showErrorMessage(`AI 功能已被您的 GitKraken 管理员禁用。`);
		}

		return false;
	}

	if (!container.ai.enabled) {
		let reenable = false;
		if (showPicker) {
			const enable = { label: '重新启用 AI 功能' };
			const pick = await window.showQuickPick([{ label: '确定' }, enable], {
				title: 'AI 已禁用',
				placeHolder: 'GitLens AI 功能已在设置中被禁用',
				canPickMany: false,
			});
			if (pick === enable) {
				reenable = true;
			}
		} else {
			const enable = { title: '重新启用 AI 功能' };
			const result = await window.showErrorMessage(`AI 功能已在 GitLens 设置中被禁用。`, { modal: true }, enable);
			if (result === enable) {
				reenable = true;
			}
		}

		if (reenable) {
			await container.ai.enable(source);
			return true;
		}

		return false;
	}

	return true;
}

export function getAIResultContext(result: AIResponse<any>): AIResultContext {
	return {
		id: result.id,
		type: result.type,
		feature: result.feature,
		model: result.model,
		usage:
			result.usage != null
				? {
						promptTokens: result.usage.promptTokens,
						completionTokens: result.usage.completionTokens,
						totalTokens: result.usage.totalTokens,
						limits:
							result.usage.limits != null
								? {
										used: result.usage.limits.used,
										limit: result.usage.limits.limit,
										resetsOn: result.usage.limits.resetsOn.toISOString(),
									}
								: undefined,
					}
				: undefined,
	};
}

export function extractAIResultContext(container: Container, uri: Uri | undefined): AIResultContext | undefined {
	if (uri?.scheme === Schemes.GitLensAIMarkdown) {
		const { authority } = uri;
		if (!authority) return undefined;

		try {
			const context: AIResultContext | undefined = container.aiFeedback.getMarkdownDocument(uri.toString());
			if (context) return context;

			const metadata = decodeGitLensRevisionUriAuthority<MarkdownContentMetadata>(authority);
			return metadata.context;
		} catch (ex) {
			Logger.error(ex, 'extractResultContext');
			return undefined;
		}
	}

	// Check for untitled documents with stored changelog feedback context
	if (uri?.scheme === 'untitled') {
		try {
			return container.aiFeedback.getChangelogDocument(uri.toString());
		} catch {
			return undefined;
		}
	}

	return undefined;
}

export async function prepareCompareDataForAIRequest(
	svc: GitRepositoryService,
	headRef: string,
	baseRef: string,
	options?: {
		cancellation?: CancellationToken;
		reportNoDiffService?: () => void;
		reportNoCommitsService?: () => void;
		reportNoChanges?: () => void;
	},
): Promise<{ diff: string; logMessages: string } | undefined> {
	const { cancellation, reportNoDiffService, reportNoCommitsService, reportNoChanges } = options ?? {};
	const getDiff = svc.diff?.getDiff;
	if (getDiff == null) {
		if (reportNoDiffService) {
			reportNoDiffService();
			return;
		}
	}

	const getLog = svc.commits?.getLog;
	if (getLog === undefined) {
		if (reportNoCommitsService) {
			reportNoCommitsService();
			return;
		}
	}

	const [diffResult, logResult] = await Promise.allSettled([
		getDiff?.(headRef, baseRef, { notation: '...' }),
		getLog(`${baseRef}..${headRef}`),
	]);
	const diff = getSettledValue(diffResult);
	const log = getSettledValue(logResult);

	if (!diff?.contents || !log?.commits?.size) {
		reportNoChanges?.();
		return undefined;
	}

	if (cancellation?.isCancellationRequested) throw new CancellationError();

	const commitMessages: string[] = [];
	for (const commit of [...log.commits.values()].sort((a, b) => a.date.getTime() - b.date.getTime())) {
		const message = commit.message ?? commit.summary;
		if (message) {
			commitMessages.push(
				`<commit-message ${commit.date.toISOString()}>\n${commit.message ?? commit.summary}\n<end-of-commit-message>`,
			);
		}
	}

	return { diff: diff.contents, logMessages: commitMessages.join('\n\n') };
}
