import type { MessageItem } from 'vscode';
import { ConfigurationTarget, window } from 'vscode';
import { resetAvatarCache } from '../avatars.js';
import type { Container } from '../container.js';
import type { QuickPickItemOfT } from '../quickpicks/items/common.js';
import { createQuickPickSeparator } from '../quickpicks/items/common.js';
import { command } from '../system/-webview/command.js';
import { configuration } from '../system/-webview/configuration.js';
import { GlCommandBase } from './commandBase.js';

const resetTypes = [
	'ai',
	'ai:confirmations',
	'avatars',
	'integrations',
	'onboarding',
	'previews',
	'promoOptIns',
	'repositoryAccess',
	'subscription',
	'suppressedWarnings',
	'workspace',
] as const;
type ResetType = 'all' | (typeof resetTypes)[number];

@command()
export class ResetCommand extends GlCommandBase {
	constructor(private readonly container: Container) {
		super('gitlens.reset');
	}
	async execute(): Promise<void> {
		type ResetQuickPickItem = QuickPickItemOfT<ResetType>;

		const items: ResetQuickPickItem[] = [
			{
				label: 'AI 密钥...',
				detail: '清除本地存储的 AI 密钥',
				item: 'ai',
			},
			{
				label: 'AI 确认项...',
				detail: '清除已接受的 AI 确认项',
				item: 'ai:confirmations',
			},
			{
				label: '头像缓存...',
				detail: '清除已存储的头像缓存',
				item: 'avatars',
			},
			{
				label: '集成（认证）...',
				detail: '清除本地存储的集成认证信息',
				item: 'integrations',
			},
			{
				label: '入门引导...',
				detail: '重置已关闭的横幅/通知和使用跟踪 — 恢复首次体验',
				item: 'onboarding',
			},
			{
				label: '仓库访问...',
				detail: '清除已存储的仓库访问缓存',
				item: 'repositoryAccess',
			},
			{
				label: '已抑制警告...',
				detail: '清除已抑制的警告，例如带有“不要再显示”选项的消息',
				item: 'suppressedWarnings',
			},
			{
				label: '工作区存储...',
				detail: '清除与当前工作区关联的已存储数据',
				item: 'workspace',
			},
			createQuickPickSeparator(),
			{
				label: '全部...',
				description: ' — \u00a0请务必谨慎操作！',
				detail: '清除所有本地存储数据；所有 GitLens 状态都将丢失',
				item: 'all',
			},
		];

		if (DEBUG) {
			items.push(
				createQuickPickSeparator('DEBUG'),
				{
					label: '重置订阅...',
					detail: '重置已存储的订阅信息',
					item: 'subscription',
				},
				{
					label: '重置功能预览...',
					detail: '重置功能预览的已存储状态',
					item: 'previews',
				},
				{
					label: '促销订阅意向...',
					detail: '清除本地存储的促销订阅意向',
					item: 'promoOptIns',
				},
			);
		}

		// create a quick pick with options to clear all the different resets that GitLens supports
		const pick = await window.showQuickPick<ResetQuickPickItem>(items, {
			title: '重置已存储数据',
			placeHolder: '选择要重置的数据，随后将提示确认',
		});

		if (pick?.item == null) return;

		const confirm: MessageItem = { title: '重置' };
		const cancel: MessageItem = { title: '取消', isCloseAffordance: true };

		let confirmationMessage: string | undefined;
		switch (pick?.item) {
			case 'all':
				confirmationMessage = '您确定要重置全部数据吗？';
				confirm.title = '重置全部';
				break;
			case 'ai':
				confirmationMessage = '您确定要重置所有已存储的 AI 密钥吗？';
				confirm.title = '重置 AI 密钥';
				break;
			case 'ai:confirmations':
				confirmationMessage = '您确定要重置所有 AI 确认项吗？';
				confirm.title = '重置 AI 确认项';
				break;
			case 'avatars':
				confirmationMessage = '您确定要重置头像缓存吗？';
				confirm.title = '重置头像缓存';
				break;
			case 'integrations':
				confirmationMessage = '您确定要重置所有已存储的集成信息吗？';
				confirm.title = '重置集成';
				break;
			case 'onboarding':
				confirmationMessage = '您确定要重置入门引导/首次体验吗？这将清除所有已关闭的横幅/通知和使用跟踪。';
				confirm.title = '重置入门引导';
				break;
			case 'previews':
				confirmationMessage = '您确定要重置功能预览的已存储状态吗？';
				confirm.title = '重置功能预览';
				break;
			case 'promoOptIns':
				confirmationMessage = '您确定要重置所有本地存储的促销订阅意向吗？';
				confirm.title = '重置促销订阅意向';
				break;
			case 'repositoryAccess':
				confirmationMessage = '您确定要重置仓库访问缓存吗？';
				confirm.title = '重置仓库访问';
				break;
			case 'subscription':
				confirmationMessage = '您确定要重置已存储的订阅信息吗？';
				confirm.title = '重置订阅';
				break;
			case 'suppressedWarnings':
				confirmationMessage = '您确定要重置所有已抑制警告吗？';
				confirm.title = '重置已抑制警告';
				break;
			case 'workspace':
				confirmationMessage = '您确定要重置当前工作区的已存储数据吗？';
				confirm.title = '重置工作区存储';
				break;
			default: {
				const _exhaustiveCheck: never = pick.item;
				break;
			}
		}

		if (confirmationMessage != null) {
			const result = await window.showWarningMessage(
				`此操作不可逆！\n${confirmationMessage}`,
				{ modal: true },
				confirm,
				cancel,
			);
			if (result !== confirm) return;
		}

		await this.reset(pick.item);
	}

	private async reset(reset: ResetType) {
		switch (reset) {
			case 'all':
				for (const r of resetTypes) {
					await this.reset(r);
				}

				await this.container.storage.reset();
				break;

			case 'ai':
				await this.container.ai.reset(true);
				break;

			case 'ai:confirmations':
				this.container.ai.resetConfirmations();
				break;

			case 'avatars':
				resetAvatarCache('all');
				break;

			case 'integrations':
				await this.container.integrations.reset();
				break;

			case 'onboarding':
				await this.container.onboarding.resetAll();
				await this.container.usage.reset();
				await this.container.storage.delete('home:sections:collapsed');

				// Deprecated keys — defensive cleanup in case migration didn't run
				await this.container.storage.delete('home:banners:dismissed');
				await this.container.storage.delete('home:sections:dismissed');
				await this.container.storage.delete('home:walkthrough:dismissed');
				await this.container.storage.delete('mcp:banner:dismissed');
				await this.container.storage.delete('views:scm:grouped:welcome:dismissed');
				await this.container.storage.delete('composer:onboarding:dismissed');
				await this.container.storage.delete('composer:onboarding:stepReached');
				break;

			case 'promoOptIns':
				await this.container.storage.deleteWithPrefix('gk:promo');
				break;

			case 'repositoryAccess':
				await this.container.git.clearAllRepoVisibilityCaches();
				break;

			case 'suppressedWarnings':
				await configuration.update('advanced.messages', undefined, ConfigurationTarget.Global);
				break;

			case 'workspace':
				await this.container.storage.resetWorkspace();
				break;
			default:
				if (DEBUG) {
					switch (reset) {
						case 'subscription':
							await this.container.storage.delete('premium:subscription');
							break;
						case 'previews':
							await this.container.storage.deleteWithPrefix('plus:preview');
							break;
					}
				}
				break;
		}
	}
}
