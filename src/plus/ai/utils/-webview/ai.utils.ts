import type { CancellationToken, Disposable, QuickInputButton } from 'vscode';
import { env, ThemeIcon, Uri, window } from 'vscode';
import type { AIProviders } from '@gitlens/ai/constants.js';
import type { AIModel } from '@gitlens/ai/models/model.js';
import { getValidatedTemperature as _getValidatedTemperature } from '@gitlens/ai/utils/ai.utils.js';
import { decodeGitLensRevisionUriAuthority } from '@gitlens/git/utils/uriAuthority.js';
import { CancellationError } from '@gitlens/utils/cancellation.js';
import { formatNumeric } from '@gitlens/utils/date.js';
import { Logger } from '@gitlens/utils/logger.js';
import { getSettledValue } from '@gitlens/utils/promise.js';
import { getPossessiveForm, pluralize } from '@gitlens/utils/string.js';
import { Schemes } from '../../../../constants.js';
import type { Source } from '../../../../constants.telemetry.js';
import type { Container } from '../../../../container.js';
import type { MarkdownContentMetadata } from '../../../../documents/markdown.js';
import type { GitRepositoryService } from '../../../../git/gitRepositoryService.js';
import { getCommitDate } from '../../../../git/utils/-webview/commit.utils.js';
import { createDirectiveQuickPickItem, Directive } from '../../../../quickpicks/items/directive.js';
import { configuration } from '../../../../system/-webview/configuration.js';
import { getContext } from '../../../../system/-webview/context.js';
import { openSettingsEditor } from '../../../../system/-webview/vscode/editors.js';
import type { OrgAIConfig, OrgAIProvider } from '../../../gk/models/organization.js';
import { ensureAccountQuickPick } from '../../../gk/utils/-webview/acount.utils.js';
import type { AIResponse, AIResultContext } from '../../aiProviderService.js';

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

	if (!result && !silent) throw new CancellationError();

	return result;
}

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
	return _getValidatedTemperature(model, modelTemperature, configuration.get('ai.modelOptions.temperature'));
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
	for (const commit of [...log.commits.values()].sort(
		(a, b) => getCommitDate(a).getTime() - getCommitDate(b).getTime(),
	)) {
		const message = commit.message ?? commit.summary;
		if (message) {
			commitMessages.push(
				`<commit-message ${getCommitDate(commit).toISOString()}>\n${commit.message ?? commit.summary}\n<end-of-commit-message>`,
			);
		}
	}

	return { diff: diff.contents, logMessages: commitMessages.join('\n\n') };
}
