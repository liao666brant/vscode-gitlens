import type { QuickPick, QuickPickItem, ThemeIcon, Uri } from 'vscode';

export enum Directive {
	Back,
	Cancel,
	Reset,
	LoadMore,
	Noop,

	SignIn,

	RequiresVerification,

	RefsAllBranches,
	ReposAll,
	ReposAllExceptWorktrees,
}

export function isDirective<T>(value: Directive | T): value is Directive {
	return typeof value === 'number' && Directive[value] != null;
}

export interface DirectiveQuickPickItem extends QuickPickItem {
	directive: Directive;
	onDidSelect?: (quickpick: QuickPick<QuickPickItem>) => void | Promise<void>;
}

export function createDirectiveQuickPickItem(
	directive: Directive,
	picked?: boolean,
	options?: {
		label?: string;
		description?: string;
		detail?: string;
		buttons?: QuickPickItem['buttons'];
		iconPath?: Uri | { light: Uri; dark: Uri } | ThemeIcon;
		onDidSelect?: (quickpick: QuickPick<QuickPickItem>) => void | Promise<void>;
	},
): DirectiveQuickPickItem {
	let label = options?.label;
	let detail = options?.detail;
	let description = options?.description;
	if (label == null) {
		switch (directive) {
			case Directive.Back:
				label = '返回';
				break;
			case Directive.Cancel:
				label = '取消';
				break;
			case Directive.LoadMore:
				label = '加载更多';
				break;
			case Directive.Noop:
				label = '重试';
				break;
			case Directive.Reset:
				label = '重置';
				break;

			case Directive.SignIn:
				label = '登录';
				break;

			case Directive.RequiresVerification:
				label = '重新发送邮件';
				detail = '继续之前，您必须先验证邮箱';
				break;

			case Directive.RefsAllBranches:
				label = '所有分支';
				break;

			case Directive.ReposAll:
				label = '所有仓库';
				break;

			case Directive.ReposAllExceptWorktrees:
				label = '所有仓库';
				description = ' 不包含工作树 / 子模块';
				break;
		}
	}

	const item: DirectiveQuickPickItem = {
		label: label,
		description: description,
		detail: detail,
		iconPath: options?.iconPath,
		buttons: options?.buttons,
		alwaysShow: true,
		picked: picked,
		directive: directive,
		onDidSelect: options?.onDidSelect,
	};

	return item;
}

export function isDirectiveQuickPickItem(item: QuickPickItem): item is DirectiveQuickPickItem {
	return item != null && 'directive' in item;
}
