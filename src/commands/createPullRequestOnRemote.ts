import { window } from 'vscode';
import type { Source } from '../constants.telemetry.js';
import type { Container } from '../container.js';
import type { GitRemote } from '../git/models/remote.js';
import type { CreatePullRequestRemoteResource } from '../git/models/remoteResource.js';
import { RemoteResourceType } from '../git/models/remoteResource.js';
import type { RemoteProvider } from '../git/remotes/remoteProvider.js';
import { getBranchMergeTargetName } from '../git/utils/-webview/branch.utils.js';
import { getBranchNameWithoutRemote, getRemoteNameFromBranchName } from '../git/utils/branch.utils.js';
import { getRepositoryOrShowPicker } from '../quickpicks/repositoryPicker.js';
import { command, executeCommand } from '../system/-webview/command.js';
import { GlCommandBase } from './commandBase.js';
import type { OpenOnRemoteCommandArgs } from './openOnRemote.js';

export interface CreatePullRequestOnRemoteCommandArgs {
	base: string | undefined;
	compare: string;
	remote: string;
	repoPath: string;

	clipboard?: boolean;
	describeWithAI?: boolean;
	source?: Source;
}

@command()
export class CreatePullRequestOnRemoteCommand extends GlCommandBase {
	constructor(private readonly container: Container) {
		super('gitlens.createPullRequestOnRemote');
	}

	async execute(args?: CreatePullRequestOnRemoteCommandArgs): Promise<void> {
		let repo;
		if (args?.repoPath != null) {
			repo = this.container.git.getRepository(args.repoPath);
		}
		repo ??= await getRepositoryOrShowPicker(this.container, '创建拉取请求', undefined, undefined);
		if (repo == null) return;

		if (args == null) {
			const branch = await repo.git.branches.getBranch();
			if (branch?.upstream == null) {
				void window.showErrorMessage(`无法为分支 \`${branch?.name}\` 创建拉取请求，因为它尚未发布到远程仓库。`);
				return;
			}

			args = {
				base: undefined,
				compare: branch.name,
				remote: getRemoteNameFromBranchName(branch.upstream.name),
				repoPath: repo.path,
			};
		}

		const compareRemote = await repo.git.remotes.getRemote(args.remote);
		if (compareRemote?.provider == null) {
			void window.showErrorMessage(
				`无法为分支 \`${args.compare}\` 创建拉取请求，因为它未关联受支持的远程提供程序。`,
			);
			return;
		}

		const providerId = compareRemote.provider.id;
		const remotes = (await repo.git.remotes.getRemotes({
			filter: r => r.provider?.id === providerId,
			sort: true,
		})) as GitRemote<RemoteProvider>[];

		if (args.base == null) {
			const branch = await repo.git.branches.getBranch(args.compare);
			if (branch != null) {
				const mergeTargetResult = await getBranchMergeTargetName(this.container, branch);
				if (!mergeTargetResult.paused && mergeTargetResult.value != null) {
					// Strip the remote name from the branch name
					args.base = getBranchNameWithoutRemote(mergeTargetResult.value);
				}
			}
		}

		const resource: CreatePullRequestRemoteResource = {
			type: RemoteResourceType.CreatePullRequest,
			repoPath: repo.path,
			base: {
				branch: args.base,
				remote: undefined!,
			},
			head: {
				branch: args.compare,
				remote: { path: compareRemote.path, url: compareRemote.url, name: compareRemote.name },
			},
			details: args.describeWithAI ? { describeWithAI: true } : undefined,
		};

		void (await executeCommand<OpenOnRemoteCommandArgs>('gitlens.openOnRemote', {
			resource: resource,
			remotes: remotes,
		}));
	}
}
