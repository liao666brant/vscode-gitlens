import type { TextDocumentShowOptions, TextEditor, Uri } from 'vscode';
import { GlyphChars, quickPickTitleMaxChars } from '../constants.js';
import type { Container } from '../container.js';
import type { DiffRange } from '../git/gitProvider.js';
import { GitUri } from '../git/gitUri.js';
import { isBranchReference } from '../git/utils/reference.utils.js';
import { shortenRevision } from '../git/utils/revision.utils.js';
import { showNoRepositoryWarningMessage } from '../messages.js';
import { showReferencePicker } from '../quickpicks/referencePicker.js';
import { showStashPicker } from '../quickpicks/stashPicker.js';
import { command, executeCommand } from '../system/-webview/command.js';
import { selectionToDiffRange } from '../system/-webview/vscode/editors.js';
import { basename } from '../system/path.js';
import { pad } from '../system/string.js';
import { ActiveEditorCommand } from './commandBase.js';
import { getCommandUri } from './commandBase.utils.js';
import type { DiffWithCommandArgs } from './diffWith.js';

export interface DiffWithRevisionFromCommandArgs {
	stash?: boolean;

	range?: DiffRange;
	showOptions?: TextDocumentShowOptions;
}

@command()
export class DiffWithRevisionFromCommand extends ActiveEditorCommand {
	constructor(private readonly container: Container) {
		super('gitlens.diffWithRevisionFrom');
	}

	async execute(editor?: TextEditor, uri?: Uri, args?: DiffWithRevisionFromCommandArgs): Promise<void> {
		uri = getCommandUri(uri, editor);
		if (uri == null) return;

		const gitUri = await GitUri.fromUri(uri);
		if (!gitUri.repoPath) {
			void showNoRepositoryWarningMessage('无法打开文件比较');

			return;
		}

		args = { ...args };
		args.range ??= selectionToDiffRange(editor?.selection);

		const svc = this.container.git.getRepositoryService(gitUri.repoPath);
		const path = svc.getRelativePath(gitUri, gitUri.repoPath);

		let ref;
		let sha;
		if (args?.stash) {
			const title = `打开与贮藏的更改${pad(GlyphChars.Dot, 2, 2)}`;
			const pick = await showStashPicker(
				svc.stash?.getStash(),
				`${title}${gitUri.getFormattedFileName({ truncateTo: quickPickTitleMaxChars - title.length })}`,
				'选择要比较的贮藏',
				{
					empty: `未找到包含 '${gitUri.getFormattedFileName()}' 的贮藏`,
					// Stashes should always come with files, so this should be fine (but protect it just in case)
					filter: c => c.anyFiles?.some(f => f.path === path || f.originalPath === path) ?? true,
				},
			);
			if (pick == null) return;

			ref = pick.ref;
			sha = ref;
		} else {
			const title = `打开与分支或标签的更改${pad(GlyphChars.Dot, 2, 2)}`;
			const pick = await showReferencePicker(
				gitUri.repoPath,
				`${title}${gitUri.getFormattedFileName({ truncateTo: quickPickTitleMaxChars - title.length })}`,
				'选择要比较的引用（分支、标签等）',
				{
					allowedAdditionalInput: { rev: true },
				},
			);
			if (pick == null) return;

			ref = pick.ref;
			sha = isBranchReference(pick) && pick.remote ? `remotes/${ref}` : ref;
		}

		if (ref == null) return;

		let renamedUri: Uri | undefined;
		let renamedTitle: string | undefined;

		// Check to see if this file has been renamed
		const files = await svc.diff.getDiffStatus('HEAD', ref, { filters: ['R', 'C'] });
		if (files != null) {
			const rename = files.find(s => s.path === path);
			if (rename?.originalPath != null) {
				renamedUri = svc.getAbsoluteUri(rename.originalPath, gitUri.repoPath);
				renamedTitle = `${basename(rename.originalPath)} (${shortenRevision(ref)})`;
			}
		}

		void (await executeCommand<DiffWithCommandArgs>('gitlens.diffWith', {
			repoPath: gitUri.repoPath,
			lhs: {
				sha: sha,
				uri: renamedUri ?? gitUri,
				title: renamedTitle ?? `${basename(gitUri.fsPath)} (${shortenRevision(ref)})`,
			},
			rhs: { sha: '', uri: gitUri },
			range: args.range,
			showOptions: args.showOptions,
		}));
	}
}
