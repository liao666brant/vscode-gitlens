import type { MessageItem } from 'vscode';
import { window } from 'vscode';
import { Container } from '../../container.js';
import { configuration } from '../../system/-webview/configuration.js';
import type { ShowCreateDraft, ShowViewDraft } from '../../webviews/plus/patchDetails/registration.js';
import type { WebviewViewShowOptions } from '../../webviews/webviewsController.js';

type ShowCreateOrOpen = ShowCreateDraft | ShowViewDraft;

export async function showPatchesView(createOrOpen: ShowCreateOrOpen, options?: WebviewViewShowOptions): Promise<void> {
	if (!configuration.get('cloudPatches.enabled')) {
		const confirm: MessageItem = { title: '启用' };
		const cancel: MessageItem = { title: '取消', isCloseAffordance: true };
		const result = await window.showInformationMessage(
			'Cloud Patches 当前已禁用。是否启用？',
			{ modal: true },
			confirm,
			cancel,
		);

		if (result !== confirm) return;
		await configuration.updateEffective('cloudPatches.enabled', true);
	}

	if (createOrOpen.mode === 'create') {
		options = { ...options, preserveFocus: false, preserveVisibility: false };
	}
	return Container.instance.views.patchDetails.show(options, createOrOpen);
}
