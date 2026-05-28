import type { CancellationToken, ProgressOptions } from 'vscode';
import { ProgressLocation, window, workspace } from 'vscode';
import type { GitReference } from '@gitlens/git/models/reference.js';
import { createRevisionRange, shortenRevision } from '@gitlens/git/utils/revision.utils.js';
import type { Lazy } from '@gitlens/utils/lazy.js';
import { lazy } from '@gitlens/utils/lazy.js';
import { Logger } from '@gitlens/utils/logger.js';
import { pluralize } from '@gitlens/utils/string.js';
import type { Source } from '../constants.telemetry.js';
import type { Container } from '../container.js';
import { getChangesForChangelog } from '../git/utils/-webview/log.utils.js';
import { showGenericErrorMessage } from '../messages.js';
import type { AIGenerateChangelogChanges } from '../plus/ai/actions/generateChangelog.js';
import { getAIResultContext } from '../plus/ai/utils/-webview/ai.utils.js';
import { showComparisonPicker } from '../quickpicks/comparisonPicker.js';
import { command } from '../system/-webview/command.js';
import { GlCommandBase } from './commandBase.js';

export interface GenerateChangelogCommandArgs {
	repoPath?: string;
	head?: GitReference;
	base?: GitReference;
	source?: Source;
}

@command()
export class GenerateChangelogCommand extends GlCommandBase {
	constructor(private readonly container: Container) {
		super('gitlens.ai.generateChangelog');
	}

	async execute(args?: GenerateChangelogCommandArgs): Promise<void> {
		try {
			const result = await showComparisonPicker(this.container, args?.repoPath, {
				head: args?.head,
				base: args?.base,
				getTitleAndPlaceholder: step => {
					switch (step) {
						case 1:
							return {
								title: '生成更新日志',
								placeholder: '选择要为其生成更新日志的引用（分支、标签等）',
							};
						case 2:
							return {
								title: `生成更新日志 \u2022 选择起始基准`,
								placeholder: '选择用于生成更新日志的基准引用（分支、标签等）',
							};
					}
				},
			});
			if (result == null) return;

			const svc = this.container.git.getRepositoryService(result.repoPath);

			const mergeBase = await svc.refs.getMergeBase(result.head.ref, result.base.ref);

			await generateChangelogAndOpenMarkdownDocument(
				this.container,
				lazy(async () => {
					const range: AIGenerateChangelogChanges['range'] = {
						base: mergeBase
							? {
									ref: mergeBase,
									label:
										mergeBase === result.base.ref
											? `\`${shortenRevision(mergeBase)}\``
											: `\`${result.base.ref}@${shortenRevision(mergeBase)}\``,
								}
							: { ref: result.base.ref, label: `\`${result.base.ref}\`` },
						head: { ref: result.head.ref, label: `\`${result.head.ref}\`` },
					};

					const log = await svc.commits.getLog(
						createRevisionRange(mergeBase ?? result.base.ref, result.head.ref, '..'),
					);
					if (!log?.commits?.size) return { changes: [], range: range };

					const changes = getChangesForChangelog(this.container, range, log);
					return changes;
				}),
				args?.source ?? { source: 'commandPalette' },
				{ progress: { location: ProgressLocation.Notification } },
			);
		} catch (ex) {
			Logger.error(ex, 'GenerateChangelogCommand', 'execute');
			void showGenericErrorMessage('无法生成更新日志');
		}
	}
}

export async function generateChangelogAndOpenMarkdownDocument(
	container: Container,
	changes: Lazy<Promise<AIGenerateChangelogChanges>>,
	source: Source,
	options?: { cancellation?: CancellationToken; progress?: ProgressOptions },
): Promise<void> {
	const result = await container.ai.actions.generateChangelog(changes, source, options);
	if (result === 'cancelled') return;

	const {
		range,
		changes: { length: count },
	} = await changes.value;
	const feedbackContext = result && getAIResultContext(result);

	let content = `# ${range.head.label ?? range.head.ref} 的更新日志\n`;
	if (result != null) {
		content += `> 由 ${result.model.name} 生成，基于 ${count} 次提交，范围为 ${
			range.head.label ?? range.head.ref
		} 与 ${range.base.label ?? range.base.ref}\n`;

		// Add feedback note if telemetry is enabled
		if (feedbackContext && container.telemetry.enabled) {
			content += '\n\n';
			content += '可使用编辑器工具栏中的 👍 和 👎 按钮对本次 AI 响应进行反馈。';
			content += '*你的反馈可帮助我们改进 AI 功能。*';
		}

		content += `\n\n----\n\n${result.result}\n`;
	} else {
		content += `> 在 ${range.head.label ?? range.head.ref} 与 ${
			range.base.label ?? range.base.ref
		} 之间未找到变更\n`;
	}

	// open an untitled editor
	const document = await workspace.openTextDocument({ language: 'markdown', content: content });
	if (feedbackContext) {
		// Store feedback context for this document
		container.aiFeedback.addChangelogDocument(document.uri, feedbackContext);
	}
	await window.showTextDocument(document);
}
