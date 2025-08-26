import type { QuickInput, QuickInputButton } from 'vscode';
import { ThemeIcon, Uri } from 'vscode';
import { Container } from '../../container.js';

export class ToggleQuickInputButton implements QuickInputButton {
	constructor(
		private readonly state:
			| {
					on: { icon: string | { light: Uri; dark: Uri } | ThemeIcon; tooltip: string };
					off: { icon: string | { light: Uri; dark: Uri } | ThemeIcon; tooltip: string };
			  }
			| (() => {
					on: { icon: string | { light: Uri; dark: Uri } | ThemeIcon; tooltip: string };
					off: { icon: string | { light: Uri; dark: Uri } | ThemeIcon; tooltip: string };
			  }),
		private _on = false,
	) {}

	get iconPath(): { light: Uri; dark: Uri } | ThemeIcon {
		const icon = this.getToggledState().icon;
		return typeof icon === 'string'
			? {
					dark: Uri.file(Container.instance.context.asAbsolutePath(`images/dark/${icon}.svg`)),
					light: Uri.file(Container.instance.context.asAbsolutePath(`images/light/${icon}.svg`)),
				}
			: icon;
	}

	get tooltip(): string {
		return this.getToggledState().tooltip;
	}

	get on(): boolean {
		return this._on;
	}
	set on(value: boolean) {
		this._on = value;
	}

	/**
	 * @returns `true` if the step should be retried (refreshed)
	 */
	onDidClick?(quickInput: QuickInput): boolean | void | Promise<boolean | void>;

	private getState() {
		return typeof this.state === 'function' ? this.state() : this.state;
	}

	private getToggledState() {
		return this.on ? this.getState().on : this.getState().off;
	}
}

export class SelectableQuickInputButton extends ToggleQuickInputButton {
	constructor(tooltip: string, icon: { off: string | ThemeIcon; on: string | ThemeIcon }, selected: boolean = false) {
		super({ off: { tooltip: tooltip, icon: icon.off }, on: { tooltip: tooltip, icon: icon.on } }, selected);
	}
}

export const ClearQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('clear-all'),
	tooltip: '清除',
};

export const ConnectIntegrationButton: QuickInputButton = {
	iconPath: new ThemeIcon('plug'),
	tooltip: '连接其他集成',
};

export const FeedbackQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('feedback'),
	tooltip: '给我们反馈',
};

export const FetchQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('repo-fetch'),
	tooltip: '拉取',
};

export const LoadMoreQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('refresh'),
	tooltip: '加载更多',
};

export const MatchCaseToggleQuickInputButton = class extends SelectableQuickInputButton {
	constructor(on = false) {
		super('匹配大小写', { off: 'icon-match-case', on: 'icon-match-case-selected' }, on);
	}
};

export const MatchAllToggleQuickInputButton = class extends SelectableQuickInputButton {
	constructor(on = false) {
		super('全部匹配', { off: 'icon-match-all', on: 'icon-match-all-selected' }, on);
	}
};

export const MatchRegexToggleQuickInputButton = class extends SelectableQuickInputButton {
	constructor(on = false) {
		super('使用正则表达式匹配', { off: 'icon-match-regex', on: 'icon-match-regex-selected' }, on);
	}
};

export const MatchWholeWordToggleQuickInputButton = class extends SelectableQuickInputButton {
	constructor(on = false) {
		super('匹配整个单词', { off: 'icon-match-wholeword', on: 'icon-match-wholeword-selected' }, on);
	}
};

export const PickCommitQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('git-commit'),
	tooltip: '选择特定提交',
};

export const PickCommitToggleQuickInputButton = class extends ToggleQuickInputButton {
	constructor(on = false, context: { showTags: boolean }, onDidClick?: (quickInput: QuickInput) => void) {
		super(
			() => ({
				on: { tooltip: '选择特定提交', icon: new ThemeIcon('git-commit') },
				off: {
					tooltip: `选择分支${context.showTags ? '或标签' : ''}`,
					icon: new ThemeIcon('git-branch'),
				},
			}),
			on,
		);

		this.onDidClick = onDidClick;
	}
};

export const LearnAboutProQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('info'),
	tooltip: '了解 GitLens Pro',
};

export const MergeQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('merge'),
	tooltip: '合并...',
};

export const OpenOnJiraQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('globe'),
	tooltip: '在 Jira 上打开',
};

export const OpenOnGitHubQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('globe'),
	tooltip: '在 GitHub 上打开',
};

export const OpenOnGitLabQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('globe'),
	tooltip: '在 GitLab 上打开',
};

export const OpenOnAzureDevOpsQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('globe'),
	tooltip: '在 Azure DevOps 上打开',
};

export const OpenOnBitbucketQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('globe'),
	tooltip: '在 Bitbucket 上打开',
};

export const OpenOnWebQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('globe'),
	tooltip: '在 gitkraken.dev 上打开',
};

export const LaunchpadSettingsQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('gear'),
	tooltip: '启动板设置',
};

export const PinQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('pinned'),
	tooltip: '置顶',
};

export const UnpinQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('pin'),
	tooltip: '取消置顶',
};

export const SnoozeQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('bell-slash'),
	tooltip: '暂停通知',
};

export const RefreshQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('refresh'),
	tooltip: '刷新',
};

export const UnsnoozeQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('bell'),
	tooltip: '恢复通知',
};
export const OpenInNewWindowQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('empty-window'),
	tooltip: '在新窗口中打开',
};

export const RevealInSideBarQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('search'),
	tooltip: '在侧边栏中显示',
};

export const SetRemoteAsDefaultQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('settings-gear'),
	tooltip: '设为默认远程仓库',
};

export const ShowDetailsViewQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('eye'),
	tooltip: '查看详情',
};

export const OpenChangesViewQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('compare-changes'),
	tooltip: '打开更改',
};

export const ShowResultsInSideBarQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('link-external'),
	tooltip: '在侧边栏中显示结果',
};

export const OpenWorktreeInNewWindowQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('empty-window'),
	tooltip: '在工作树中打开',
};

export const ShowTagsToggleQuickInputButton = class extends SelectableQuickInputButton {
	constructor(on = false) {
		super('显示标签', { off: new ThemeIcon('tag'), on: 'icon-tag-selected' }, on);
	}
};

export const WillConfirmForcedQuickInputButton: QuickInputButton = {
	iconPath: new ThemeIcon('gitlens-confirm-checked'),
	tooltip: '在执行操作之前，您将看到必需的确认步骤',
};

export const WillConfirmToggleQuickInputButton = class extends ToggleQuickInputButton {
	constructor(on = false, isConfirmationStep: boolean, onDidClick?: (quickInput: QuickInput) => void) {
		super(
			() => ({
				on: {
					tooltip: isConfirmationStep
						? '对于将来的操作，在执行操作之前将显示确认步骤\n点击切换'
						: '在执行操作之前将显示确认步骤\n点击切换',
					icon: new ThemeIcon('gitlens-confirm-checked'),
				},
				off: {
					tooltip: isConfirmationStep
						? "对于将来的操作，在执行操作之前不会显示确认步骤\n点击切换"
						: "在执行操作之前不会显示确认步骤\n点击切换",
					icon: new ThemeIcon('gitlens-confirm-unchecked'),
				},
			}),
			on,
		);

		this.onDidClick = onDidClick;
	}
};
