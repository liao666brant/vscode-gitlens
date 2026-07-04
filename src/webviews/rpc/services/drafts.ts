import { uncommitted, uncommittedStaged } from '@gitlens/git/models/revision.js';
import type { CreatePatchCommandArgs } from '../../../commands/patches.js';
import type { Container } from '../../../container.js';
import { executeCommand } from '../../../system/-webview/command.js';
import type { RpcServiceHost } from './types.js';

export class DraftsService {
	constructor(
		private readonly container: Container,
		_host: RpcServiceHost,
	) {
		void _host;
	}

	async copyWipPatchToClipboard(
		repoPath: string,
		scope: 'staged' | 'unstaged' | 'all',
		uris?: readonly string[],
	): Promise<void> {
		const to = scope === 'staged' ? uncommittedStaged : uncommitted;
		const args: CreatePatchCommandArgs = {
			repoPath: repoPath,
			to: to,
			title: to === uncommittedStaged ? '已暂存的更改' : '未提交的更改',
			uris: uris?.map(path => this.container.git.getAbsoluteUri(path, repoPath)),
		};

		await executeCommand<CreatePatchCommandArgs>('gitlens.copyPatchToClipboard', args);
	}
}
