import type { MessageItem } from 'vscode';
import { window } from 'vscode';
import { urls } from '../../../../constants.js';
import type { Container } from '../../../../container.js';
import { openUrl } from '../../../../system/-webview/vscode/uris.js';

export async function confirmDraftStorage(container: Container): Promise<boolean> {
	if (container.storage.get('confirm:draft:storage', false)) return true;

	while (true) {
		const accept: MessageItem = { title: '继续' };
		const decline: MessageItem = { title: '取消', isCloseAffordance: true };
		const moreInfo: MessageItem = { title: '了解更多' };
		const security: MessageItem = { title: '安全' };
		const result = await window.showInformationMessage(
			`Cloud Patches 由 GitKraken 安全存储，任何拥有链接和 GitKraken 账号的人都可访问。`,
			{ modal: true },
			accept,
			moreInfo,
			security,
			decline,
		);

		if (result === accept) {
			void container.storage.store('confirm:draft:storage', true).catch();
			return true;
		}

		if (result === security) {
			void openUrl(urls.security);
			continue;
		}

		if (result === moreInfo) {
			void openUrl(urls.cloudPatches);
			continue;
		}

		return false;
	}
}
