import { env, Range, Uri, window } from 'vscode';
import { Schemes } from '../constants.js';
import type { Container } from '../container.js';
import { command } from '../system/-webview/command.js';
import { openTextEditor } from '../system/-webview/vscode/editors.js';
import { GlCommandBase } from './commandBase.js';

@command()
export class OpenFileFromRemoteCommand extends GlCommandBase {
	constructor(private readonly container: Container) {
		super('gitlens.openFileFromRemote');
	}

	async execute(): Promise<void> {
		await openFileOreRevisionFromRemote(this.container, 'file');
	}
}

@command()
export class OpenRevisionFromRemoteCommand extends GlCommandBase {
	constructor(private readonly container: Container) {
		super('gitlens.openRevisionFromRemote');
	}

	async execute(): Promise<void> {
		await openFileOreRevisionFromRemote(this.container, 'revision');
	}
}

async function openFileOreRevisionFromRemote(container: Container, type: 'file' | 'revision'): Promise<void> {
	let clipboard: string | undefined = await env.clipboard.readText();
	try {
		Uri.parse(clipboard, true);
	} catch {
		clipboard = undefined;
	}

	const url = await window.showInputBox({
		prompt: '输入要打开的远程文件 URL',
		placeHolder: '远程文件 URL',
		value: clipboard,
		ignoreFocusOut: true,
	});
	if (!url?.length) return;

	const local = await container.git.getLocalInfoFromRemoteUri(Uri.parse(url));
	if (local == null) {
		void window.showWarningMessage('无法解析提供的远程 URL。');
		return;
	}

	let { uri } = local;
	if (type === 'revision' && uri.scheme === Schemes.File && local.rev) {
		uri =
			(await container.git
				.getRepositoryService(local.repoPath)
				.getBestRevisionUri(local.uri.fsPath, local.rev)) ?? uri;
	}

	let selection;
	if (local.startLine) {
		if (local.endLine) {
			selection = new Range(local.startLine - 1, 0, local.endLine, 0);
		} else {
			selection = new Range(local.startLine - 1, 0, local.startLine - 1, 0);
		}
	}

	try {
		await openTextEditor(uri, { selection: selection, throwOnError: true });
	} catch {
		const uris = await window.showOpenDialog({
			title: '打开本地文件',
			defaultUri: uri,
			canSelectMany: false,
			canSelectFolders: false,
		});
		if (!uris?.length) return;

		await openTextEditor(uris[0]);
	}
}
