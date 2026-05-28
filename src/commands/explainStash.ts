import type { TextEditor, Uri } from 'vscode';
import { ProgressLocation } from 'vscode';
import type { GitCommit, GitStashCommit } from '@gitlens/git/models/commit.js';
import { Logger } from '@gitlens/utils/logger.js';
import type { Container } from '../container.js';
import { showGenericErrorMessage } from '../messages.js';
import { showStashPicker } from '../quickpicks/stashPicker.js';
import { command } from '../system/-webview/command.js';
import type { CommandContext } from './commandContext.js';
import { isCommandContextViewNodeHasCommit } from './commandContext.utils.js';
import type { ExplainBaseArgs } from './explainBase.js';
import { ExplainCommandBase } from './explainBase.js';

export interface ExplainStashCommandArgs extends ExplainBaseArgs {
	rev?: string;
	prompt?: string;
}

@command()
export class ExplainStashCommand extends ExplainCommandBase {
	pickerTitle = '解释贮藏变更';
	repoPickerPlaceholder = '选择要解释贮藏的仓库';

	constructor(container: Container) {
		super(container, ['gitlens.ai.explainStash', 'gitlens.ai.explainStash:views']);
	}

	protected override preExecute(context: CommandContext, args?: ExplainStashCommandArgs): Promise<void> {
		// Check if the command is being called from a CommitNode
		if (isCommandContextViewNodeHasCommit<GitStashCommit>(context)) {
			args = { ...args };
			args.repoPath = args.repoPath ?? context.node.commit.repoPath;
			args.rev = args.rev ?? context.node.commit.sha;
			args.source = args.source ?? { source: 'view', context: { type: 'stash' } };
		}

		return this.execute(context.editor, context.uri, args);
	}

	async execute(editor?: TextEditor, uri?: Uri, args?: ExplainStashCommandArgs): Promise<void> {
		args = { ...args };

		const svc = await this.getRepositoryService(editor, uri, args);
		if (svc == null) {
			void showGenericErrorMessage('无法找到仓库');
			return;
		}

		try {
			let commit: GitCommit | undefined;
			if (args.rev == null) {
				const pick = await showStashPicker(svc.stash?.getStash(), this.pickerTitle, '选择要解释的贮藏');
				if (pick?.ref == null) return;

				args.rev = pick.ref;
				commit = pick;
			} else {
				commit = await svc.commits.getCommit(args.rev);
				if (commit == null) {
					void showGenericErrorMessage('无法找到指定的贮藏提交');
					return;
				}
			}

			const result = await this.container.ai.actions.explainCommit(
				commit,
				{
					...args.source,
					source: args.source?.source ?? 'commandPalette',
					context: { type: 'stash' },
				},
				{
					progress: { location: ProgressLocation.Notification, title: '正在解释贮藏...' },
					prompt: args.prompt,
				},
			);

			if (result === 'cancelled') return;

			if (result == null) {
				void showGenericErrorMessage('无法解释贮藏');
				return;
			}

			const { promise, model } = result;
			this.openDocument(promise, `/explain/stash/${commit.ref}/${model.id}`, model, 'explain-stash', {
				header: { title: '贮藏摘要', subtitle: commit.message || commit.ref },
				command: {
					label: '解释贮藏变更',
					name: 'gitlens.ai.explainStash',
					args: { repoPath: svc.path, rev: commit.ref, prompt: args.prompt, source: args.source },
				},
			});
		} catch (ex) {
			Logger.error(ex, 'ExplainStashCommand', 'execute');
			void showGenericErrorMessage('无法解释贮藏');
		}
	}
}
