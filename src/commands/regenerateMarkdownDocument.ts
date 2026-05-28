import type { TextEditor, Uri } from 'vscode';
import { window } from 'vscode';
import { decodeGitLensRevisionUriAuthority } from '@gitlens/git/utils/uriAuthority.js';
import { Logger } from '@gitlens/utils/logger.js';
import { Schemes } from '../constants.js';
import type { MarkdownContentMetadata } from '../documents/markdown.js';
import { command, executeCommand } from '../system/-webview/command.js';
import { ActiveEditorCommand } from './commandBase.js';
import { getCommandUri } from './commandBase.utils.js';

@command()
export class RegenerateMarkdownDocumentCommand extends ActiveEditorCommand {
	constructor() {
		super('gitlens.regenerateMarkdownDocument');
	}

	async execute(editor?: TextEditor, uri?: Uri): Promise<void> {
		uri = getCommandUri(uri, editor);
		if (uri == null) return;

		// Only work with gitlens-ai-markdown scheme documents
		if (uri.scheme !== Schemes.GitLensAIMarkdown) {
			void window.showErrorMessage('此操作只能用于 GitLens AI markdown 文档。');
			return;
		}

		// Extract the command from the authority
		const authority = uri.authority;
		if (authority == null || authority.length === 0) {
			void window.showErrorMessage('未找到此文档的重新生成命令。');
			return;
		}

		try {
			const metadata = decodeGitLensRevisionUriAuthority<MarkdownContentMetadata>(authority);

			if (metadata.command == null) {
				void window.showErrorMessage('未找到此文档的重新生成命令。');
				return;
			}

			// Execute the command that was encoded in the authority
			// The openDocument method in the regeneration command will automatically
			// detect content changes and fire the _onDidChange event to refresh the preview
			await executeCommand(metadata.command.name, metadata.command.args);
		} catch (ex) {
			Logger.error(ex, 'RegenerateMarkdownDocumentCommand');
			void window.showErrorMessage('重新生成文档失败。请查看输出了解更多详情。');
		}
	}
}
