import { ThemeIcon, window } from 'vscode';
import type { GitCommit } from '@gitlens/git/models/commit.js';
import type { GitFile } from '@gitlens/git/models/file.js';
import type { GitFileChange } from '@gitlens/git/models/fileChange.js';
import type { GitStatusFile } from '@gitlens/git/models/statusFile.js';
import { basename } from '@gitlens/utils/path.js';
import { pad } from '@gitlens/utils/string.js';
import type { OpenChangedFilesCommandArgs } from '../../commands/openChangedFiles.js';
import type { OpenOnlyChangedFilesCommandArgs } from '../../commands/openOnlyChangedFiles.js';
import {
	RevealInSideBarQuickInputButton,
	ShowDetailsViewQuickInputButton,
} from '../../commands/quick-wizard/quickButtons.js';
import type { Keys } from '../../constants.js';
import { GlyphChars } from '../../constants.js';
import { Container } from '../../container.js';
import {
	applyChanges,
	copyIdToClipboard,
	copyMessageToClipboard,
	explainCommit,
	openChanges,
	openChangesInDiffTool,
	openChangesWithWorking,
	openCommitChanges,
	openCommitChangesInDiffTool,
	openCommitChangesWithWorking,
	openDirectoryCompareWithPrevious,
	openDirectoryCompareWithWorking,
	openFile,
	openFileAtRevision,
	openFiles,
	openFilesAtRevision,
	restoreFile,
	showCommitInDetailsView,
	showCommitInGraph,
} from '../../git/actions/commit.js';
import { browseAtRevision } from '../../git/actions.js';
import { CommitFormatter } from '../../git/formatters/commitFormatter.js';
import { formatCommitStats, getCommitGitUri } from '../../git/utils/-webview/commit.utils.js';
import { getGitFileFormattedDirectory } from '../../git/utils/-webview/file.utils.js';
import { formatFileChangeStats } from '../../git/utils/-webview/fileChange.utils.js';
import { getGitFileStatusThemeIcon } from '../../git/utils/-webview/icons.js';
import type { CompareResultsNode } from '../../views/nodes/compareResultsNode.js';
import { CommandQuickPickItem } from './common.js';

export class CommitFilesQuickPickItem extends CommandQuickPickItem {
	constructor(
		readonly commit: GitCommit,
		options?: {
			file?: GitFileChange;
			unpublished?: boolean | undefined;
			picked?: boolean;
			hint?: string;
		},
	) {
		super(
			{
				label: commit.summary,
				description: `${CommitFormatter.fromTemplate(`\${author}, \${ago}  $(git-commit)  \${id}`, commit)}${
					options?.unpublished ? '  (未发布)' : ''
				}`,
				detail: `${
					options?.file != null
						? `$(file) ${basename(options.file.path)}${formatFileChangeStats(
								options.file.stats,
								'expanded',
								{
									separator: ', ',
									prefix: ` ${GlyphChars.Dot} `,
								},
							)}`
						: `$(files) ${formatCommitStats(commit.stats, 'expanded', {
								separator: ', ',
								empty: '未更改任何文件',
							})}`
				}${options?.hint != null ? `${pad(GlyphChars.Dash, 4, 2, GlyphChars.Space)}${options.hint}` : ''}`,
				alwaysShow: true,
				picked: options?.picked ?? true,
				buttons: [ShowDetailsViewQuickInputButton, RevealInSideBarQuickInputButton],
			},
			undefined,
			undefined,
			undefined,
			{ suppressKeyPress: true },
		);
	}

	get sha(): string {
		return this.commit.sha;
	}
}

export class CommitFileQuickPickItem extends CommandQuickPickItem {
	constructor(
		readonly commit: GitCommit,
		readonly file: GitFile,
		picked?: boolean,
	) {
		super({
			label: basename(file.path),
			description: getGitFileFormattedDirectory(file, true),
			picked: picked,
			iconPath: getGitFileStatusThemeIcon(file.status),
		});

		// TODO@eamodio - add line diff details
		// this.detail = this.commit.getFormattedDiffStatus({ expand: true });
	}

	get sha(): string {
		return this.commit.sha;
	}

	override execute(options?: { preserveFocus?: boolean; preview?: boolean }): Promise<void> {
		return openChanges(this.file, this.commit, options);
		// const fileCommit = await this.commit.getCommitForFile(this.file)!;

		// if (fileCommit.previousSha === undefined) {
		// 	void (await findOrOpenEditor(
		// 		GitUri.toRevisionUri(fileCommit.sha, this.file, fileCommit.repoPath),
		// 		options,
		// 	));

		// 	return;
		// }

		// const commandArgs: DiffWithPreviousCommandArgs = {
		// 	commit: fileCommit,
		// 	showOptions: options,
		// };
		// void (await executeCommand(Commands.DiffWithPrevious, fileCommit.toGitUri(), commandArgs));
	}
}

export class CommitBrowseRepositoryFromHereCommandQuickPickItem extends CommandQuickPickItem {
	constructor(
		private readonly commit: GitCommit,
		private readonly executeOptions?: {
			before?: boolean;
			openInNewWindow: boolean;
		},
	) {
		super(
			`从此处${executeOptions?.before ? '之前' : ''}浏览仓库${
				executeOptions?.openInNewWindow ? '（在新窗口中）' : ''
			}`,
		);
		this.iconPath = new ThemeIcon('folder-opened');
	}

	override execute(_options: { preserveFocus?: boolean; preview?: boolean }): Promise<void> {
		return browseAtRevision(getCommitGitUri(this.commit), {
			before: this.executeOptions?.before,
			openInNewWindow: this.executeOptions?.openInNewWindow,
		});
	}
}

export class CommitCompareWithHEADCommandQuickPickItem extends CommandQuickPickItem {
	constructor(private readonly commit: GitCommit) {
		super('与 HEAD 比较');
		this.iconPath = new ThemeIcon('compare-changes');
	}

	override execute(_options: { preserveFocus?: boolean; preview?: boolean }): Promise<CompareResultsNode> {
		return Container.instance.views.searchAndCompare.compare(this.commit.repoPath, this.commit.ref, 'HEAD');
	}
}

export class CommitCompareWithWorkingCommandQuickPickItem extends CommandQuickPickItem {
	constructor(private readonly commit: GitCommit) {
		super('与工作树比较', new ThemeIcon('compare-changes'));
	}

	override execute(_options: { preserveFocus?: boolean; preview?: boolean }): Promise<CompareResultsNode> {
		return Container.instance.views.searchAndCompare.compare(this.commit.repoPath, this.commit.ref, '');
	}
}

export class CommitCopyIdQuickPickItem extends CommandQuickPickItem {
	constructor(private readonly commit: GitCommit) {
		super('复制 SHA', new ThemeIcon('copy'));
	}

	override execute(): Promise<void> {
		return copyIdToClipboard(this.commit);
	}

	override async onDidPressKey(key: Keys): Promise<void> {
		await super.onDidPressKey(key);
		void window.showInformationMessage('提交 SHA 已复制到剪贴板');
	}
}

export class CommitCopyMessageQuickPickItem extends CommandQuickPickItem {
	constructor(private readonly commit: GitCommit) {
		super('复制消息', new ThemeIcon('copy'));
	}

	override execute(): Promise<void> {
		return copyMessageToClipboard(this.commit);
	}

	override async onDidPressKey(key: Keys): Promise<void> {
		await super.onDidPressKey(key);
		void window.showInformationMessage(`${this.commit.stashName ? '存储' : '提交'}消息已复制到剪贴板`);
	}
}

export class CommitOpenAllChangesCommandQuickPickItem extends CommandQuickPickItem {
	constructor(private readonly commit: GitCommit) {
		super('打开所有更改', new ThemeIcon('git-compare'));
	}

	override execute(options: { preserveFocus?: boolean; preview?: boolean }): Promise<void> {
		return openCommitChanges(Container.instance, this.commit, undefined, options);
	}
}

export class CommitOpenAllChangesWithDiffToolCommandQuickPickItem extends CommandQuickPickItem {
	constructor(private readonly commit: GitCommit) {
		super('打开所有更改（使用差异工具）', new ThemeIcon('git-compare'));
	}

	override execute(): Promise<void> {
		return openCommitChangesInDiffTool(this.commit);
	}
}

export class CommitOpenAllChangesWithWorkingCommandQuickPickItem extends CommandQuickPickItem {
	constructor(private readonly commit: GitCommit) {
		super('打开与工作树的所有更改', new ThemeIcon('git-compare'));
	}

	override execute(options: { preserveFocus?: boolean; preview?: boolean }): Promise<void> {
		return openCommitChangesWithWorking(Container.instance, this.commit, undefined, options);
	}
}

export class CommitOpenChangesCommandQuickPickItem extends CommandQuickPickItem {
	constructor(
		private readonly commit: GitCommit,
		private readonly file: string | GitFile,
	) {
		super('打开更改', new ThemeIcon('git-compare'));
	}

	override execute(options: { preserveFocus?: boolean; preview?: boolean }): Promise<void> {
		return openChanges(this.file, this.commit, options);
	}
}

export class CommitOpenChangesWithDiffToolCommandQuickPickItem extends CommandQuickPickItem {
	constructor(
		private readonly commit: GitCommit,
		private readonly file: string | GitFile,
	) {
		super('打开更改（使用差异工具）', new ThemeIcon('git-compare'));
	}

	override execute(): Promise<void> {
		return openChangesInDiffTool(this.file, this.commit);
	}
}

export class CommitOpenChangesWithWorkingCommandQuickPickItem extends CommandQuickPickItem {
	constructor(
		private readonly commit: GitCommit,
		private readonly file: string | GitFile,
	) {
		super('打开与工作文件的更改对比', new ThemeIcon('git-compare'));
	}

	override execute(options: { preserveFocus?: boolean; preview?: boolean }): Promise<void> {
		return openChangesWithWorking(this.file, this.commit, options);
	}
}

export class CommitOpenDirectoryCompareCommandQuickPickItem extends CommandQuickPickItem {
	constructor(private readonly commit: GitCommit) {
		super('打开目录比较', new ThemeIcon('git-compare'));
	}

	override execute(): Promise<void> {
		return openDirectoryCompareWithPrevious(this.commit);
	}
}

export class CommitOpenDirectoryCompareWithWorkingCommandQuickPickItem extends CommandQuickPickItem {
	constructor(private readonly commit: GitCommit) {
		super('打开与工作树的目录比较', new ThemeIcon('git-compare'));
	}

	override execute(): Promise<void> {
		return openDirectoryCompareWithWorking(this.commit);
	}
}

export class CommitOpenDetailsCommandQuickPickItem extends CommandQuickPickItem {
	constructor(private readonly commit: GitCommit) {
		super('查看提交详情', new ThemeIcon('eye'));
	}

	override execute(options: { preserveFocus?: boolean; preview?: boolean }): Promise<void> {
		return showCommitInDetailsView(this.commit, { preserveFocus: options?.preserveFocus });
	}
}

export class CommitOpenInGraphCommandQuickPickItem extends CommandQuickPickItem {
	constructor(private readonly commit: GitCommit) {
		super('在提交图中打开', new ThemeIcon('gitlens-graph'));
	}

	override execute(options: { preserveFocus?: boolean; preview?: boolean }): Promise<void> {
		return showCommitInGraph(this.commit, {
			preserveFocus: options?.preserveFocus,
			source: { source: 'quick-wizard' },
		});
	}
}

export class CommitExplainCommandQuickPickItem extends CommandQuickPickItem {
	constructor(private readonly commit: GitCommit) {
		super('解释更改', new ThemeIcon('sparkle'));
	}

	override execute(_options: { preserveFocus?: boolean; preview?: boolean }): Promise<void> {
		return explainCommit(this.commit, { source: { source: 'quick-wizard' } });
	}
}

export class CommitOpenFilesCommandQuickPickItem extends CommandQuickPickItem {
	constructor(private readonly commit: GitCommit) {
		super('打开文件', new ThemeIcon('files'));
	}

	override execute(_options: { preserveFocus?: boolean; preview?: boolean }): Promise<void> {
		return openFiles(this.commit);
	}
}

export class CommitOpenFileCommandQuickPickItem extends CommandQuickPickItem {
	constructor(
		private readonly commit: GitCommit,
		private readonly file: string | GitFile,
	) {
		super('打开文件', new ThemeIcon('file'));
	}

	override execute(options?: { preserveFocus?: boolean; preview?: boolean }): Promise<void> {
		return openFile(this.file, this.commit, options);
	}
}

export class CommitOpenRevisionsCommandQuickPickItem extends CommandQuickPickItem {
	constructor(private readonly commit: GitCommit) {
		super('打开版本文件', new ThemeIcon('files'));
	}

	override execute(_options: { preserveFocus?: boolean; preview?: boolean }): Promise<void> {
		return openFilesAtRevision(this.commit);
	}
}

export class CommitOpenRevisionCommandQuickPickItem extends CommandQuickPickItem {
	constructor(
		private readonly commit: GitCommit,
		private readonly file: string | GitFile,
	) {
		super('打开版本文件', new ThemeIcon('file'));
	}

	override execute(options?: { preserveFocus?: boolean; preview?: boolean }): Promise<void> {
		return openFileAtRevision(this.file, this.commit, options);
	}
}

export class CommitApplyFileChangesCommandQuickPickItem extends CommandQuickPickItem {
	constructor(
		private readonly commit: GitCommit,
		private readonly file: string | GitFile,
	) {
		super('应用更改');
	}

	override async execute(): Promise<void> {
		return applyChanges(this.file, this.commit);
	}
}

export class CommitRestoreFileChangesCommandQuickPickItem extends CommandQuickPickItem {
	constructor(
		private readonly commit: GitCommit,
		private readonly file: string | GitFile,
	) {
		super({
			label: '还原',
			description: '即检出',
		});
	}

	override execute(): Promise<void> {
		return restoreFile(this.file, this.commit);
	}
}

export class OpenChangedFilesCommandQuickPickItem extends CommandQuickPickItem {
	constructor(files: GitStatusFile[], label?: string) {
		const commandArgs: OpenChangedFilesCommandArgs = {
			uris: files.map(f => f.uri),
		};

		super(label ?? '打开所有已更改的文件', new ThemeIcon('files'), 'gitlens.openChangedFiles', [commandArgs]);
	}
}

export class OpenOnlyChangedFilesCommandQuickPickItem extends CommandQuickPickItem {
	constructor(files: GitStatusFile[], label?: string) {
		const commandArgs: OpenOnlyChangedFilesCommandArgs = {
			uris: files.map(f => f.uri),
		};

		super(label ?? '打开已更改文件并关闭未更改文件', new ThemeIcon('files'), 'gitlens.openOnlyChangedFiles', [
			commandArgs,
		]);
	}
}
