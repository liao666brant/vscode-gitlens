import type { TemplateResult } from 'lit';
import { html } from 'lit';
import type { SearchOperatorsLongForm } from '@gitlens/git/models/search.js';
import type { CompletionItem } from '../autocomplete/autocomplete.js';

export type SearchCompletionItem = CompletionItem<
	SearchCompletionOperator | SearchCompletionCommand | SearchCompletionValue
>;

export type SearchCompletionCommand =
	| { command: 'toggle-natural-language-mode' }
	| { command: 'pick-author' | 'pick-file'; multi?: boolean }
	| { command: 'pick-folder' | 'pick-ref' | 'pick-comparison'; multi?: never };

export interface SearchCompletionValue {
	/** The operator this value belongs to */
	operator: SearchOperatorsLongForm;
	/** The value to insert */
	value: string;
}

export const naturalLanguageSearchAutocompleteCommand: CompletionItem<SearchCompletionCommand> = {
	label: '使用自然语言搜索',
	detail: '描述你想查找的内容，让 AI 帮你构建查询',
	icon: 'sparkle',
	item: { command: 'toggle-natural-language-mode' },
	score: 0,
	alwaysVisible: true,
};

export const structuredSearchAutocompleteCommand: CompletionItem<SearchCompletionCommand> = {
	label: '使用筛选器搜索',
	detail: '组合筛选条件进行强力搜索，例如 @me after:1.week.ago file:*.ts。',
	icon: 'search',
	item: { command: 'toggle-natural-language-mode' },
	score: 0,
	alwaysVisible: true,
};

export interface SearchCompletionOperatorValue {
	/** The value to suggest or command to execute when this value is selected */
	value: string | SearchCompletionCommand;
	/** Label to display in autocomplete */
	label: string;
	/** Description of what this value does (shown in autocomplete list) */
	description: string;
	/** Icon to display in autocomplete */
	icon?: string;
}

export interface SearchCompletionOperator {
	/** Primary operator (long form) */
	operator: SearchOperatorsLongForm;
	/** Aliases for this operator (short forms) */
	aliases: string[];
	/** Short description of what this operator does */
	description: string;
	/** Icon to display in autocomplete */
	icon?: string;
	/** Example usage */
	example?: TemplateResult;
	/** Predefined values to suggest for this operator (can include commands that help populate values) */
	values?: SearchCompletionOperatorValue[];
}

/**
 * Metadata for all search operators, used for autocomplete and help text
 */
export const searchCompletionOperators: SearchCompletionOperator[] = [
	{
		operator: 'message:',
		description: '搜索提交信息，快速定位特定变更或功能',
		icon: 'comment',
		aliases: ['=:'],
		example: html`使用引号搜索短语，例如 <code>message:"Updates dependencies"</code> 或 <code>=:"bug fix"</code>`,
	},
	{
		operator: 'author:',
		description: '按作者筛选，查看特定团队成员的贡献',
		icon: 'person',
		aliases: ['@:'],
		example: html`使用姓名或邮箱，例如 <code>author:eamodio</code>、<code>@:john</code>，或使用
			<code>@me</code> 表示你自己的提交`,
		values: [
			{
				value: '@me',
				label: '@me',
				description: '仅显示你自己的提交',
				icon: 'person',
			},
			{
				value: { command: 'pick-author', multi: true },
				label: '选择作者\u2026',
				description: '选择一个或多个贡献者进行筛选',
				icon: 'organization',
			},
		],
	},
	{
		operator: 'commit:',
		description: '使用 SHA 跳转到指定提交',
		icon: 'git-commit',
		aliases: ['#:'],
		example: html`使用完整或简写提交 SHA，例如 <code>commit:4ce3a</code> 或 <code>#:4ce3a</code>`,
	},
	{
		operator: 'ref:',
		description: '筛选到指定分支或标签（单独），或通过范围比较查看独有提交',
		icon: 'git-branch',
		aliases: ['^:'],
		example: html`使用引用进行筛选，例如 <code>ref:main</code> 或 <code>^:v1.0.0</code>；也可使用范围比较，例如
			<code>ref:main..feature</code>（feature 中有而 main 中没有的提交）`,
		values: [
			{
				value: { command: 'pick-ref' },
				label: '选择分支或标签\u2026',
				description: '选择一个分支或标签进行筛选',
				icon: 'git-branch',
			},
			{
				value: { command: 'pick-comparison' },
				label: '选择比较范围\u2026',
				description: '选择两个引用进行比较（例如 main..feature）',
				icon: 'git-compare',
			},
		],
	},
	{
		operator: 'type:',
		description: '按提交类型筛选，仅查看储藏或分支/标签尖端提交',
		icon: 'symbol-misc',
		aliases: ['is:'],
		// example: html`Use <code>is:stash</code> for stashes, <code>is:tip</code> for branch & tag tips, or <code>is:wip</code> for working tree changes`,
		values: [
			{
				value: 'stash',
				label: 'stash',
				description: '筛选提交，仅显示储藏',
				icon: 'archive',
			},
			{
				value: 'tip',
				label: 'tip',
				description: '筛选提交，仅显示被分支或标签指向的提交',
				icon: 'git-branch',
			},
			{
				value: 'wip',
				label: 'wip',
				description: 'Filter to only show working tree changes (current and other worktrees)',
				icon: 'gl-wip',
			},
		],
	},
	{
		operator: 'file:',
		description: '跨历史追踪文件变更（支持 glob 模式）',
		icon: 'file',
		aliases: ['?:'],
		example: html`使用路径或文件名，例如 <code>file:package.json</code>；也可使用 glob，例如
			<code>?:src/**/*.ts</code>`,
		values: [
			{
				value: { command: 'pick-file', multi: true },
				label: '选择文件\u2026',
				description: '选择一个或多个文件进行筛选',
				icon: 'file',
			},
			{
				value: { command: 'pick-folder' },
				label: '选择文件夹\u2026',
				description: '选择一个文件夹进行筛选',
				icon: 'folder',
			},
		],
	},
	{
		operator: 'change:',
		description: '搜索代码变更，定位特定函数或模式被修改的时间',
		icon: 'diff',
		aliases: ['~:'],
		example: html`使用代码片段或正则，例如 <code>change:"function login"</code> 或 <code>~:"import.*React"</code>`,
	},
	{
		operator: 'after:',
		description: '按日期范围筛选，支持绝对日期或相对时间',
		icon: 'calendar',
		aliases: ['since:', '>:'],
		example: html`使用日期字符串，例如 <code>after:2022-01-01</code>；或相对日期，例如
			<code>since:3.weeks.ago</code> 或 <code>&gt;:1.month.ago</code>`,
	},
	{
		operator: 'before:',
		description: '按日期范围筛选，支持绝对日期或相对时间',
		icon: 'calendar',
		aliases: ['until:', '<:'],
		example: html`使用日期字符串，例如 <code>before:2022-01-01</code>；或相对日期，例如
			<code>until:3.weeks.ago</code> 或 <code>&lt;:1.month.ago</code>`,
	},
];
