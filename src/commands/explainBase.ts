import type { TextEditor, Uri } from 'vscode';
import type { AIModel } from '@gitlens/ai/models/model.js';
import { md5 } from '@gitlens/utils/crypto.js';
import type { GlCommands } from '../constants.commands.js';
import type { Container } from '../container.js';
import type { MarkdownContentMetadata } from '../documents/markdown.js';
import { getMarkdownHeaderContent } from '../documents/markdown.js';
import type { GitRepositoryService } from '../git/gitRepositoryService.js';
import { GitUri } from '../git/gitUri.js';
import type { AIExplainSourceContext } from '../plus/ai/actions/explainChanges.js';
import type { AIResponse, AIResultContext } from '../plus/ai/aiProviderService.js';
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

	protected openDocument(
		aiPromise: Promise<AIResponse<{ summary: string; body: string }> | 'cancelled' | undefined>,
		path: string,
		model: AIModel,
		feature: string,
		metadata: Omit<MarkdownContentMetadata, 'context'>,
	): void {
		openExplainDocument(this.container, aiPromise, path, model, feature, metadata);
	}
}

export function openExplainDocument(
	container: Container,
	aiPromise: Promise<AIResponse<{ summary: string; body: string }> | 'cancelled' | undefined>,
	path: string,
	model: AIModel,
	feature: string,
	metadata: Omit<MarkdownContentMetadata, 'context'>,
): void {
	const loadingContext: AIResultContext = {
		id: `loading-${md5(path)}`,
		type: 'explain-changes',
		feature: feature,
		model: model,
	};

	const metadataWithContext: MarkdownContentMetadata = { ...metadata, context: loadingContext };
	const headerContent = getMarkdownHeaderContent(metadataWithContext, container.telemetry.enabled);
	const loadingContent = `${headerContent}\n\n> 🤖 **正在生成解释...**\n> 请稍候，AI 正在分析变更并生成解释。内容准备好后本文档将自动更新。\n>\n> *这可能需要一些时间，取决于变更的复杂程度。*`;

	const documentUri = container.markdown.openDocument(
		loadingContent,
		path,
		metadata.header.title,
		metadataWithContext,
	);

	showMarkdownPreview(documentUri);

	void aiPromise.then(
		result => {
			if (result === 'cancelled') {
				const content = `${getMarkdownHeaderContent(metadataWithContext, container.telemetry.enabled)}\n\n---\n\n\u26a0\ufe0f **\u751f\u6210\u5df2\u53d6\u6d88**\n\nAI \u89e3\u91ca\u5728\u5b8c\u6210\u524d\u88ab\u53d6\u6d88\u3002`;
				container.markdown.updateDocument(documentUri, content);
				return;
			}

			if (result == null) {
				const content = `${getMarkdownHeaderContent(metadataWithContext, container.telemetry.enabled)}\n\n---\n\n❌ **生成失败**\n\n无法为变更生成解释。请重试。`;
				container.markdown.updateDocument(documentUri, content);
				return;
			}

			const context = getAIResultContext(result);
			const finalMetadata: MarkdownContentMetadata = { ...metadata, context: context };
			const content = `${getMarkdownHeaderContent(finalMetadata, container.telemetry.enabled)}\n\n${result.result.summary}\n\n${result.result.body}`;
			container.aiFeedback.setMarkdownDocument(documentUri.toString(), context);
			container.markdown.updateDocument(documentUri, content);
		},
		() => {
			const content = `${getMarkdownHeaderContent(metadataWithContext, container.telemetry.enabled)}\n\n---\n\n❌ **生成失败**\n\n无法为变更生成解释。请重试。`;
			container.markdown.updateDocument(documentUri, content);
		},
	);
}
