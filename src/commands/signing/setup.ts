import type { TextEditor, Uri } from 'vscode';
import { window, workspace } from 'vscode';
import type { Container } from '../../container.js';
import { command } from '../../system/-webview/command.js';
import { GlCommandBase } from '../commandBase.js';
import { getCommandUri } from '../commandBase.utils.js';

export interface SetupSigningWizardCommandArgs {
	readonly repoPath?: string;
}

@command()
export class SetupSigningWizardCommand extends GlCommandBase {
	constructor(private readonly container: Container) {
		super('gitlens.git.setupCommitSigning');
	}

	async execute(editor?: TextEditor, uri?: Uri, args?: SetupSigningWizardCommandArgs): Promise<void> {
		// Get the repository
		let repository;
		if (args?.repoPath) {
			repository = this.container.git.getRepository(args.repoPath);
		} else {
			uri = getCommandUri(uri, editor);
			repository = this.container.git.getBestRepository(uri, editor);

			// If no repository found and there's a single workspace folder, use it
			if (repository == null && workspace.workspaceFolders?.length === 1) {
				repository = this.container.git.getRepository(workspace.workspaceFolders[0].uri);
			}

			// Final fallback to first available repository
			repository ??= this.container.git.getBestRepositoryOrFirst(uri, editor);
		}

		if (repository == null) {
			void window.showErrorMessage('未找到可用于配置签名的仓库');
			return;
		}

		// Check if the git provider supports getSigningConfig
		if (repository.git.config.getSigningConfig == null) {
			void window.showErrorMessage('当前 Git 提供程序不支持提交签名。');
			return;
		}

		// Check if signing is already configured
		const signingConfig = await repository.git.config.getSigningConfig();
		const alreadyConfigured = Boolean(signingConfig?.enabled && signingConfig?.signingKey);

		// Send telemetry event
		this.container.telemetry.sendEvent('commit/signing/setupWizard/opened', {
			alreadyConfigured: alreadyConfigured,
		});

		if (alreadyConfigured) {
			const reconfigure = '重新配置';
			const testSigning = '测试签名';
			const result = await window.showInformationMessage(
				`已使用 ${signingConfig?.format?.toUpperCase() ?? 'GPG'} 配置提交签名。`,
				{ modal: false },
				reconfigure,
				testSigning,
			);

			if (result === testSigning) {
				await this.testSigning(repository);
				return;
			} else if (result !== reconfigure) {
				return;
			}
		}

		// Show setup wizard
		await this.showSetupWizard(repository);
	}

	private async showSetupWizard(repository: ReturnType<typeof this.container.git.getRepository>): Promise<void> {
		if (repository == null) return;

		// Check if the git provider supports setSigningConfig
		if (repository.git.config.setSigningConfig == null) {
			void window.showErrorMessage('当前 Git 提供程序不支持提交签名。');
			return;
		}

		// TODO: Implement full setup wizard UI
		// For now, show a simple quick pick to choose signing format

		// Check Git version support for different signing formats
		const supportsSSH = await repository.git.supports('git:signing:ssh');
		const supportsX509 = await repository.git.supports('git:signing:x509');

		const options: Array<{
			label: string;
			description: string;
			detail: string;
			value: 'gpg' | 'ssh' | 'x509';
		}> = [
			{
				label: '$(key) GPG',
				description: '使用 GPG 对提交进行签名',
				detail: '使用 GPG (GNU Privacy Guard) 对提交进行签名',
				value: 'gpg',
			},
		];

		if (supportsSSH) {
			options.push({
				label: '$(key) SSH',
				description: '使用 SSH 对提交进行签名',
				detail: '使用 SSH 密钥对提交进行签名（需要 Git 2.34+）',
				value: 'ssh',
			});
		}

		if (supportsX509) {
			options.push({
				label: '$(key) X.509',
				description: '使用 X.509 对提交进行签名',
				detail: '使用 X.509 证书对提交进行签名（需要 Git 2.19+）',
				value: 'x509',
			});
		}

		const format = await window.showQuickPick(options, {
			title: '提交签名设置',
			placeHolder: '选择签名格式',
			ignoreFocusOut: true,
		});

		if (format == null) return;

		// Get signing key
		const placeholder = format.value === 'ssh' ? '~/.ssh/id_ed25519.pub' : '您的密钥 ID';
		let signingKey = await window.showInputBox({
			title: '提交签名设置',
			prompt: `输入您的 ${format.value.toUpperCase()} 签名密钥${format.value === 'ssh' ? '（文件路径）' : '（密钥 ID）'}`,
			placeHolder: placeholder,
			ignoreFocusOut: true,
		});

		// For SSH keys, use placeholder value if user pressed Enter without input
		signingKey = !signingKey && format.value === 'ssh' ? placeholder : signingKey;

		if (!signingKey) return;

		// Configure Git globally
		try {
			await repository.git.config.setSigningConfig?.(
				{
					enabled: true,
					format: format.value,
					signingKey: signingKey,
				},
				{ global: true },
			);

			const result = await window.showInformationMessage(
				`已全局配置提交签名，使用 ${format.value.toUpperCase()}。`,
				{ modal: false },
				'测试签名',
			);

			if (result === '测试签名') {
				await this.testSigning(repository);
			}

			// Send telemetry event for successful setup
			this.container.telemetry.sendEvent('commit/signing/setup', {
				format: format.value,
				keyGenerated: false, // We don't support key generation yet
			});
		} catch (ex) {
			void window.showErrorMessage(`配置提交签名失败：${ex instanceof Error ? ex.message : String(ex)}`);
		}
	}

	private async testSigning(repository: ReturnType<typeof this.container.git.getRepository>): Promise<void> {
		if (repository == null) return;

		// Check if the git provider supports validateSigningSetup
		if (repository.git.config.validateSigningSetup == null) {
			void window.showErrorMessage('当前 Git 提供程序不支持提交签名。');
			return;
		}

		// Validate signing setup
		const validation = await repository.git.config.validateSigningSetup();

		if (validation?.valid) {
			void window.showInformationMessage('✓ 提交签名已正确配置，可立即使用。');
		} else {
			void window.showWarningMessage(`提交签名验证失败：${validation?.error ?? '未知错误'}`);
		}
	}
}
