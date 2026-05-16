import type { TextEditor, Uri } from 'vscode';
import { md5 } from '@env/crypto.js';
import type { GlCommands } from '../constants.commands.js';
import type { Container } from '../container.js';
import type { MarkdownContentMetadata } from '../documents/markdown.js';
import { getMarkdownHeaderContent } from '../documents/markdown.js';
import type { GitRepositoryService } from '../git/gitRepositoryService.js';
import { GitUri } from '../git/gitUri.js';
import type { AIExplainSourceContext } from '../plus/ai/actions/explainChanges.js';
import type { AIResponse, AIResultContext } from '../plus/ai/aiProviderService.js';
import type { AIModel } from '../plus/ai/models/model.js';
import { getAIResultContext } from '../plus/ai/utils/-webview/ai.utils.js';
import { getBestRepositoryOrShowPicker } from '../quickpicks/repositoryPicker.js';
import { showMarkdownPreview } from '../system/-webview/markdown.js';
import { GlCommandBase } from './commandBase.js';
import { getCommandUri } from './commandBase.utils.js';

export interface ExplainBaseArgs {
	worktreePath?: string | Uri;
	repoPath?: string | Uri;
	source?: AIExplainSourceContext;
}

export abstract class ExplainCommandBase extends GlCommandBase {
	abstract pickerTitle: string;
	abstract repoPickerPlaceholder: string;

	constructor(
		protected readonly container: Container,
		command: GlCommands | GlCommands[],
	) {
		super(command);
	}

	protected async getRepositoryService(
		editor?: TextEditor,
		uri?: Uri,
		args?: ExplainBaseArgs,
	): Promise<GitRepositoryService | undefined> {
		let svc;
		if (args?.worktreePath) {
			svc = this.container.git.getRepositoryService(args.worktreePath);
		} else if (args?.repoPath) {
			svc = this.container.git.getRepositoryService(args.repoPath);
		} else {
			uri = getCommandUri(uri, editor);
			const gitUri = uri != null ? await GitUri.fromUri(uri) : undefined;
			const repository = await getBestRepositoryOrShowPicker(
				this.container,
				gitUri,
				editor,
				this.pickerTitle,
				this.repoPickerPlaceholder,
			);

			svc = repository?.git;
		}

		return svc;
	}

	/**
	 * Opens a document immediately with loading state, then updates it when AI content is ready
	 */
	protected openDocument(
		aiPromise: Promise<AIResponse<{ summary: string; body: string }> | 'cancelled' | undefined>,
		path: string,
		model: AIModel,
		feature: string,
		metadata: Omit<MarkdownContentMetadata, 'context'>,
	): void {
		// Create a placeholder AI context for the loading state
		const loadingContext: AIResultContext = {
			id: `loading-${md5(path)}`,
			type: 'explain-changes',
			feature: feature,
			model: model,
		};

		const metadataWithContext: MarkdownContentMetadata = { ...metadata, context: loadingContext };
		const headerContent = getMarkdownHeaderContent(metadataWithContext, this.container.telemetry.enabled);
		const loadingContent = `${headerContent}\n\n> 🤖 **正在生成解释...**\n> 请稍候，AI 正在分析变更并生成解释。内容准备好后本文档将自动更新。\n>\n> *这可能需要一些时间，取决于变更的复杂程度。*`;

		// Open the document immediately with loading content
		const documentUri = this.container.markdown.openDocument(
			loadingContent,
			path,
			metadata.header.title,
			metadataWithContext,
		);

		showMarkdownPreview(documentUri);

		// Update the document when AI content is ready
		void this.updateDocumentWhenReady(documentUri, aiPromise, metadataWithContext);
	}

	/**
	 * Updates the document content when AI generation completes
	 */
	private async updateDocumentWhenReady(
		documentUri: Uri,
		aiPromise: Promise<AIResponse<{ summary: string; body: string }> | 'cancelled' | undefined>,
		metadata: MarkdownContentMetadata,
	): Promise<void> {
		try {
			const result = await aiPromise;

			if (result === 'cancelled') {
				// Update with cancellation message
				const cancelledContent = this.createCancelledContent(metadata);
				this.container.markdown.updateDocument(documentUri, cancelledContent);
				return;
			}

			if (result == null) {
				// Update with error message
				const errorContent = this.createErrorContent(metadata);
				this.container.markdown.updateDocument(documentUri, errorContent);
				return;
			}

			// Update with successful AI content
			this.updateDocumentWithResult(documentUri, result, metadata);
		} catch (_error) {
			// Update with error message
			const errorContent = this.createErrorContent(metadata);
			this.container.markdown.updateDocument(documentUri, errorContent);
		}
	}

	/**
	 * Updates the document with successful AI result
	 */
	private updateDocumentWithResult(
		documentUri: Uri,
		result: AIResponse<{ summary: string; body: string }>,
		metadata: MarkdownContentMetadata,
	): void {
		const context = getAIResultContext(result);
		const metadataWithContext: MarkdownContentMetadata = { ...metadata, context: context };
		const headerContent = getMarkdownHeaderContent(metadataWithContext, this.container.telemetry.enabled);
		const content = `${headerContent}\n\n${result.result.summary}\n\n${result.result.body}`;

		// Store the AI result context in the feedback provider for documents that cannot store it in their URI
		this.container.aiFeedback.setMarkdownDocument(documentUri.toString(), context);

		this.container.markdown.updateDocument(documentUri, content);
	}

	/**
	 * Creates content for cancelled AI generation
	 */
	private createCancelledContent(metadata: MarkdownContentMetadata): string {
		const headerContent = getMarkdownHeaderContent(metadata, this.container.telemetry.enabled);
		return `${headerContent}\n\n---\n\n\u26a0\ufe0f **\u751f\u6210\u5df2\u53d6\u6d88**\n\nAI \u89e3\u91ca\u5728\u5b8c\u6210\u524d\u88ab\u53d6\u6d88\u3002`;
	}

	/**
	 * Creates content for failed AI generation
	 */
	private createErrorContent(metadata: MarkdownContentMetadata): string {
		const headerContent = getMarkdownHeaderContent(metadata, this.container.telemetry.enabled);
		return `${headerContent}\n\n---\n\n❌ **生成失败**\n\n无法为变更生成解释。请重试。`;
	}
}
