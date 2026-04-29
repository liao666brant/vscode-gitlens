import { ThemeIcon, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { GlyphChars } from '../../constants.js';
import type { GitUri } from '../../git/gitUri.js';
import type { Repository } from '../../git/models/repository.js';
import { sortWorktrees } from '../../git/utils/-webview/sorting.js';
import { makeHierarchical } from '../../system/array.js';
import type { ViewsWithWorktreesNode } from '../viewBase.js';
import { CacheableChildrenViewNode } from './abstract/cacheableChildrenViewNode.js';
import type { ViewNode } from './abstract/viewNode.js';
import { ContextValues, getViewNodeId } from './abstract/viewNode.js';
import { BranchOrTagFolderNode } from './branchOrTagFolderNode.js';
import { MessageNode } from './common.js';
import { WorktreeNode } from './worktreeNode.js';

export class WorktreesNode extends CacheableChildrenViewNode<'worktrees', ViewsWithWorktreesNode> {
	constructor(
		uri: GitUri,
		view: ViewsWithWorktreesNode,
		protected override readonly parent: ViewNode,
		public readonly repo: Repository,
	) {
		super('worktrees', uri, view, parent);

		this.updateContext({ repository: repo });
		this._uniqueId = getViewNodeId(this.type, this.context);
	}

	override get id(): string {
		return this._uniqueId;
	}

	get repoPath(): string {
		return this.repo.path;
	}

	async getChildren(): Promise<ViewNode[]> {
		if (this.children == null) {
			const access = await this.repo.access('worktrees');
			if (!access.allowed) return [];

			const worktrees = await this.repo.git.worktrees?.getWorktrees();
			if (!worktrees?.length) return [new MessageNode(this.view, this, '未找到任何工作树。')];

			const children = sortWorktrees(worktrees).map(w => new WorktreeNode(this.uri, this.view, this, w));

			if (this.view.config.branches.layout === 'list' || this.view.config.worktrees.viewAs !== 'name') {
				this.children = children;
				return children;
			}

			const hierarchy = makeHierarchical(
				children,
				n => n.treeHierarchy,
				(...paths) => paths.join('/'),
				this.view.config.branches.compact,
				w => {
					w.compacted = true;
					return true;
				},
			);

			const root = new BranchOrTagFolderNode(
				this.view,
				this,
				'worktree',
				hierarchy,
				this.repo.path,
				'',
				undefined,
			);
			this.children = root.getChildren();
		}

		return this.children;
	}

	async getTreeItem(): Promise<TreeItem> {
		const access = await this.repo.access('worktrees');

		const item = new TreeItem(
			'工作树',
			access.allowed ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
		);
		item.id = this.id;
		item.contextValue = ContextValues.Worktrees;
		item.description = access.allowed
			? undefined
			: ` ${GlyphChars.Warning}  使用 GitLens Pro 解锁私有托管仓库的此功能`;
		// TODO@eamodio `folder` icon won't work here for some reason
		item.iconPath = new ThemeIcon('folder-opened');
		return item;
	}
}
