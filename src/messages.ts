import type { MessageItem } from 'vscode';
import { ConfigurationTarget, ThemeIcon, window } from 'vscode';
import type { SuppressedMessages } from './config.js';
import { urls } from './constants.js';
import type { Source } from './constants.telemetry.js';
import type { Container } from './container.js';
import type { BlameIgnoreRevsFileError, GitCommandContext } from './git/errors.js';
import { BlameIgnoreRevsFileBadRevisionError, GitCommandError } from './git/errors.js';
import type { GitCommit } from './git/models/commit.js';
import { mcpRegistrationAllowed } from './plus/gk/utils/-webview/mcp.utils.js';
import { executeCommand, executeCoreCommand } from './system/-webview/command.js';
import { configuration } from './system/-webview/configuration.js';
import { openUrl } from './system/-webview/vscode/uris.js';
import { filterMap } from './system/array.js';
import { Logger } from './system/logger.js';

export function showBlameInvalidIgnoreRevsFileWarningMessage(
	ex: BlameIgnoreRevsFileError | BlameIgnoreRevsFileBadRevisionError,
): Promise<MessageItem | undefined> {
	if (ex instanceof BlameIgnoreRevsFileBadRevisionError) {
		return showMessage(
			'error',
			`无法显示责任信息。Git 配置中的 blame.ignoreRevsFile 指定了无效的修订版 (${ex.revision})。`,
			'suppressBlameInvalidIgnoreRevsFileBadRevisionWarning',
		);
	}

	return showMessage(
		'error',
		`无法显示责任信息。Git 配置中指定的 blame.ignoreRevsFile (${ex.fileName}) 无效或缺失。`,
		'suppressBlameInvalidIgnoreRevsFileWarning',
	);
}

export function showCommitHasNoPreviousCommitWarningMessage(commit?: GitCommit): Promise<MessageItem | undefined> {
	if (commit == null) {
		return showMessage('info', '没有上一个提交。', 'suppressCommitHasNoPreviousCommitWarning');
	}
	return showMessage(
		'info',
		`提交 ${commit.shortSha} (${commit.author.name}, ${commit.formattedDate}) 没有上一个提交。`,
		'suppressCommitHasNoPreviousCommitWarning',
	);
}

export function showCommitNotFoundWarningMessage(message: string): Promise<MessageItem | undefined> {
	return showMessage('warn', `${message}。找不到该提交。`, 'suppressCommitNotFoundWarning');
}

export async function showCreatePullRequestPrompt(branch: string): Promise<boolean> {
	const create = { title: '创建拉取请求...' };
	const result = await showMessage(
		'info',
		`您是否要为分支 '${branch}' 创建拉取请求？`,
		'suppressCreatePullRequestPrompt',
		{ title: '不再显示' },
		create,
	);
	return result === create;
}

export async function showDebugLoggingWarningMessage(): Promise<boolean> {
	const disable = { title: '禁用调试日志' };
	const result = await showMessage(
		'warn',
		'GitLens 调试日志当前已启用。除非您要报告问题，否则建议禁用它。您要禁用它吗？',
		'suppressDebugLoggingWarning',
		{ title: '不再显示' },
		disable,
	);

	return result === disable;
}

export async function showGenericErrorMessage(message: string): Promise<void> {
	if (Logger.enabled('error')) {
		const result = await showMessage('error', `${message}。有关详细信息，请查看输出频道。`, undefined, null, {
			title: '打开输出频道',
		});

		if (result != null) {
			Logger.showOutputChannel();
		}
	} else {
		const result = await showMessage(
			'error',
			`${message}。如果错误持续存在，请启用调试日志并再试一次。`,
			undefined,
			null,
			{
				title: '启用调试日志',
			},
		);

		if (result != null) {
			void executeCommand('gitlens.enableDebugLogging');
		}
	}
}

function escapeShellArg(arg: string): string {
	// If the argument contains spaces, quotes, or special characters, wrap it in single quotes
	// and escape any single quotes within it
	if (/[\s"'`$\\|&;<>(){}[\]!*?#~]/.test(arg)) {
		// Escape single quotes by replacing ' with '\''
		return `'${arg.replace(/'/g, "'\\''")}'`;
	}
	return arg;
}

function showGitCommandInTerminal(gitCommand: GitCommandContext, error: GitCommandError<any>): void {
	const terminal = window.createTerminal({
		cwd: gitCommand.repoPath,
		name: 'GitLens',
		hideFromUser: false,
		iconPath: new ThemeIcon('gitlens-gitlens'),
		isTransient: true,
		message: `\x1b[1mGitLens attempted to run this Git command and it failed:\x1b[0m\r\n\x1b[31m${error.message}\x1b[0m\r\n\x1b[3mYou can run it again or modify it to diagnose the issue.\x1b[0m\r\n`,
	});
	const command = `git ${filterMap(gitCommand.args, a => (a != null ? escapeShellArg(a) : undefined)).join(' ')}`;
	terminal.sendText(command, false);
	terminal.show();
}

export async function showGitErrorMessage(error: Error | GitCommandError<any>, message?: string): Promise<void> {
	if (!GitCommandError.is(error)) {
		return void showGenericErrorMessage(message ?? error.message);
	}

	const { gitCommand } = error.details;
	message = message ?? error.message;
	const loggingEnabled = Logger.enabled('error');

	const openOutputChannelOrEnableLogging: MessageItem = {
		title: loggingEnabled ? 'Open Output Channel' : 'Enable Debug Logging',
	};
	const openInTerminalAction: MessageItem = { title: 'Open in Terminal' };

	const result = await showMessage(
		'error',
		`${message.endsWith('.') ? message : `${message}.`} ${loggingEnabled ? 'See output channel for more details.' : 'If the error persists, please enable debug logging and try again.'}`,
		undefined,
		null,
		...(gitCommand != null
			? [openInTerminalAction, openOutputChannelOrEnableLogging]
			: [openOutputChannelOrEnableLogging]),
	);

	if (result === openInTerminalAction) {
		showGitCommandInTerminal(gitCommand, error);
		return;
	}

	if (result === openOutputChannelOrEnableLogging) {
		if (loggingEnabled) {
			Logger.showOutputChannel();
		} else {
			void executeCommand('gitlens.enableDebugLogging');
		}
	}
}

export async function showBitbucketPRCommitLinksAppNotInstalledWarningMessage(revLink: string): Promise<void> {
	const allowAccess = { title: '允许访问' };
	const result = await showMessage(
		'warn',
		`GitLens 无法访问提交的 Bitbucket 拉取请求。
		通过访问 Bitbucket 上的 [此提交](${revLink}) 并在右下角 "Apps" 部分下单击 "Pull requests" 来允许访问
		或 [阅读我们的文档](https://help.gitkraken.com/gitlens/gitlens-troubleshooting/#enable-showing-bitbucket-pull-request-for-a-commit) 了解更多信息。`,
		'suppressBitbucketPRCommitLinksAppNotInstalledWarning',
		{ title: '不再显示' },
		allowAccess,
	);
	if (result === allowAccess) {
		void openUrl(revLink);
	}
}

export function showFileNotUnderSourceControlWarningMessage(message: string): Promise<MessageItem | undefined> {
	return showMessage(
		'warn',
		`${message}。该文件可能不在源代码管理下。`,
		'suppressFileNotUnderSourceControlWarning',
	);
}

export function showGitDisabledErrorMessage(): Promise<MessageItem | undefined> {
	return showMessage(
		'error',
		'GitLens 需要启用 Git。请重新启用 Git — 将 `git.enabled` 设置为 true 并重新加载。',
		'suppressGitDisabledWarning',
	);
}

export function showGitInvalidConfigErrorMessage(): Promise<MessageItem | undefined> {
	return showMessage(
		'error',
		'GitLens 无法使用 Git。您的 Git 配置似乎无效。请解决 Git 配置的任何问题并重新加载。',
	);
}

export function showGitMissingErrorMessage(): Promise<MessageItem | undefined> {
	return showMessage(
		'error',
		"GitLens 无法找到 Git。请确保已安装 Git。还要确保 Git 在 PATH 中，或者 'git.path' 指向其安装位置。",
		'suppressGitMissingWarning',
	);
}

export function showGitVersionUnsupportedErrorMessage(
	version: string,
	required: string,
): Promise<MessageItem | undefined> {
	return showMessage(
		'error',
		`GitLens 需要比当前安装的版本 (${version}) 更新的 Git 版本 (>= ${required})。请安装更新版本的 Git。`,
		'suppressGitVersionWarning',
	);
}

export async function showPreReleaseExpiredErrorMessage(version: string): Promise<void> {
	const upgrade = { title: '升级' };
	const switchToRelease = { title: '切换到正式版本' };
	const result = await showMessage(
		'error',
		`此预发布版本 (${version}) 的 GitLens 已过期。请升级到更新的预发布版本，或切换到正式版本。`,
		undefined,
		null,
		upgrade,
		switchToRelease,
	);

	if (result === upgrade) {
		void executeCoreCommand('workbench.extensions.installExtension', 'eamodio.gitlens', {
			installPreReleaseVersion: true,
		});
		void executeCoreCommand('workbench.extensions.action.extensionUpdates');
	} else if (result === switchToRelease) {
		void executeCoreCommand('workbench.extensions.action.installExtensions');
		void executeCoreCommand('workbench.extensions.action.switchToRelease', 'eamodio.gitlens');
	}
}

export function showLineUncommittedWarningMessage(message: string): Promise<MessageItem | undefined> {
	return showMessage('warn', `${message}。该行有未提交的更改。`, 'suppressLineUncommittedWarning');
}

export function showNoRepositoryWarningMessage(message: string): Promise<MessageItem | undefined> {
	return showMessage('warn', `${message}。未找到存储库。`, 'suppressNoRepositoryWarning');
}

export function showRebaseSwitchToTextWarningMessage(): Promise<MessageItem | undefined> {
	return showMessage(
		'warn',
		'关闭 git-rebase-todo 文件或变基编辑器将开始变基。',
		'suppressRebaseSwitchToTextWarning',
	);
}
export function showGkDisconnectedTooManyFailedRequestsWarningMessage(): Promise<MessageItem | undefined> {
	return showMessage(
		'error',
		`此会话已停止向 GitKraken 发送请求，因为失败的请求过多。`,
		'suppressGkDisconnectedTooManyFailedRequestsWarningMessage',
		undefined,
		{
			title: '确定',
		},
	);
}

export function showGkRequestFailed500WarningMessage(message: string): Promise<MessageItem | undefined> {
	return showMessage('error', message, 'suppressGkRequestFailed500Warning', undefined, {
		title: '确定',
	});
}

export function showGkRequestTimedOutWarningMessage(): Promise<MessageItem | undefined> {
	return showMessage('error', `GitKraken 请求超时。`, 'suppressGkRequestTimedOutWarning', undefined, {
		title: '确定',
	});
}

export function showIntegrationDisconnectedTooManyFailedRequestsWarningMessage(
	providerName: string,
): Promise<MessageItem | undefined> {
	return showMessage(
		'error',
		`与 ${providerName} 的深度集成已在此会话中断开连接，因为失败的请求过多。`,
		'suppressIntegrationDisconnectedTooManyFailedRequestsWarning',
		undefined,
		{
			title: '确定',
		},
	);
}

export function showIntegrationRequestFailed500WarningMessage(message: string): Promise<MessageItem | undefined> {
	return showMessage('error', message, 'suppressIntegrationRequestFailed500Warning', undefined, {
		title: '确定',
	});
}

export function showIntegrationRequestTimedOutWarningMessage(providerName: string): Promise<MessageItem | undefined> {
	return showMessage(
		'error',
		`${providerName} 请求超时。`,
		'suppressIntegrationRequestTimedOutWarning',
		undefined,
		{
			title: '确定',
		},
	);
}

export async function showWhatsNewMessage(majorVersion: string): Promise<void> {
	const confirm = { title: '确定', isCloseAffordance: true };
	const releaseNotes = { title: '查看发布说明' };
	const result = await showMessage(
		'info',
		`已升级到 GitLens ${majorVersion}${
			majorVersion === '17'
				? '，包含 GitLens Pro 中全新的 [GitKraken AI](https://gitkraken.com/solutions/gitkraken-ai?source=gitlens&product=gitlens&utm_source=gitlens-extension&utm_medium=in-app-links) 访问权限、AI 变更日志和拉取请求创建以及 Bitbucket 集成。'
				: " — 查看新功能。"
		}`,
		undefined,
		null,
		releaseNotes,
		confirm,
	);

	if (result === releaseNotes) {
		void openUrl(urls.releaseNotes);
	}
}

export async function showMcpMessage(container: Container, _current: string): Promise<void> {
	const isAutoInstallable = mcpRegistrationAllowed(container);
	const confirm = { title: 'OK', isCloseAffordance: true };
	const learnMore = { title: 'Learn More' };
	const install = { title: 'Install GitKraken MCP' };

	let result: MessageItem | undefined;
	if (isAutoInstallable) {
		result = await showMessage(
			'info',
			`GitLens adds the GitKraken MCP into your AI chat, leveraging Git and your integrations to provide context and perform actions.`,
			undefined,
			null,
			learnMore,
			confirm,
		);
	} else {
		result = await showMessage(
			'info',
			`Allow GitLens to add the GitKraken MCP into your AI chat, leveraging Git and your integrations (issues, PRs, etc) to provide context and perform actions. Saving you time and context switching.`,
			undefined,
			null,
			install,
			learnMore,
			confirm,
		);
	}

	if (result === install) {
		void executeCommand<Source>('gitlens.ai.mcp.install', { source: 'mcp-welcome-message' });
	}

	if (result === learnMore) {
		void openUrl(urls.helpCenterMCP);
	}
}

export async function showCursorMcpCleanupMessage(): Promise<void> {
	const learnMore = { title: 'Learn More' };
	const confirm = { title: 'OK', isCloseAffordance: true };

	const result = await showMessage(
		'info',
		`GitLens now registers the GitKraken MCP automatically in Cursor. You may have a duplicate entry in your Cursor \`mcp.json\` — remove \`mcpServers.GitKraken\` to clean it up.`,
		undefined,
		null,
		learnMore,
		confirm,
	);

	if (result === learnMore) {
		void openUrl(urls.helpCenterMCP);
	}
}

export async function showMessage(
	type: 'info' | 'warn' | 'error',
	message: string,
	suppressionKey?: SuppressedMessages,
	dontShowAgain: MessageItem | null = { title: '不再显示' },
	...actions: MessageItem[]
): Promise<MessageItem | undefined> {
	Logger.debug(`ShowMessage(${type}, '${message}', ${suppressionKey}, ${JSON.stringify(dontShowAgain)})`);

	if (suppressionKey != null && configuration.get(`advanced.messages.${suppressionKey}` as const)) {
		Logger.debug(`ShowMessage(${type}, '${message}', ${suppressionKey}, ${JSON.stringify(dontShowAgain)}) skipped`);
		return undefined;
	}

	if (suppressionKey != null && dontShowAgain !== null) {
		actions.push(dontShowAgain);
	}

	let result: MessageItem | undefined = undefined;
	switch (type) {
		case 'info':
			result = await window.showInformationMessage(message, ...actions);
			break;

		case 'warn':
			result = await window.showWarningMessage(message, ...actions);
			break;

		case 'error':
			result = await window.showErrorMessage(message, ...actions);
			break;
	}

	if (suppressionKey != null && (dontShowAgain === null || result === dontShowAgain)) {
		Logger.debug(
			`ShowMessage(${type}, '${message}', ${suppressionKey}, ${JSON.stringify(
				dontShowAgain,
			)}) don't show again requested`,
		);
		await suppressedMessage(suppressionKey);

		if (result === dontShowAgain) return undefined;
	}

	Logger.debug(
		`ShowMessage(${type}, '${message}', ${suppressionKey}, ${JSON.stringify(dontShowAgain)}) returned ${
			result != null ? result.title : result
		}`,
	);
	return result;
}

function suppressedMessage(suppressionKey: SuppressedMessages) {
	const messages = { ...configuration.get('advanced.messages') };

	messages[suppressionKey] = true;

	for (const [key, value] of Object.entries(messages)) {
		if (value !== true) {
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete messages[key as keyof typeof messages];
		}
	}

	return configuration.update('advanced.messages', messages, ConfigurationTarget.Global);
}
