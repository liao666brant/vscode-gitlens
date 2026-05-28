import type { GitRemote } from '@gitlens/git/models/remote.js';
import type { RemoteProvider } from '@gitlens/git/models/remoteProvider.js';
import type { RemoteResource } from '@gitlens/git/models/remoteResource.js';
import { RemoteResourceType } from '@gitlens/git/models/remoteResource.js';
import { getHighlanderProviders } from '@gitlens/git/utils/remote.utils.js';
import { createRevisionRange, shortenRevision } from '@gitlens/git/utils/revision.utils.js';
import { ensureArray } from '@gitlens/utils/array.js';
import { Logger } from '@gitlens/utils/logger.js';
import { pad, splitSingle } from '@gitlens/utils/string.js';
import { GlyphChars } from '../constants.js';
import type { Container } from '../container.js';
import { findCommitFile } from '../git/utils/-webview/commit.utils.js';
import { showGenericErrorMessage } from '../messages.js';
import { showRemoteProviderPicker } from '../quickpicks/remoteProviderPicker.js';
import { command } from '../system/-webview/command.js';
import { GlCommandBase } from './commandBase.js';

export type OpenOnRemoteCommandArgs =
	| {
			resource: RemoteResource | RemoteResource[];
			repoPath: string;

			remote?: string;
			clipboard?: boolean;
	  }
	| {
			resource: RemoteResource | RemoteResource[];
			remotes: GitRemote<RemoteProvider>[];

			remote?: string;
			clipboard?: boolean;
	  };

@command()
export class OpenOnRemoteCommand extends GlCommandBase {
	constructor(private readonly container: Container) {
		super(['gitlens.openOnRemote'], ['gitlens.openInRemote']);
	}

	async execute(args?: OpenOnRemoteCommandArgs): Promise<void> {
		if (args?.resource == null) return;

		let remotes =
			'remotes' in args
				? args.remotes
				: await this.container.git
						.getRepositoryService(args.repoPath)
						.remotes.getRemotesWithProviders({ sort: true });

		if (args.remote != null) {
			const filtered = remotes.filter((r: GitRemote) => r.name === args.remote);
			// Only filter if we get some results
			if (remotes.length > 0) {
				remotes = filtered;
			}
		}

		async function processResource(this: OpenOnRemoteCommand, resource: RemoteResource) {
			try {
				if (resource.type === RemoteResourceType.Branch) {
					// Check to see if the remote is in the branch
					const [remoteName, branchName] = splitSingle(resource.branch, '/');
					if (branchName != null) {
						const remote = remotes.find((r: GitRemote) => r.name === remoteName);
						if (remote != null) {
							resource.branch = branchName;
							remotes = [remote];
						}
					}
				} else if (resource.type === RemoteResourceType.Revision) {
					const { commit, fileName } = resource;
					if (commit != null) {
						const file = await findCommitFile(commit, fileName);
						if (file?.status === 'D') {
							// Resolve to the previous commit to that file
							resource.sha = (
								await this.container.git
									.getRepositoryService(commit.repoPath)
									.revision.resolveRevision(`${commit.sha}^`, fileName)
							).sha;
						} else {
							resource.sha = commit.sha;
						}
					}
				}
			} catch (ex) {
				debugger;
				Logger.error(ex, 'OpenOnRemoteCommand.processResource');
			}
		}

		try {
			const resources = ensureArray(args.resource);
			for (const resource of resources) {
				await processResource.call(this, resource);
			}

			const providers = getHighlanderProviders(remotes);
			const provider = providers?.length ? providers[0].name : 'Remote';

			const options: Parameters<typeof showRemoteProviderPicker>[4] = {
				autoPick: 'default',
				clipboard: args.clipboard,
				setDefault: true,
			};

			let title;
			let placeholder = args.clipboard
				? `选择要复制链接的远程仓库（或使用齿轮图标设为默认）`
				: `选择要打开的远程仓库（或使用齿轮图标设为默认）`;

			function getTitlePrefix(type: string): string {
				return args?.clipboard ? `复制 ${provider} ${type} 链接` : `在 ${provider} 上打开${type}`;
			}

			const [resource] = resources;
			switch (resource.type) {
				case RemoteResourceType.Branch:
					title = getTitlePrefix('分支');
					if (resources.length === 1) {
						title += `${pad(GlyphChars.Dot, 2, 2)}${resource.branch}`;
					}
					break;

				case RemoteResourceType.Branches:
					title = getTitlePrefix('分支');
					break;

				case RemoteResourceType.Commit:
					title = getTitlePrefix('提交');
					if (resources.length === 1) {
						title += `${pad(GlyphChars.Dot, 2, 2)}${shortenRevision(resource.sha)}`;
					}
					break;

				case RemoteResourceType.Comparison:
					title = getTitlePrefix('比较');
					if (resources.length === 1) {
						title += `${pad(GlyphChars.Dot, 2, 2)}${createRevisionRange(
							resource.base,
							resource.head,
							resource.notation ?? '...',
						)}`;
					}
					break;

				case RemoteResourceType.CreatePullRequest:
					options.autoPick = true;
					options.setDefault = false;

					if (resources.length > 1) {
						title = args.clipboard
							? `复制 ${provider} 创建 Pull Request 链接`
							: `在 ${provider} 上创建 Pull Request`;

						placeholder = args.clipboard
							? `选择要复制创建 Pull Request 链接的远程仓库`
							: `选择要创建 Pull Request 的远程仓库`;
					} else {
						title = `${
							args.clipboard
								? `复制 ${provider} 创建 Pull Request 链接`
								: `在 ${provider} 上创建 Pull Request`
						}${pad(GlyphChars.Dot, 2, 2)}${
							resource.base?.branch
								? createRevisionRange(resource.base.branch, resource.head.branch, '...')
								: resource.head.branch
						}`;

						placeholder = args.clipboard
							? `选择要复制创建 Pull Request 链接的远程仓库`
							: `选择要创建 Pull Request 的远程仓库`;
					}
					break;

				case RemoteResourceType.File:
					title = getTitlePrefix('文件');
					if (resources.length === 1) {
						title += `${pad(GlyphChars.Dot, 2, 2)}${resource.fileName}`;
					}
					break;

				case RemoteResourceType.Repo:
					title = getTitlePrefix('仓库');
					break;

				case RemoteResourceType.Revision: {
					title = getTitlePrefix('文件');
					if (resources.length === 1) {
						title += `${pad(GlyphChars.Dot, 2, 2)}${shortenRevision(resource.sha)}${pad(
							GlyphChars.Dot,
							1,
							1,
						)}${resource.fileName}`;
					}
					break;
				}

				// case RemoteResourceType.Tag: {
				// 	title = getTitlePrefix('Tag');
				// 	if (resources.length === 1) {
				// 		title += `${pad(GlyphChars.Dot, 2, 2)}${args.resource.tag}`;
				// 	}
				// 	break;
				// }
			}

			const pick = await showRemoteProviderPicker(title, placeholder, resources, remotes, options);
			await pick?.execute();
		} catch (ex) {
			Logger.error(ex, 'OpenOnRemoteCommand');
			void showGenericErrorMessage('无法在远程提供程序中打开');
		}
	}
}
