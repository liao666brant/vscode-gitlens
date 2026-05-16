import { window } from 'vscode';
import type { Sources } from '../constants.telemetry.js';
import type { Container } from '../container.js';
import { command, executeCommand } from '../system/-webview/command.js';
import { getNodeRepoPath } from '../views/nodes/abstract/viewNode.js';
import type { ComposerWebviewShowingArgs } from '../webviews/plus/composer/registration.js';
import type { WebviewPanelShowCommandArgs } from '../webviews/webviewsController.js';
import { GlCommandBase } from './commandBase.js';
import type { CommandContext } from './commandContext.js';
import { isCommandContextViewNodeHasCommit } from './commandContext.utils.js';

export interface RecomposeFromCommitCommandArgs {
	repoPath?: string;
	commitSha?: string;
	branchName?: string;
	source?: Sources;
}

@command()
export class RecomposeFromCommitCommand extends GlCommandBase {
	constructor(private readonly container: Container) {
		super(['gitlens.recomposeFromCommit']);
	}

	protected override preExecute(context: CommandContext, args?: RecomposeFromCommitCommandArgs): Promise<void> {
		if (isCommandContextViewNodeHasCommit(context)) {
			args = { ...args };
			args.repoPath = args.repoPath ?? getNodeRepoPath(context.node);
			args.commitSha = args.commitSha ?? context.node.commit.sha;
			args.source = args.source ?? 'view';
		}

		return this.execute(args);
	}

	async execute(args?: RecomposeFromCommitCommandArgs): Promise<void> {
		try {
			if (!args?.commitSha) {
				void window.showErrorMessage('无法重组：缺少提交信息');
				return;
			}

			const repoPath = args.repoPath;
			if (!repoPath) {
				void window.showErrorMessage('无法重组：缺少仓库信息');
				return;
			}

			const repo = this.container.git.getRepository(repoPath);
			if (repo == null) {
				void window.showErrorMessage('未找到仓库');
				return;
			}

			const commit = await repo.git.commits.getCommit(args.commitSha);
			if (!commit) {
				void window.showErrorMessage(`未找到提交 '${args.commitSha}'`);
				return;
			}

			const branchName = args.branchName;
			if (!branchName) {
				void window.showErrorMessage('无法确定提交所在的分支');
				return;
			}

			const branch = await repo.git.branches.getBranch(branchName);
			if (!branch) {
				void window.showErrorMessage(`未找到分支 '${branchName}'`);
				return;
			}

			if (branch.remote && !branch.upstream) {
				void window.showErrorMessage(`无法重组仅存在于远程的分支 '${branchName}'`);
				return;
			}

			const headCommitSha = branch.sha;
			if (!headCommitSha) {
				void window.showErrorMessage(`无法确定分支 '${branchName}' 的 HEAD 提交`);
				return;
			}

			const baseCommitSha = commit.parents.length > 0 ? commit.parents[0] : undefined;
			if (!baseCommitSha) {
				void window.showErrorMessage('无法确定父提交');
				return;
			}

			await executeCommand<WebviewPanelShowCommandArgs<ComposerWebviewShowingArgs>>(
				'gitlens.showComposerPage',
				undefined,
				{
					repoPath: args.repoPath,
					source: args.source,
					mode: 'preview',
					branchName: branchName,
					range: { base: baseCommitSha, head: headCommitSha },
				},
			);
		} catch (ex) {
			void window.showErrorMessage(`从提交重组失败：${ex}`);
		}
	}
}
