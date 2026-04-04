import type { Disposable, QuickPickItem } from 'vscode';
import { window } from 'vscode';
import { getBranches } from '../commands/quick-wizard/steps/branches.js';
import type { GitBranch } from '../git/models/branch.js';
import type { Repository } from '../git/models/repository.js';
import { getQuickPickIgnoreFocusOut } from '../system/-webview/vscode.js';
import type { BranchQuickPickItem } from './items/gitWizard.js';

export async function showBranchPicker(
	title: string | undefined,
	placeholder?: string,
	repository?: Repository | Repository[],
	options?: {
		filter?: (b: GitBranch) => boolean;
	},
): Promise<GitBranch | undefined> {
	if (repository == null) {
		return undefined;
	}

	const items: BranchQuickPickItem[] = await getBranches(repository, options ?? {});
	if (items.length === 0) return undefined;

	const quickpick = window.createQuickPick<BranchQuickPickItem>();
	quickpick.ignoreFocusOut = getQuickPickIgnoreFocusOut();

	const disposables: Disposable[] = [];

	try {
		const pick = await new Promise<BranchQuickPickItem | undefined>(resolve => {
			disposables.push(
				quickpick.onDidHide(() => resolve(undefined)),
				quickpick.onDidAccept(() => {
					if (quickpick.activeItems.length !== 0) {
						resolve(quickpick.activeItems[0]);
					}
				}),
			);

			quickpick.title = title;
			quickpick.placeholder = placeholder;
			quickpick.matchOnDescription = true;
			quickpick.matchOnDetail = true;
			quickpick.items = items;

			quickpick.show();
		});

		return pick?.item;
	} finally {
		quickpick.dispose();
		disposables.forEach(d => void d.dispose());
	}
}

export async function showNewBranchPicker(
	title: string | undefined,
	placeholder?: string,
	_repository?: Repository,
): Promise<string | undefined> {
	const input = window.createInputBox();
	input.ignoreFocusOut = true;

	const disposables: Disposable[] = [];

	let newBranchName: string | undefined;
	try {
		newBranchName = await new Promise<string | undefined>(resolve => {
			disposables.push(
				input.onDidHide(() => resolve(undefined)),
				input.onDidAccept(() => {
					const value = input.value.trim();
					if (value == null) {
						input.validationMessage = '请输入有效的分支名称';
						return;
					}

					resolve(value);
				}),
			);

			input.title = title;
			input.placeholder = placeholder;
			input.prompt = '输入新分支名称';

			input.show();
		});
	} finally {
		input.dispose();
		disposables.forEach(d => void d.dispose());
	}

	return newBranchName;
}

export async function showNewOrSelectBranchPicker(
	title: string | undefined,
	repository?: Repository,
): Promise<GitBranch | string | undefined> {
	if (repository == null) {
		return undefined;
	}

	// TODO: needs updating
	const createNewBranch = {
		label: '创建新分支',
		description: '创建一个分支以应用 Cloud Patch。（输入已有分支名将直接使用该分支。）',
	};
	const selectExistingBranch = {
		label: '选择现有分支',
		description: '选择一个现有分支以应用 Cloud Patch。',
	};

	const items: QuickPickItem[] = [createNewBranch, selectExistingBranch];

	const quickpick = window.createQuickPick<QuickPickItem>();
	quickpick.ignoreFocusOut = getQuickPickIgnoreFocusOut();

	const disposables: Disposable[] = [];

	try {
		const pick = await new Promise<QuickPickItem | undefined>(resolve => {
			disposables.push(
				quickpick.onDidHide(() => resolve(undefined)),
				quickpick.onDidAccept(() => {
					if (quickpick.activeItems.length !== 0) {
						resolve(quickpick.activeItems[0]);
					}
				}),
			);

			quickpick.title = title;
			quickpick.placeholder = '选择分支操作';
			quickpick.matchOnDescription = true;
			quickpick.matchOnDetail = true;
			quickpick.items = items;

			quickpick.show();
		});

		if (pick === createNewBranch) {
			return await showNewBranchPicker(title, '输入新分支名称', repository);
		} else if (pick === selectExistingBranch) {
			return await showBranchPicker(title, '选择一个现有分支', repository);
		}

		return undefined;
	} finally {
		quickpick.dispose();
		disposables.forEach(d => void d.dispose());
	}
}
