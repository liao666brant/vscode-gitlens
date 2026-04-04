import { Avatar, Button, defineGkElement, Menu, MenuItem, Popover } from '@gitkraken/shared-web-components';
import { html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { repeat } from 'lit/directives/repeat.js';
import { when } from 'lit/directives/when.js';
import type { ViewFilesLayout } from '../../../../../config.js';
import { urls } from '../../../../../constants.js';
import type { GitFileChangeShape } from '../../../../../git/models/fileChange.js';
import type { DraftRole, DraftVisibility } from '../../../../../plus/drafts/models/drafts.js';
import { debounce } from '../../../../../system/function/debounce.js';
import { flatCount } from '../../../../../system/iterable.js';
import type { Serialized } from '../../../../../system/serialize.js';
import type {
	Change,
	DraftUserSelection,
	ExecuteFileActionParams,
	State,
} from '../../../../plus/patchDetails/protocol.js';
import type {
	TreeItemActionDetail,
	TreeItemBase,
	TreeItemCheckedDetail,
	TreeItemSelectionDetail,
	TreeModel,
} from '../../../shared/components/tree/base.js';
import { GlTreeBase } from './gl-tree-base.js';
import '../../../shared/components/actions/action-nav.js';
import '../../../shared/components/button.js';
import '../../../shared/components/code-icon.js';
import '../../../shared/components/commit/commit-stats.js';
import '../../../shared/components/webview-pane.js';

export interface CreatePatchEventDetail {
	title: string;
	description?: string;
	visibility: DraftVisibility;
	changesets: Record<string, Change>;
	userSelections: DraftUserSelection[] | undefined;
}

export interface CreatePatchMetadataEventDetail {
	title: string;
	description: string | undefined;
	visibility: DraftVisibility;
}

export interface CreatePatchCheckRepositoryEventDetail {
	repoUri: string;
	checked: boolean | 'staged';
}

export interface CreatePatchUpdateSelectionEventDetail {
	selection: DraftUserSelection;
	role: Exclude<DraftRole, 'owner'> | 'remove';
}

interface GenerateState {
	cancelled?: boolean;
	error?: { message: string };
	title?: string;
	description?: string;
}

// Can only import types from 'vscode'
const BesideViewColumn = -2; /*ViewColumn.Beside*/

@customElement('gl-patch-create')
export class GlPatchCreate extends GlTreeBase {
	@property({ type: Object }) state?: Serialized<State>;

	@property({ type: Boolean }) review = false;

	@property({ type: Object })
	generate?: GenerateState;

	@state()
	generateBusy = false;

	@state()
	creationBusy = false;

	// @state()
	// patchTitle = this.create.title ?? '';

	// @state()
	// description = this.create.description ?? '';

	@query('#title')
	titleInput!: HTMLInputElement;

	@query('#desc')
	descInput!: HTMLInputElement;

	@query('#generate-ai')
	generateAiButton!: HTMLElement;

	@state()
	validityMessage?: string;

	get create(): NonNullable<State['create']> {
		return this.state!.create!;
	}

	get createChanges(): Change[] {
		return Object.values(this.create.changes);
	}

	get createEntries(): [string, Change][] {
		return Object.entries(this.create.changes);
	}

	get hasWipChanges(): boolean {
		return this.createChanges.some(change => change?.type === 'wip');
	}

	get selectedChanges(): [string, Change][] {
		if (this.createChanges.length === 1) return this.createEntries;

		return this.createEntries.filter(([, change]) => change.checked !== false);
	}

	get canSubmit(): boolean {
		return this.create.title != null && this.create.title.length > 0 && this.selectedChanges.length > 0;
	}

	get fileLayout(): ViewFilesLayout {
		return this.state?.preferences?.files?.layout ?? 'auto';
	}

	get isCompact(): boolean {
		return this.state?.preferences?.files?.compact ?? true;
	}

	get filesModified(): number {
		return flatCount(this.createChanges, c => c.files?.length ?? 0);
	}

	get draftVisibility(): DraftVisibility {
		return this.state?.create?.visibility ?? 'public';
	}

	constructor() {
		super();

		defineGkElement(Avatar, Button, Menu, MenuItem, Popover);
	}

	override updated(changedProperties: Map<string, any>): void {
		if (changedProperties.has('state')) {
			this.creationBusy = false;
		}
		if (changedProperties.has('generate')) {
			this.generateBusy = false;
			this.generateAiButton.scrollIntoView();
		}
	}
	protected override firstUpdated(): void {
		window.requestAnimationFrame(() => {
			this.titleInput.focus();
		});
	}

	private renderUserSelection(userSelection: DraftUserSelection) {
		const role = userSelection.pendingRole!;
		const options = new Map<string, string>([
			['admin', '管理员'],
			['editor', '可编辑'],
			['viewer', '可查看'],
			['remove', '取消邀请'],
		]);
		const roleLabel = options.get(role);
		return html`
			<div class="user-selection">
				<div class="user-selection__avatar">
					<gk-avatar .src=${userSelection.avatarUrl}></gk-avatar>
				</div>
				<div class="user-selection__info">
					<div class="user-selection__name">
						${userSelection.member.name ?? userSelection.member.username ?? '未知'}
					</div>
				</div>
				<div class="user-selection__actions">
					<gk-popover>
						<gk-button slot="trigger">${roleLabel} <code-icon icon="chevron-down"></code-icon></gk-button>
						<gk-menu>
							${map(
								options,
								([value, label]) =>
									html`<gk-menu-item
										@click=${(e: MouseEvent) =>
											this.onChangeSelectionRole(
												e,
												userSelection,
												value as CreatePatchUpdateSelectionEventDetail['role'],
											)}
									>
										<code-icon
											icon="check"
											class="user-selection__check ${role === value ? 'is-active' : ''}"
										></code-icon>
										${label}
									</gk-menu-item>`,
							)}
						</gk-menu>
					</gk-popover>
				</div>
			</div>
		`;
	}

	private renderUserSelectionList() {
		if (this.state?.create?.userSelections == null || this.state?.create?.userSelections.length === 0) {
			return undefined;
		}

		return html`
			<div class="message-input">
				<div class="user-selection-container scrollable">
					${repeat(
						this.state.create.userSelections,
						userSelection => userSelection.member.id,
						userSelection => this.renderUserSelection(userSelection),
					)}
				</div>
			</div>
		`;
	}

	private renderForm() {
		let visibilityIcon: string | undefined;
		switch (this.draftVisibility) {
			case 'private':
				visibilityIcon = 'organization';
				break;
			case 'invite_only':
				visibilityIcon = 'lock';
				break;
			default:
				visibilityIcon = 'globe';
				break;
		}

		const draftName = this.review ? '代码建议' : '云补丁';
		const draftNamePlural = this.review ? '代码建议' : '云补丁';
		return html`
			<div class="section section--action">
				${when(
					this.state?.create?.creationError != null,
					() =>
						html` <div class="alert alert--error">
							<code-icon icon="error"></code-icon>
							<p class="alert__content">${this.state!.create!.creationError}</p>
						</div>`,
				)}
				${when(
					this.review === false,
					() => html`
						<div class="message-input message-input--group">
							<div class="message-input__select">
								<span class="message-input__select-icon"
									><code-icon icon=${visibilityIcon}></code-icon
								></span>
								<select
									id="visibility"
									class="message-input__control"
									@change=${this.onVisibilityChange}
								>
									<option value="public" ?selected=${this.draftVisibility === 'public'}>
										拥有链接的任何人
									</option>
									<option value="private" ?selected=${this.draftVisibility === 'private'}>
										我组织中拥有链接的成员
									</option>
									<option value="invite_only" ?selected=${this.draftVisibility === 'invite_only'}>
										仅协作者
									</option>
								</select>
								<span class="message-input__select-caret"
									><code-icon icon="chevron-down"></code-icon
								></span>
							</div>
							<gl-button appearance="secondary" @click=${this.onInviteUsers}
								><code-icon icon="person-add" slot="prefix"></code-icon> 邀请</gl-button
							>
						</div>
						${this.renderUserSelectionList()}
					`,
				)}
				<div class="message-input message-input--with-menu">
					<input
						id="title"
						type="text"
						class="message-input__control"
						placeholder="标题（必填）"
						aria-label="补丁标题"
						maxlength="100"
						.value=${this.create.title ?? ''}
						?disabled=${this.generateBusy}
						@input=${(e: InputEvent) => this.onDebounceTitleInput(e)}
					/>
					${when(
						this.state?.orgSettings.ai === true && this.state?.preferences.aiEnabled === true,
						() =>
							html`<div class="message-input__menu">
								<gl-button
									id="generate-ai"
									appearance="toolbar"
									density="compact"
									tooltip="生成标题和描述..."
									aria-label="生成标题和描述"
									@click=${(e: MouseEvent) => this.onGenerateTitleClick(e)}
									?disabled=${this.generateBusy}
									><code-icon
										icon=${this.generateBusy ? 'loading' : 'sparkle'}
										modifier="${this.generateBusy ? 'spin' : ''}"
									></code-icon
								></gl-button>
							</div>`,
					)}
				</div>

				${when(
					this.generate?.error != null,
					() => html`
						<div class="alert alert--error">
							<code-icon icon="error"></code-icon>
							<p class="alert__content">${this.generate!.error!.message ?? '获取内容时出错'}</p>
						</div>
					`,
				)}
				<div class="message-input">
					<textarea
						id="desc"
						class="message-input__control"
						placeholder="描述（可选）"
						aria-label="补丁描述"
						maxlength="10000"
						.value=${this.create.description ?? ''}
						?disabled=${this.generateBusy}
						@input=${(e: InputEvent) => this.onDebounceDescriptionInput(e)}
					></textarea>
				</div>
				<p class="button-container">
					<span class="button-group button-group--single">
						<gl-button ?disabled=${this.creationBusy} full @click=${(e: Event) => this.onCreateAll(e)}
							>创建 ${draftName}</gl-button
						>
					</span>
				</p>
				${when(
					this.review === true,
					() => html`
						<p class="button-container">
							<span class="button-group button-group--single">
								<gl-button appearance="secondary" full @click=${() => this.onCancel()}>取消</gl-button>
							</span>
						</p>
					`,
				)}
				${when(
					this.state?.orgSettings.byob === false,
					() =>
						html`<p class="h-deemphasize">
							<code-icon icon="lock"></code-icon>
							<a
								href="${urls.cloudPatches}"
								title="了解 ${draftNamePlural} 更多信息"
								aria-label="了解 ${draftNamePlural} 更多信息"
								>${draftNamePlural}</a
							>
							由 GitKraken
							<a
								href="https://help.gitkraken.com/gitlens/security"
								title="了解 GitKraken 安全"
								aria-label="了解 GitKraken 安全"
								>安全存储</a
							>
							。
						</p>`,
					() =>
						html`<p class="h-deemphasize">
							<code-icon icon="info"></code-icon>
							你的
							<a
								href="${urls.cloudPatches}"
								title="了解 ${draftNamePlural} 更多信息"
								aria-label="了解 ${draftNamePlural} 更多信息"
								>${draftName}</a
							>
							将安全地存储在你组织的自托管存储中
						</p>`,
				)}
			</div>
		`;
	}

	// <gl-create-details
	// 	.repoChanges=${this.repoChanges}
	// 	.preferences=${this.state?.preferences}
	// 	.isUncommitted=${true}
	// 	@changeset-repo-checked=${this.onRepoChecked}
	// 	@changeset-unstaged-checked=${this.onUnstagedChecked}
	// >
	// </gl-create-details>
	override render(): unknown {
		return html`
			<div class="pane-groups">
				<div class="pane-groups__group">${this.renderChangedFiles()}</div>
				<div class="pane-groups__group-fixed pane-groups__group--bottom">${this.renderForm()}</div>
			</div>
		`;
	}

	private renderChangedFiles() {
		return html`
			<webview-pane class="h-no-border" expanded>
				<span slot="title">${this.review ? '建议的更改' : '要包含的更改'}</span>
				<action-nav slot="actions">${this.renderLayoutAction(this.fileLayout)}</action-nav>

				${when(
					this.validityMessage != null,
					() =>
						html`<div class="section">
							<div class="alert alert--error">
								<code-icon icon="error"></code-icon>
								<p class="alert__content">${this.validityMessage}</p>
							</div>
						</div>`,
				)}
				<div class="change-list" data-region="files">
					${when(
						this.create.changes == null,
						() => this.renderLoading(),
						() => this.renderTreeViewWithModel(),
					)}
				</div>
			</webview-pane>
		`;
	}

	// private renderChangeStats() {
	// 	if (this.filesModified == null) return undefined;

	// 	return html`<commit-stats
	// 		.added=${undefined}
	// 		modified="${this.filesModified}"
	// 		.removed=${undefined}
	// 	></commit-stats>`;
	// }

	override onTreeItemChecked(e: CustomEvent<TreeItemCheckedDetail>): void {
		console.log(e);
		// this.onRepoChecked()
		if (e.detail.context == null || e.detail.context.length < 1) return;

		const [repoUri, type] = e.detail.context;
		let checked: boolean | 'staged' = e.detail.checked;
		if (type === 'unstaged') {
			checked = e.detail.checked ? true : 'staged';
		}
		const change = this.getChangeForRepo(repoUri);
		if (change == null) {
			debugger;
			return;
		}

		if (change.checked === checked) return;

		change.checked = checked;
		this.requestUpdate('state');

		this.emit('gl-patch-create-repo-checked', {
			repoUri: repoUri,
			checked: checked,
		});
	}

	override onTreeItemSelected(e: CustomEvent<TreeItemSelectionDetail>): void {
		if (!e.detail.context) return;

		const [file] = e.detail.context;
		this.emit('gl-patch-file-compare-previous', { ...file });
	}

	private renderTreeViewWithModel() {
		if (this.createChanges == null || this.createChanges.length === 0) {
			return this.renderTreeView([
				{
					label: '没有更改',
					path: '',
					level: 1,
					branch: false,
					checkable: false,
					expanded: true,
					checked: false,
				},
			]);
		}

		const treeModel: TreeModel[] = [];
		// for knowing if we need to show repos
		const isCheckable = this.createChanges.length > 1;
		const isTree = this.isTree(this.filesModified ?? 0);
		const compact = this.isCompact;

		if (isCheckable) {
			for (const changeset of this.createChanges) {
				const tree = this.getTreeForChange(changeset, true, isTree, compact);
				if (tree != null) {
					treeModel.push(...tree);
				}
			}
		} else {
			const changeset = this.createChanges[0];
			const tree = this.getTreeForChange(changeset, false, isTree, compact);
			if (tree != null) {
				treeModel.push(...tree);
			}
		}
		return this.renderTreeView(treeModel, this.state?.preferences?.indentGuides);
	}

	private getTreeForChange(change: Change, isMulti = false, isTree = false, compact = true): TreeModel[] | undefined {
		if (change.files == null || change.files.length === 0) return undefined;

		const children = [];
		if (change.type === 'wip') {
			const staged: Change['files'] = [];
			const unstaged: Change['files'] = [];

			for (const f of change.files) {
				if (f.staged) {
					staged.push(f);
				} else {
					unstaged.push(f);
				}
			}

			if (staged.length === 0 || unstaged.length === 0) {
				children.push(...this.renderFiles(change.files, isTree, compact, isMulti ? 2 : 1));
			} else {
				if (unstaged.length) {
					children.push({
						label: '未暂存的更改',
						path: '',
						level: isMulti ? 2 : 1,
						branch: true,
						checkable: true,
						expanded: true,
						checked: change.checked === true,
						context: [change.repository.uri, 'unstaged'],
						children: this.renderFiles(unstaged, isTree, compact, isMulti ? 3 : 2),
					});
				}

				if (staged.length) {
					children.push({
						label: '已暂存的更改',
						path: '',
						level: isMulti ? 2 : 1,
						branch: true,
						checkable: true,
						expanded: true,
						checked: change.checked !== false,
						disableCheck: true,
						children: this.renderFiles(staged, isTree, compact, isMulti ? 3 : 2),
					});
				}
			}
		} else {
			children.push(...this.renderFiles(change.files, isTree, compact));
		}

		if (!isMulti) {
			return children;
		}

		const repoModel = this.repoToTreeModel(change.repository.name, change.repository.uri, {
			branch: true,
			checkable: true,
			checked: change.checked !== false,
		});
		repoModel.children = children;

		return [repoModel];
	}

	private isTree(count: number) {
		if (this.fileLayout === 'auto') {
			return count > (this.state?.preferences?.files?.threshold ?? 5);
		}
		return this.fileLayout === 'tree';
	}

	private createPatch() {
		if (!this.canSubmit) {
			// TODO: show error
			if (this.titleInput.value.length === 0) {
				this.titleInput.setCustomValidity('标题为必填项');
				this.titleInput.reportValidity();
				this.titleInput.focus();
			} else {
				this.titleInput.setCustomValidity('');
			}

			if (this.selectedChanges == null || this.selectedChanges.length === 0) {
				this.validityMessage = '请至少选择一项更改';
			} else {
				this.validityMessage = undefined;
			}
			return;
		}
		this.validityMessage = undefined;
		this.titleInput.setCustomValidity('');

		const changes = this.selectedChanges.reduce<Record<string, Change>>((a, [id, change]) => {
			a[id] = change;
			return a;
		}, {});

		const patch: CreatePatchEventDetail = {
			title: this.create.title ?? '',
			description: this.create.description,
			changesets: changes,
			visibility: this.create.visibility,
			userSelections: this.create.userSelections,
		};
		this.emit('gl-patch-create-patch', patch);
	}

	private onCreateAll(_e: Event) {
		// const change = this.create.[0];
		// if (change == null) {
		// 	return;
		// }
		// this.createPatch([change]);
		this.createPatch();
		if (!this.state?.create) {
			return;
		}
		this.creationBusy = true;
	}

	private onSelectCreateOption(_e: CustomEvent<{ target: MenuItem }>) {
		// const target = e.detail?.target;
		// const value = target?.dataset?.value as 'staged' | 'unstaged' | undefined;
		// const currentChange = this.create.[0];
		// if (value == null || currentChange == null) {
		// 	return;
		// }
		// const change = {
		// 	...currentChange,
		// 	files: currentChange.files.filter(file => {
		// 		const staged = file.staged ?? false;
		// 		return (staged && value === 'staged') || (!staged && value === 'unstaged');
		// 	}),
		// };
		// this.createPatch([change]);
	}

	private getChangeForRepo(repoUri: string): Change | undefined {
		return this.create.changes[repoUri];

		// for (const [id, change] of this.createEntries) {
		// 	if (change.repository.uri === repoUri) return change;
		// }

		// return undefined;
	}

	// private onRepoChecked(e: CustomEvent<{ repoUri: string; checked: boolean }>) {
	// 	const [_, changeset] = this.getRepoChangeSet(e.detail.repoUri);

	// 	if ((changeset as RepoWipChangeSet).checked === e.detail.checked) {
	// 		return;
	// 	}

	// 	(changeset as RepoWipChangeSet).checked = e.detail.checked;
	// 	this.requestUpdate('state');
	// }

	// private onUnstagedChecked(e: CustomEvent<{ repoUri: string; checked: boolean | 'staged' }>) {
	// 	const [_, changeset] = this.getRepoChangeSet(e.detail.repoUri);

	// 	if ((changeset as RepoWipChangeSet).checked === e.detail.checked) {
	// 		return;
	// 	}

	// 	(changeset as RepoWipChangeSet).checked = e.detail.checked;
	// 	this.requestUpdate('state');
	// }

	private onTitleInput(_e: InputEvent) {
		this.create.title = this.titleInput.value;
		this.fireMetadataUpdate();
	}

	private onDebounceTitleInput = debounce(this.onTitleInput, 500);

	private onDescriptionInput(_e: InputEvent) {
		this.create.description = this.descInput.value;
		this.fireMetadataUpdate();
	}

	private onDebounceDescriptionInput = debounce(this.onDescriptionInput, 500);

	private onInviteUsers(_e: Event) {
		this.emit('gl-patch-create-invite-users');
	}

	private onChangeSelectionRole(
		e: MouseEvent,
		selection: DraftUserSelection,
		role: CreatePatchUpdateSelectionEventDetail['role'],
	) {
		this.emit('gl-patch-create-update-selection', { selection: selection, role: role });

		const popoverEl: Popover | null = (e.target as HTMLElement)?.closest('gk-popover');
		popoverEl?.hidePopover();
	}

	private onVisibilityChange(e: Event) {
		this.create.visibility = (e.target as HTMLInputElement).value as DraftVisibility;
		this.fireMetadataUpdate();
	}

	private onGenerateTitleClick(_e: Event) {
		this.generateBusy = true;
		this.emit('gl-patch-generate-title', {
			title: this.create.title!,
			description: this.create.description,
			visibility: this.create.visibility,
		});
	}

	private fireMetadataUpdate() {
		this.emit('gl-patch-create-update-metadata', {
			title: this.create.title!,
			description: this.create.description,
			visibility: this.create.visibility,
		});
	}

	protected override createRenderRoot(): HTMLElement {
		return this;
	}

	override onTreeItemActionClicked(e: CustomEvent<TreeItemActionDetail>): void {
		if (!e.detail.context || !e.detail.action) return;

		const action = e.detail.action;
		switch (action.action) {
			case 'show-patch-in-graph':
				this.onShowInGraph(e);
				break;

			case 'file-open':
				this.onOpenFile(e);
				break;

			case 'file-stage':
				this.onStageFile(e);
				break;

			case 'file-unstage':
				this.onUnstageFile(e);
				break;
		}
	}

	private onOpenFile(e: CustomEvent<TreeItemActionDetail>) {
		if (!e.detail.context) return;

		const [file] = e.detail.context;
		this.emit('gl-patch-file-open', {
			...file,
			showOptions: {
				preview: !e.detail.dblClick,
				viewColumn: e.detail.altKey ? BesideViewColumn : undefined,
			},
		});
	}

	private onStageFile(e: CustomEvent<TreeItemActionDetail>) {
		if (!e.detail.context) return;

		const [file] = e.detail.context;
		this.emit('gl-patch-file-stage', {
			...file,
			showOptions: {
				preview: !e.detail.dblClick,
				viewColumn: e.detail.altKey ? BesideViewColumn : undefined,
			},
		});
	}

	private onUnstageFile(e: CustomEvent<TreeItemActionDetail>) {
		if (!e.detail.context) return;

		const [file] = e.detail.context;
		this.emit('gl-patch-file-unstage', {
			...file,
			showOptions: {
				preview: !e.detail.dblClick,
				viewColumn: e.detail.altKey ? BesideViewColumn : undefined,
			},
		});
	}

	private onShowInGraph(_e: CustomEvent<TreeItemActionDetail>) {
		// this.emit('gl-patch-details-graph-show-patch', { draft: this.state!.create! });
	}

	private onCancel() {
		this.emit('gl-patch-create-cancelled');
	}

	override getFileActions(
		file: GitFileChangeShape,
		_options?: Partial<TreeItemBase>,
	): { icon: string; label: string; action: string }[] {
		const openFile = {
			icon: 'go-to-file',
			label: '打开文件',
			action: 'file-open',
		};

		if (this.review) {
			return [openFile];
		}
		if (file.staged === true) {
			return [openFile, { icon: 'remove', label: '取消暂存更改', action: 'file-unstage' }];
		}
		return [openFile, { icon: 'plus', label: '暂存更改', action: 'file-stage' }];
	}

	override getRepoActions(
		_name: string,
		_path: string,
		_options?: Partial<TreeItemBase>,
	): { icon: string; label: string; action: string }[] {
		return [
			{
				icon: 'gl-graph',
				label: '在提交图中打开',
				action: 'show-patch-in-graph',
			},
		];
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'gl-patch-create': GlPatchCreate;
	}

	interface GlobalEventHandlersEventMap {
		'gl-patch-create-repo-checked': CustomEvent<CreatePatchCheckRepositoryEventDetail>;
		'gl-patch-create-patch': CustomEvent<CreatePatchEventDetail>;
		'gl-patch-create-update-metadata': CustomEvent<CreatePatchMetadataEventDetail>;
		'gl-patch-file-compare-previous': CustomEvent<ExecuteFileActionParams>;
		'gl-patch-file-compare-working': CustomEvent<ExecuteFileActionParams>;
		'gl-patch-file-open': CustomEvent<ExecuteFileActionParams>;
		'gl-patch-file-stage': CustomEvent<ExecuteFileActionParams>;
		'gl-patch-file-unstage': CustomEvent<ExecuteFileActionParams>;
		'gl-patch-generate-title': CustomEvent<CreatePatchMetadataEventDetail>;
		'gl-patch-create-invite-users': CustomEvent<undefined>;
		'gl-patch-create-update-selection': CustomEvent<CreatePatchUpdateSelectionEventDetail>;
		'gl-patch-create-cancelled': CustomEvent<undefined>;
		// 'gl-patch-details-graph-show-patch': CustomEvent<{ draft: State['create'] }>;
	}
}
