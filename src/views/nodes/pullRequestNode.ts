import { MarkdownString, ThemeColor, ThemeIcon, TreeItem, TreeItemCollapsibleState } from 'vscode';
import type { Colors } from '../../constants.colors.js';
import { GitUri } from '../../git/gitUri.js';
import { GitBranch } from '../../git/models/branch.js';
import type { GitCommit } from '../../git/models/commit.js';
import type { PullRequest } from '../../git/models/pullRequest.js';
import type { GitBranchReference } from '../../git/models/reference.js';
import type { Repository } from '../../git/models/repository.js';
import { getAheadBehindFilesQuery, getCommitsQuery } from '../../git/queryResults.js';
import { getIssueOrPullRequestMarkdownIcon, getIssueOrPullRequestThemeIcon } from '../../git/utils/-webview/icons.js';
import {
	ensurePullRequestRefs,
	ensurePullRequestRemote,
	getOrOpenPullRequestRepository,
} from '../../git/utils/-webview/pullRequest.utils.js';
import {
	getComparisonRefsForPullRequest,
	getRepositoryIdentityForPullRequest,
} from '../../git/utils/pullRequest.utils.js';
import { createRevisionRange } from '../../git/utils/revision.utils.js';
import { createCommand } from '../../system/-webview/command.js';
import type { ViewsWithCommits } from '../viewBase.js';
import { createViewDecorationUri } from '../viewDecorationProvider.js';
import { CacheableChildrenViewNode } from './abstract/cacheableChildrenViewNode.js';
import type { ClipboardType, ViewNode } from './abstract/viewNode.js';
import { ContextValues, getViewNodeId } from './abstract/viewNode.js';
import { CodeSuggestionsNode } from './codeSuggestionsNode.js';
import { CommandMessageNode, MessageNode } from './common.js';
import { ResultsCommitsNode } from './resultsCommitsNode.js';
import { ResultsFilesNode } from './resultsFilesNode.js';

export class PullRequestNode extends CacheableChildrenViewNode<'pullrequest', ViewsWithCommits> {
	readonly repoPath: string;

	constructor(
		view: ViewsWithCommits,
		protected override readonly parent: ViewNode,
		public readonly pullRequest: PullRequest,
		branchOrCommitOrRepoPath: GitBranch | GitCommit | string,
		private readonly options?: { expand?: boolean },
	) {
		let branchOrCommit;
		let repoPath;
		if (typeof branchOrCommitOrRepoPath === 'string') {
			repoPath = branchOrCommitOrRepoPath;
		} else {
			repoPath = branchOrCommitOrRepoPath.repoPath;
			branchOrCommit = branchOrCommitOrRepoPath;
		}

		super('pullrequest', GitUri.fromRepoPath(repoPath), view, parent);

		if (branchOrCommit != null) {
			if (branchOrCommit instanceof GitBranch) {
				this.updateContext({ branch: branchOrCommit });
			} else {
				this.updateContext({ commit: branchOrCommit });
			}
		}

		this.updateContext({ pullRequest: pullRequest });
		this._uniqueId = getViewNodeId(this.type, this.context);
		this.repoPath = repoPath;
	}

	override get id(): string {
		return this._uniqueId;
	}

	override toClipboard(type?: ClipboardType): string {
		const url = this.getUrl();
		switch (type) {
			case 'markdown':
				return `[${this.pullRequest.id}](${url}) ${this.pullRequest.title}`;
			default:
				return url;
		}
	}

	override getUrl(): string {
		return this.pullRequest.url;
	}

	get baseRef(): GitBranchReference | undefined {
		if (this.pullRequest.refs?.base != null) {
			return {
				refType: 'branch',
				repoPath: this.repoPath,
				ref: this.pullRequest.refs.base.sha,
				name: this.pullRequest.refs.base.branch,
				remote: true,
			};
		}
		return undefined;
	}

	get ref(): GitBranchReference | undefined {
		if (this.pullRequest.refs?.head != null) {
			return {
				refType: 'branch',
				repoPath: this.repoPath,
				ref: this.pullRequest.refs.head.sha,
				name: this.pullRequest.refs.head.branch,
				remote: true,
			};
		}
		return undefined;
	}

	async getChildren(): Promise<ViewNode[]> {
		if (this.children == null) {
			const children = await getPullRequestChildren(this.view, this, this.pullRequest, this.repoPath);
			this.children = children;
		}
		return this.children;
	}

	getTreeItem(): TreeItem {
		const hasRefs = this.pullRequest.refs?.base != null && this.pullRequest.refs.head != null;

		const item = new TreeItem(
			`#${this.pullRequest.id}: ${this.pullRequest.title}`,
			hasRefs
				? this.options?.expand
					? TreeItemCollapsibleState.Expanded
					: TreeItemCollapsibleState.Collapsed
				: TreeItemCollapsibleState.None,
		);
		item.id = this.id;
		item.contextValue = ContextValues.PullRequest;
		if (this.pullRequest.refs?.base != null && this.pullRequest.refs.head != null) {
			item.contextValue += `+refs`;
		}
		item.description = `${getPullRequestStateLabel(this.pullRequest.state)}, ${this.pullRequest.formatDateFromNow()}`;
		item.iconPath = getIssueOrPullRequestThemeIcon(this.pullRequest);
		item.tooltip = getPullRequestTooltip(this.pullRequest, this.context);

		return item;
	}
}

export async function getPullRequestChildren(
	view: ViewsWithCommits,
	parent: ViewNode,
	pullRequest: PullRequest,
	repoOrPath?: Repository | string,
): Promise<ViewNode[]> {
	let repo: Repository | undefined;
	if (repoOrPath == null) {
		repo = await getOrOpenPullRequestRepository(view.container, pullRequest, { promptIfNeeded: true });
	} else if (typeof repoOrPath === 'string') {
		repo = view.container.git.getRepository(repoOrPath);
	} else {
		repo = repoOrPath;
	}

	if (repo == null) {
		return [
			new MessageNode(
				view,
				parent,
				`无法定位仓库“${pullRequest.refs?.head.owner ?? pullRequest.repository.owner}/${
					pullRequest.refs?.head.repo ?? pullRequest.repository.repo
				}”。`,
			),
		];
	}

	const repoPath = repo.path;
	const refs = getComparisonRefsForPullRequest(repoPath, pullRequest.refs!);
	const identity = getRepositoryIdentityForPullRequest(pullRequest);
	if (!(await ensurePullRequestRemote(pullRequest, repo, { silent: true }))) {
		return [
			new CommandMessageNode(
				view,
				parent,
				createCommand<[ViewNode, PullRequest, Repository]>(
					'gitlens.views.addPullRequestRemote',
					'添加拉取请求远程...',
					parent,
					pullRequest,
					repo,
				),
				`找不到“${identity.provider.repoDomain}”的远程`,
				undefined,
				`点击为“${identity.provider.repoDomain}”添加远程`,
				new ThemeIcon(
					'question',
					new ThemeColor('gitlens.decorations.workspaceRepoMissingForegroundColor' satisfies Colors),
				),
				undefined,
				createViewDecorationUri('remote', { state: 'missing' }),
			),
		];
	}

	const counts = await ensurePullRequestRefs(
		pullRequest,
		repo,
		{ promptMessage: `由于缺少远程，无法打开 PR #${pullRequest.id} 的详细信息。` },
		refs,
	);
	if (!counts?.right) {
		return [new MessageNode(view, parent, '未找到任何提交。')];
	}

	const comparison = {
		ref1: refs.base.ref,
		ref2: refs.head.ref,
		range: createRevisionRange(refs.base.ref, refs.head.ref, '..'),
	};

	const children = [
		new ResultsCommitsNode(
			view,
			parent,
			repoPath,
			'提交',
			{
				query: getCommitsQuery(view.container, repoPath, comparison.range),
				comparison: comparison,
			},
			{
				autolinks: false,
				expand: false,
				description: `${counts?.right ?? 0} 个提交`,
			},
		),
		new CodeSuggestionsNode(view, parent, repoPath, pullRequest),
		new ResultsFilesNode(
			view,
			parent,
			repoPath,
			comparison.ref1,
			comparison.ref2,
			() =>
				getAheadBehindFilesQuery(
					view.container,
					repoPath,
					createRevisionRange(comparison.ref1, comparison.ref2, '...'),
					false,
				),
			undefined,
			{ expand: true, timeout: false },
		),
	];
	return children;
}

export function getPullRequestTooltip(
	pullRequest: PullRequest,
	context?: { commit?: GitCommit; idPrefix?: string; codeSuggestionsCount?: number },
): MarkdownString {
	const tooltip = new MarkdownString('', true);
	tooltip.supportHtml = true;
	tooltip.isTrusted = true;

	if (context?.commit != null) {
		tooltip.appendMarkdown(
			`提交 \`$(git-commit) ${context.commit.shortSha}\` 由 $(git-pull-request) PR #${pullRequest.id} 引入\n\n`,
		);
	}

	const linkTitle = ` "在 ${pullRequest.provider.name} 上打开拉取请求 \\#${pullRequest.id}"`;
	tooltip.appendMarkdown(
		`${getIssueOrPullRequestMarkdownIcon(pullRequest)} [**${pullRequest.title.trim()}**](${
			pullRequest.url
		}${linkTitle}) \\\n[${context?.idPrefix ?? ''}#${pullRequest.id}](${pullRequest.url}${linkTitle}) 由 [@${
			pullRequest.author.name
		}](${pullRequest.author.url} "在 ${
			pullRequest.provider.name
		} 上打开 @${pullRequest.author.name}") 于 ${pullRequest.formatDateFromNow()} ${getPullRequestStateLabel(
			pullRequest.state,
		)}`,
	);
	if (context?.codeSuggestionsCount != null && context.codeSuggestionsCount > 0) {
		tooltip.appendMarkdown(`\n\n$(gitlens-code-suggestion) ${context.codeSuggestionsCount} 条代码建议`);
	}
	return tooltip;
}

function getPullRequestStateLabel(state: PullRequest['state']): string {
	switch (state) {
		case 'closed':
			return '已关闭';
		case 'merged':
			return '已合并';
		case 'opened':
			return '已打开';
		default:
			return state;
	}
}
