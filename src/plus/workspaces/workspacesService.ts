import type { Event, MessageItem, QuickPickItem } from 'vscode';
import { Disposable, EventEmitter, ProgressLocation, Uri, window, workspace } from 'vscode';
import type { GitRemote } from '@gitlens/git/models/remote.js';
import { RemoteResourceType } from '@gitlens/git/models/remoteResource.js';
import { debug } from '@gitlens/utils/decorators/log.js';
import { normalizePath } from '@gitlens/utils/path.js';
import { getSettledValue } from '@gitlens/utils/promise.js';
import type { Container } from '../../container.js';
import type { RepositoryLocationProvider } from '../../git/location/repositorylocationProvider.js';
import { GlRepository } from '../../git/models/repository.js';
import { getRemoteProviderUrl } from '../../git/utils/-webview/remote.utils.js';
import { showRepositoriesPicker } from '../../quickpicks/repositoryPicker.js';
import { toAbortSignal } from '../../system/-webview/cancellation.js';
import type { OpenWorkspaceLocation } from '../../system/-webview/vscode/workspaces.js';
import { openWorkspace } from '../../system/-webview/vscode/workspaces.js';
import type { SubscriptionChangeEvent } from '../gk/subscriptionService.js';
import { isSubscriptionTrialOrPaidFromState } from '../gk/utils/subscription.utils.js';
import type { CloudWorkspaceData, CloudWorkspaceRepositoryDescriptor } from './models/cloudWorkspace.js';
import {
	CloudWorkspace,
	CloudWorkspaceProviderInputType,
	CloudWorkspaceProviderType,
	cloudWorkspaceProviderTypeToRemoteProviderId,
} from './models/cloudWorkspace.js';
import type { LocalWorkspaceData, LocalWorkspaceRepositoryDescriptor } from './models/localWorkspace.js';
import { LocalWorkspace } from './models/localWorkspace.js';
import type {
	AddWorkspaceRepoDescriptor,
	GetWorkspacesResponse,
	LoadCloudWorkspacesResponse,
	LoadLocalWorkspacesResponse,
	RemoteDescriptor,
	RepositoryMatch,
	WorkspaceAutoAddSetting,
	WorkspaceRepositoriesByName,
	WorkspaceRepositoryRelation,
	WorkspacesResponse,
} from './models/workspaces.js';
import type { WorkspacesApi } from './workspacesApi.js';
import type { GkWorkspacesSharedStorageProvider } from './workspacesSharedStorageProvider.js';

export class WorkspacesService implements Disposable {
	private _onDidResetWorkspaces: EventEmitter<void> = new EventEmitter<void>();
	get onDidResetWorkspaces(): Event<void> {
		return this._onDidResetWorkspaces.event;
	}

	private _cloudWorkspaces: CloudWorkspace[] | undefined;
	private _disposable: Disposable;
	private _localWorkspaces: LocalWorkspace[] | undefined;
	private _currentWorkspaceId: string | undefined;
	private _currentWorkspaceAutoAddSetting: WorkspaceAutoAddSetting = 'disabled';
	private _currentWorkspace: CloudWorkspace | LocalWorkspace | undefined;

	constructor(
		private readonly container: Container,
		private readonly _api: WorkspacesApi,
		private readonly _sharedStorage: GkWorkspacesSharedStorageProvider | undefined,
		private readonly _repositoryLocator: RepositoryLocationProvider | undefined,
	) {
		this._currentWorkspaceId = getCurrentWorkspaceId();
		this._currentWorkspaceAutoAddSetting =
			workspace.getConfiguration('gitkraken')?.get<WorkspaceAutoAddSetting>('workspaceAutoAddSetting') ??
			'disabled';
		this._disposable = Disposable.from(
			this._onDidResetWorkspaces,
			container.subscription.onDidChange(this.onSubscriptionChanged, this),
		);
	}

	dispose(): void {
		this._disposable.dispose();
	}

	get currentWorkspaceId(): string | undefined {
		return this._currentWorkspaceId;
	}

	get currentWorkspace(): CloudWorkspace | LocalWorkspace | undefined {
		return this._currentWorkspace;
	}

	private onSubscriptionChanged(event: SubscriptionChangeEvent): void {
		if (
			event.current.account == null ||
			event.current.account.id !== event.previous?.account?.id ||
			event.current.state !== event.previous?.state
		) {
			this.resetWorkspaces({ cloud: true });
		}
	}

	private async loadCloudWorkspaces(excludeRepositories: boolean = false): Promise<LoadCloudWorkspacesResponse> {
		const subscription = await this.container.subscription.getSubscription();
		if (subscription?.account == null) {
			return {
				cloudWorkspaces: undefined,
				cloudWorkspaceInfo: '请先登录后再使用云工作区。',
			};
		}

		const cloudWorkspaces: CloudWorkspace[] = [];
		let workspaces: CloudWorkspaceData[] | undefined;
		try {
			const workspaceResponse: WorkspacesResponse | undefined = await this._api.getWorkspaces({
				includeRepositories: !excludeRepositories,
				includeOrganizations: true,
			});
			workspaces = workspaceResponse?.data?.projects?.nodes;
		} catch {
			return {
				cloudWorkspaces: undefined,
				cloudWorkspaceInfo: '加载云工作区失败。',
			};
		}

		let filteredSharedWorkspaceCount = 0;
		const isPlusEnabled = isSubscriptionTrialOrPaidFromState(subscription.state);
		if (workspaces?.length) {
			for (const workspace of workspaces) {
				const localPath = await this._sharedStorage?.getCloudWorkspaceCodeWorkspaceFileLocation(workspace.id);
				if (!isPlusEnabled && workspace.organization?.id) {
					filteredSharedWorkspaceCount += 1;
					continue;
				}

				const repoDescriptors = workspace.provider_data?.repositories?.nodes;
				let repositories =
					repoDescriptors != null
						? repoDescriptors.map(descriptor => ({ ...descriptor, workspaceId: workspace.id }))
						: repoDescriptors;
				if (repositories == null && !excludeRepositories) {
					repositories = [];
				}

				cloudWorkspaces.push(
					new CloudWorkspace(
						this.container,
						workspace.id,
						workspace.name,
						workspace.organization?.id,
						workspace.provider as CloudWorkspaceProviderType,
						workspace.repo_relation as WorkspaceRepositoryRelation,
						this._currentWorkspaceId != null && this._currentWorkspaceId === workspace.id,
						workspace.provider === CloudWorkspaceProviderType.Azure
							? {
									organizationId: workspace.azure_organization_id ?? undefined,
									project: workspace.azure_project ?? undefined,
								}
							: undefined,
						repositories,
						localPath,
					),
				);
			}
		}

		return {
			cloudWorkspaces: cloudWorkspaces,
			cloudWorkspaceInfo:
				filteredSharedWorkspaceCount > 0
					? `${filteredSharedWorkspaceCount} 个共享工作区已隐藏，升级到 GitLens Pro 后可访问。`
					: undefined,
		};
	}

	// TODO@ramint: When we interact more with local workspaces, this should return more info about failures.
	private async loadLocalWorkspaces(): Promise<LoadLocalWorkspacesResponse> {
		const localWorkspaces: LocalWorkspace[] = [];
		const workspaceFileData: LocalWorkspaceData =
			(await this._sharedStorage?.getLocalWorkspaceData())?.workspaces || {};
		for (const workspace of Object.values(workspaceFileData)) {
			if (workspace.localId == null || workspace.name == null) continue;

			localWorkspaces.push(
				new LocalWorkspace(
					this.container,
					workspace.localId,
					workspace.name,
					workspace.repositories?.map(repositoryPath => ({
						localPath: repositoryPath.localPath,
						name: repositoryPath.localPath.split(/[\\/]/).pop() ?? '未知',
						workspaceId: workspace.localId,
					})) ?? [],
					this._currentWorkspaceId != null && this._currentWorkspaceId === workspace.localId,
				),
			);
		}

		return {
			localWorkspaces: localWorkspaces,
			localWorkspaceInfo: undefined,
		};
	}

	private getCloudWorkspace(workspaceId: string): CloudWorkspace | undefined {
		return this._cloudWorkspaces?.find(workspace => workspace.id === workspaceId);
	}

	private getLocalWorkspace(workspaceId: string): LocalWorkspace | undefined {
		return this._localWorkspaces?.find(workspace => workspace.id === workspaceId);
	}

	@debug()
	async getWorkspaces(options?: { excludeRepositories?: boolean; force?: boolean }): Promise<GetWorkspacesResponse> {
		const getWorkspacesResponse: GetWorkspacesResponse = {
			cloudWorkspaces: [],
			localWorkspaces: [],
			cloudWorkspaceInfo: undefined,
			localWorkspaceInfo: undefined,
		};

		if (this._cloudWorkspaces == null || options?.force) {
			const loadCloudWorkspacesResponse = await this.loadCloudWorkspaces(options?.excludeRepositories);
			this._cloudWorkspaces = loadCloudWorkspacesResponse.cloudWorkspaces;
			getWorkspacesResponse.cloudWorkspaceInfo = loadCloudWorkspacesResponse.cloudWorkspaceInfo;
		}

		if (this._localWorkspaces == null || options?.force) {
			const loadLocalWorkspacesResponse = await this.loadLocalWorkspaces();
			this._localWorkspaces = loadLocalWorkspacesResponse.localWorkspaces;
			getWorkspacesResponse.localWorkspaceInfo = loadLocalWorkspacesResponse.localWorkspaceInfo;
		}

		const currentWorkspace = [...(this._cloudWorkspaces ?? []), ...(this._localWorkspaces ?? [])].find(
			workspace => workspace.current,
		);

		if (currentWorkspace != null) {
			this._currentWorkspaceId = currentWorkspace.id;
			this._currentWorkspace = currentWorkspace;
		}

		getWorkspacesResponse.cloudWorkspaces = this._cloudWorkspaces ?? [];
		getWorkspacesResponse.localWorkspaces = this._localWorkspaces ?? [];

		return getWorkspacesResponse;
	}

	async getCloudWorkspaceRepositories(workspaceId: string): Promise<CloudWorkspaceRepositoryDescriptor[]> {
		// TODO@ramint Add error handling/logging when this is used.
		const workspaceRepos = await this._api.getWorkspaceRepositories(workspaceId);
		const descriptors = workspaceRepos?.data?.project?.provider_data?.repositories?.nodes;
		return descriptors?.map(d => ({ ...d, workspaceId: workspaceId })) ?? [];
	}

	@debug()
	async addMissingCurrentWorkspaceRepos(options?: { force?: boolean }): Promise<void> {
		if (this._currentWorkspaceId == null) return;

		let currentWorkspace = [...(this._cloudWorkspaces ?? []), ...(this._localWorkspaces ?? [])].find(
			workspace => workspace.current,
		);

		if (currentWorkspace == null) {
			try {
				const workspaceData = await this._api.getWorkspace(this._currentWorkspaceId, {
					includeRepositories: true,
				});
				if (workspaceData?.data?.project == null) return;

				const repoDescriptors = workspaceData.data.project.provider_data?.repositories?.nodes;
				const repositories =
					repoDescriptors != null
						? repoDescriptors.map(descriptor => ({
								...descriptor,
								workspaceId: workspaceData.data.project.id,
							}))
						: [];
				currentWorkspace = new CloudWorkspace(
					this.container,
					workspaceData.data.project.id,
					workspaceData.data.project.name,
					workspaceData.data.project.organization?.id,
					workspaceData.data.project.provider as CloudWorkspaceProviderType,
					workspaceData.data.project.repo_relation as WorkspaceRepositoryRelation,
					true,
					workspaceData.data.project.provider === CloudWorkspaceProviderType.Azure
						? {
								organizationId: workspaceData.data.project.azure_organization_id ?? undefined,
								project: workspaceData.data.project.azure_project ?? undefined,
							}
						: undefined,
					repositories,
					workspace.workspaceFile?.fsPath,
				);
			} catch {
				return;
			}
		}

		if ((!options?.force && this._currentWorkspaceAutoAddSetting === 'disabled') || !currentWorkspace?.current) {
			return;
		}

		this._currentWorkspace = currentWorkspace;

		if (!(await currentWorkspace.getRepositoryDescriptors())?.length) return;

		const repositories = Array.from(
			(
				await this.resolveWorkspaceRepositoriesByName(currentWorkspace, {
					resolveFromPath: true,
					usePathMapping: true,
				})
			).values(),
			r => r.repository,
		);
		const currentWorkspaceRepositoryIdMap = new Map<string, GlRepository>();
		for (const repository of this.container.git.openRepositories) {
			currentWorkspaceRepositoryIdMap.set(repository.id, repository);
		}
		const repositoriesToAdd = repositories.filter(r => !currentWorkspaceRepositoryIdMap.has(r.id));
		if (repositoriesToAdd.length === 0) {
			if (options?.force) {
				void window.showInformationMessage('没有可添加的新仓库。', { modal: true });
			}
			return;
		}

		let chosenRepoPaths: string[] = [];
		if (!options?.force && this._currentWorkspaceAutoAddSetting === 'prompt') {
			const add = { title: '添加...' };
			const change = { title: '更改自动添加行为...' };
			const cancel = { title: '取消', isCloseAffordance: true };
			const addChoice = await window.showInformationMessage(
				'在关联的云工作区中发现了新仓库。是否将它们添加到当前 VS Code 工作区？',
				add,
				change,
				cancel,
			);

			if (addChoice == null || addChoice === cancel) return;
			if (addChoice === change) {
				void this.chooseCodeWorkspaceAutoAddSetting({ current: true });
				return;
			}
		}

		if (options?.force || this._currentWorkspaceAutoAddSetting === 'prompt') {
			const pick = await showRepositoriesPicker(
				this.container,
				'添加仓库到工作区',
				'选择要添加到当前工作区的仓库',
				repositoriesToAdd,
				{ excludeWorktrees: true },
			);
			if (pick.length === 0) return;

			chosenRepoPaths = pick.map(p => p.path);
		} else {
			chosenRepoPaths = repositoriesToAdd.map(r => r.path);
		}

		if (chosenRepoPaths.length === 0) return;

		const count = workspace.workspaceFolders?.length ?? 0;
		void window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: `正在从关联的云工作区添加新仓库...`,
				cancellable: false,
			},
			() => {
				return new Promise(resolve => {
					workspace.updateWorkspaceFolders(count, 0, ...chosenRepoPaths.map(p => ({ uri: Uri.file(p) })));
					resolve(true);
				});
			},
		);
	}

	@debug()
	resetWorkspaces(options?: { cloud?: boolean; local?: boolean }): void {
		if (options?.cloud ?? true) {
			this._cloudWorkspaces = undefined;
		}
		if (options?.local ?? true) {
			this._localWorkspaces = undefined;
		}

		this._onDidResetWorkspaces.fire();
	}

	async getCloudWorkspaceRepoPath(cloudWorkspaceId: string, repoId: string): Promise<string | undefined> {
		return this._sharedStorage?.getCloudWorkspaceRepositoryLocation(cloudWorkspaceId, repoId);
	}

	async updateCloudWorkspaceRepoLocalPath(workspaceId: string, repoId: string, localPath: string): Promise<void> {
		await this._sharedStorage?.storeCloudWorkspaceRepositoryLocation(workspaceId, repoId, localPath);
	}

	private async getRepositoriesInParentFolder(cancellation?: AbortSignal): Promise<GlRepository[] | undefined> {
		const parentUri = (
			await window.showOpenDialog({
				title: `选择一个包含此工作区仓库的文件夹`,
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
			})
		)?.[0];

		if (parentUri == null || cancellation?.aborted) return undefined;

		try {
			return await this.container.git.findRepositories(parentUri, {
				cancellation: cancellation,
				depth: 1,
				silent: true,
			});
		} catch (_ex) {
			return undefined;
		}
	}

	async locateAllCloudWorkspaceRepos(workspaceId: string, cancellation?: AbortSignal): Promise<void> {
		const workspace = this.getCloudWorkspace(workspaceId);
		if (workspace == null) return;

		const repoDescriptors = await workspace.getRepositoryDescriptors();
		if (repoDescriptors == null || repoDescriptors.length === 0) return;

		const foundRepos = await this.getRepositoriesInParentFolder(cancellation);
		if (foundRepos == null || foundRepos.length === 0 || cancellation?.aborted) return;

		for (const repoMatch of (
			await this.resolveWorkspaceRepositoriesByName(workspaceId, {
				cancellation: cancellation,
				repositories: foundRepos,
			})
		).values()) {
			await this.locateWorkspaceRepo(workspaceId, repoMatch.descriptor, repoMatch.repository);

			if (cancellation?.aborted) return;
		}
	}

	async locateWorkspaceRepo(
		workspaceId: string,
		descriptor: CloudWorkspaceRepositoryDescriptor | LocalWorkspaceRepositoryDescriptor,
	): Promise<void>;
	async locateWorkspaceRepo(
		workspaceId: string,
		descriptor: CloudWorkspaceRepositoryDescriptor | LocalWorkspaceRepositoryDescriptor,
		// eslint-disable-next-line @typescript-eslint/unified-signatures
		uri: Uri,
	): Promise<void>;
	async locateWorkspaceRepo(
		workspaceId: string,
		descriptor: CloudWorkspaceRepositoryDescriptor | LocalWorkspaceRepositoryDescriptor,
		// eslint-disable-next-line @typescript-eslint/unified-signatures
		repository: GlRepository,
	): Promise<void>;
	@debug({ args: (workspaceId: string) => ({ workspaceId: workspaceId }) })
	async locateWorkspaceRepo(
		workspaceId: string,
		descriptor: CloudWorkspaceRepositoryDescriptor | LocalWorkspaceRepositoryDescriptor,
		uriOrRepository?: Uri | GlRepository,
	): Promise<void> {
		let repo;
		if (uriOrRepository == null || uriOrRepository instanceof Uri) {
			let repoLocatedUri = uriOrRepository;
			repoLocatedUri ??= (
				await window.showOpenDialog({
					title: `为 ${descriptor.name} 选择位置`,
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
				})
			)?.[0];

			if (repoLocatedUri == null) return;

			repo = await this.container.git.getOrAddRepository(repoLocatedUri, {
				opened: false,
				detectNested: false,
			});
			if (repo == null) return;
		} else {
			repo = uriOrRepository;
		}

		const repoPath = repo.uri.fsPath;

		const remotes = await repo.git.remotes.getRemotes();
		const remoteUrlPromises: Promise<string | undefined>[] = remotes.map((remote: GitRemote) =>
			Promise.resolve(
				remote.provider != null
					? getRemoteProviderUrl(remote.provider, { type: RemoteResourceType.Repo })
					: undefined,
			),
		);
		const remoteUrls: string[] = (await Promise.allSettled(remoteUrlPromises))
			.map(r => getSettledValue(r))
			.filter(r => r != null);

		for (const remoteUrl of remoteUrls) {
			await this._repositoryLocator?.storeLocation(repoPath, remoteUrl);
		}

		const workspace = this.getCloudWorkspace(workspaceId) ?? this.getLocalWorkspace(workspaceId);
		let provider: string | undefined;
		if (provider == null && workspace?.type === 'cloud') {
			provider = workspace.provider;
		}

		if (
			descriptor.id != null &&
			(descriptor.url != null ||
				(descriptor.provider_organization_id != null && descriptor.name != null && provider != null))
		) {
			await this._repositoryLocator?.storeLocation(repoPath, descriptor.url ?? undefined, {
				provider: provider,
				owner: descriptor.provider_organization_id,
				repoName: descriptor.name,
			});
		}

		if (descriptor.id != null) {
			await this.updateCloudWorkspaceRepoLocalPath(workspaceId, descriptor.id, repoPath);
		}
	}

	@debug({ args: false })
	async createCloudWorkspace(options?: { repos?: GlRepository[] }): Promise<void> {
		const input = window.createInputBox();
		input.title = '创建云工作区';
		const quickpick = window.createQuickPick();
		quickpick.title = '创建云工作区';
		const quickpickLabelToProviderType: Record<string, CloudWorkspaceProviderInputType> = {
			GitHub: CloudWorkspaceProviderInputType.GitHub,
			'GitHub Enterprise': CloudWorkspaceProviderInputType.GitHubEnterprise,
			// TODO add support for these in the future
			// GitLab: CloudWorkspaceProviderInputType.GitLab,
			// 'GitLab Self-Managed': CloudWorkspaceProviderInputType.GitLabSelfHosted,
			// Bitbucket: CloudWorkspaceProviderInputType.Bitbucket,
			// Azure: CloudWorkspaceProviderInputType.Azure,
		};

		input.ignoreFocusOut = true;

		const disposables: Disposable[] = [];

		let workspaceName: string | undefined;
		let workspaceDescription: string | undefined;

		let hostUrl: string | undefined;
		let azureOrganizationName: string | undefined;
		let azureProjectName: string | undefined;
		let workspaceProvider: CloudWorkspaceProviderInputType | undefined;
		if (options?.repos != null && options.repos.length > 0) {
			// Currently only GitHub is supported.
			for (const repo of options.repos) {
				const repoRemotes = await repo.git.remotes.getRemotes({
					filter: (r: GitRemote) => r.domain === 'github.com',
				});
				if (repoRemotes.length === 0) {
					await window.showErrorMessage(`此操作仅支持 GitHub。请确保所有已打开仓库均托管在 GitHub 上。`, {
						modal: true,
					});
					return;
				}
			}

			workspaceProvider = CloudWorkspaceProviderInputType.GitHub;
		}

		try {
			workspaceName = await new Promise<string | undefined>(resolve => {
				disposables.push(
					input.onDidHide(() => resolve(undefined)),
					input.onDidAccept(() => {
						const value = input.value.trim();
						if (!value) {
							input.validationMessage = '请输入非空的工作区名称';
							return;
						}

						resolve(value);
					}),
				);

				input.placeholder = '请输入新工作区名称';
				input.prompt = '输入工作区名称';
				input.show();
			});

			if (!workspaceName) return;

			workspaceDescription = await new Promise<string | undefined>(resolve => {
				disposables.push(
					input.onDidHide(() => resolve(undefined)),
					input.onDidAccept(() => {
						const value = input.value.trim();
						if (!value) {
							input.validationMessage = '请输入非空的工作区描述';
							return;
						}

						resolve(value);
					}),
				);

				input.value = '';
				input.title = '创建工作区';
				input.placeholder = '请输入新工作区描述';
				input.prompt = '输入工作区描述';
				input.show();
			});

			if (!workspaceDescription) return;

			workspaceProvider ??= await new Promise<CloudWorkspaceProviderInputType | undefined>(resolve => {
				disposables.push(
					quickpick.onDidHide(() => resolve(undefined)),
					quickpick.onDidAccept(() => {
						if (quickpick.activeItems.length !== 0) {
							resolve(quickpickLabelToProviderType[quickpick.activeItems[0].label]);
						}
					}),
				);

				quickpick.placeholder = '请选择新工作区的提供方';
				quickpick.items = Object.keys(quickpickLabelToProviderType).map(label => ({ label: label }));
				quickpick.canSelectMany = false;
				quickpick.show();
			});

			if (!workspaceProvider) return;

			if (
				workspaceProvider === CloudWorkspaceProviderInputType.GitHubEnterprise ||
				workspaceProvider === CloudWorkspaceProviderInputType.GitLabSelfHosted
			) {
				hostUrl = await new Promise<string | undefined>(resolve => {
					disposables.push(
						input.onDidHide(() => resolve(undefined)),
						input.onDidAccept(() => {
							const value = input.value.trim();
							if (!value) {
								input.validationMessage = '请输入非空的工作区主机 URL';
								return;
							}

							resolve(value);
						}),
					);

					input.value = '';
					input.placeholder = '请输入新工作区主机 URL';
					input.prompt = '输入工作区主机 URL';
					input.show();
				});

				if (!hostUrl) return;
			}

			if (workspaceProvider === CloudWorkspaceProviderInputType.Azure) {
				azureOrganizationName = await new Promise<string | undefined>(resolve => {
					disposables.push(
						input.onDidHide(() => resolve(undefined)),
						input.onDidAccept(() => {
							const value = input.value.trim();
							if (!value) {
								input.validationMessage = '请输入非空的工作区组织名称';
								return;
							}

							resolve(value);
						}),
					);

					input.value = '';
					input.placeholder = '请输入新工作区组织名称';
					input.prompt = '输入工作区组织名称';
					input.show();
				});

				if (!azureOrganizationName) return;

				azureProjectName = await new Promise<string | undefined>(resolve => {
					disposables.push(
						input.onDidHide(() => resolve(undefined)),
						input.onDidAccept(() => {
							const value = input.value.trim();
							if (!value) {
								input.validationMessage = '请输入非空的工作区项目名称';
								return;
							}

							resolve(value);
						}),
					);

					input.value = '';
					input.placeholder = '请输入新工作区项目名称';
					input.prompt = '输入工作区项目名称';
					input.show();
				});

				if (!azureProjectName) return;
			}
		} finally {
			input.dispose();
			quickpick.dispose();
			disposables.forEach(d => void d.dispose());
		}

		const createOptions = {
			name: workspaceName,
			description: workspaceDescription,
			provider: workspaceProvider,
			hostUrl: hostUrl,
			azureOrganizationName: azureOrganizationName,
			azureProjectName: azureProjectName,
		};

		let createdProjectData: CloudWorkspaceData | null | undefined;
		try {
			const response = await this._api.createWorkspace(createOptions);
			createdProjectData = response?.data?.create_project;
		} catch {
			return;
		}

		if (createdProjectData != null) {
			// Add the new workspace to cloud workspaces
			this._cloudWorkspaces ??= [];

			const localPath = await this._sharedStorage?.getCloudWorkspaceCodeWorkspaceFileLocation(
				createdProjectData.id,
			);

			this._cloudWorkspaces?.push(
				new CloudWorkspace(
					this.container,
					createdProjectData.id,
					createdProjectData.name,
					createdProjectData.organization?.id,
					createdProjectData.provider as CloudWorkspaceProviderType,
					createdProjectData.repo_relation as WorkspaceRepositoryRelation,
					this._currentWorkspaceId != null && this._currentWorkspaceId === createdProjectData.id,
					createdProjectData.provider === CloudWorkspaceProviderType.Azure
						? {
								organizationId: createdProjectData.azure_organization_id ?? undefined,
								project: createdProjectData.azure_project ?? undefined,
							}
						: undefined,
					[],
					localPath,
				),
			);

			const newWorkspace = this.getCloudWorkspace(createdProjectData.id);
			if (newWorkspace != null) {
				await this.addCloudWorkspaceRepos(newWorkspace.id, {
					repos: options?.repos,
					suppressNotifications: true,
				});
			}
		}
	}

	@debug()
	async deleteCloudWorkspace(workspaceId: string): Promise<void> {
		const confirmation = await window.showWarningMessage(
			`确定要删除此工作区吗？此操作无法撤销。`,
			{ modal: true },
			{ title: '确认' },
			{ title: '取消', isCloseAffordance: true },
		);
		if (confirmation == null || confirmation.title === '取消') return;
		try {
			const response = await this._api.deleteWorkspace(workspaceId);
			if (response?.data?.delete_project?.id === workspaceId) {
				// Remove the workspace from the local workspace list.
				this._cloudWorkspaces = this._cloudWorkspaces?.filter(w => w.id !== workspaceId);
			}
		} catch (error) {
			void window.showErrorMessage(error.message);
		}
	}

	private async filterReposForProvider(
		repos: GlRepository[],
		provider: CloudWorkspaceProviderType,
	): Promise<GlRepository[]> {
		const validRepos: GlRepository[] = [];
		for (const repo of repos) {
			const matchingRemotes = await repo.git.remotes.getRemotes({
				filter: (r: GitRemote) => r.provider?.id === cloudWorkspaceProviderTypeToRemoteProviderId[provider],
			});
			if (matchingRemotes.length) {
				validRepos.push(repo);
			}
		}

		return validRepos;
	}

	private async filterReposForCloudWorkspace(repos: GlRepository[], workspaceId: string): Promise<GlRepository[]> {
		const workspace = this.getCloudWorkspace(workspaceId) ?? this.getLocalWorkspace(workspaceId);
		if (workspace == null) return repos;

		const workspaceRepos = Array.from(
			(await workspace.getRepositoriesByName()).values(),
			match => match.repository,
		);
		return repos.filter(repo => !workspaceRepos.some(r => r.id === repo.id));
	}

	@debug({ args: (workspaceId: string) => ({ workspaceId: workspaceId }) })
	async addCloudWorkspaceRepos(
		workspaceId: string,
		options?: { repos?: GlRepository[]; suppressNotifications?: boolean },
	): Promise<void> {
		const workspace = this.getCloudWorkspace(workspaceId);
		if (workspace == null) return;

		const repoInputs: (AddWorkspaceRepoDescriptor & { repo: GlRepository; url?: string })[] = [];
		let reposOrRepoPaths: GlRepository[] | string[] | undefined = options?.repos;
		if (!options?.repos) {
			let validRepos = await this.filterReposForProvider(this.container.git.openRepositories, workspace.provider);
			validRepos = await this.filterReposForCloudWorkspace(validRepos, workspaceId);
			const choices: {
				label: string;
				description?: string;
				choice: 'currentWindow' | 'parentFolder';
				picked?: boolean;
			}[] = [
				{
					label: '从文件夹中选择仓库',
					description: undefined,
					choice: 'parentFolder',
				},
			];

			if (validRepos.length > 0) {
				choices.unshift({
					label: '从当前窗口中选择仓库',
					description: undefined,
					choice: 'currentWindow',
				});
			}

			choices[0].picked = true;

			const repoChoice = await window.showQuickPick(choices, {
				placeHolder: '从当前窗口或某个文件夹中选择仓库',
				ignoreFocusOut: true,
			});

			if (repoChoice == null) return;

			if (repoChoice.choice === 'parentFolder') {
				await window.withProgress(
					{
						location: ProgressLocation.Notification,
						title: `正在查找可添加到工作区的仓库...`,
						cancellable: true,
					},
					async (_progress, token) => {
						const foundRepos = await this.getRepositoriesInParentFolder(toAbortSignal(token));
						if (foundRepos == null) return;
						if (foundRepos.length === 0) {
							if (!options?.suppressNotifications) {
								void window.showInformationMessage(`在所选文件夹中未找到仓库。`, {
									modal: true,
								});
							}
							return;
						}

						if (token.isCancellationRequested) return;

						validRepos = await this.filterReposForProvider(foundRepos, workspace.provider);
						if (validRepos.length === 0) {
							if (!options?.suppressNotifications) {
								void window.showInformationMessage(
									`未找到与提供方 ${workspace.provider} 匹配的仓库。`,
									{
										modal: true,
									},
								);
							}
							return;
						}

						if (token.isCancellationRequested) return;

						validRepos = await this.filterReposForCloudWorkspace(validRepos, workspaceId);
						if (validRepos.length === 0) {
							if (!options?.suppressNotifications) {
								void window.showInformationMessage(`所有可用仓库都已在此工作区中。`, {
									modal: true,
								});
							}
						}
					},
				);
			}

			const pick = await showRepositoriesPicker(
				this.container,
				'添加仓库到工作区',
				'选择要添加到工作区的仓库',
				validRepos,
				{ excludeWorktrees: true },
			);
			if (pick.length === 0) return;

			reposOrRepoPaths = pick.map(p => p.path);
		}

		if (reposOrRepoPaths == null) return;

		for (const repoOrPath of reposOrRepoPaths) {
			const repo =
				repoOrPath instanceof GlRepository
					? repoOrPath
					: await this.container.git.getOrAddRepository(Uri.file(repoOrPath), { opened: false });
			if (repo == null) continue;

			const remote = (await repo.git.remotes.getRemote('origin')) || (await repo.git.remotes.getRemotes())?.[0];
			const remoteDescriptor = await getRemoteDescriptor(remote);
			if (remoteDescriptor == null) continue;

			repoInputs.push({
				owner: remoteDescriptor.owner,
				repoName: remoteDescriptor.repoName,
				repo: repo,
				url: remoteDescriptor.url,
			});
		}

		if (repoInputs.length === 0) return;

		let newRepoDescriptors: CloudWorkspaceRepositoryDescriptor[] = [];
		const oldDescriptorIds = new Set((await workspace.getRepositoryDescriptors()).map(r => r.id));

		await window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: `正在将仓库添加到工作区 ${workspace.name}...`,
				cancellable: false,
			},
			async () => {
				try {
					const response = await this._api.addReposToWorkspace(
						workspaceId,
						repoInputs.map(r => ({ owner: r.owner, repoName: r.repoName })),
					);

					if (response?.data.add_repositories_to_project == null) return;

					newRepoDescriptors = Object.values(response.data.add_repositories_to_project.provider_data)
						.filter(descriptor => descriptor != null)
						.map(descriptor => ({ ...descriptor, workspaceId: workspaceId }));
				} catch (error) {
					void window.showErrorMessage(error.message);
					return;
				}

				if (newRepoDescriptors.length > 0) {
					workspace.addRepositories(newRepoDescriptors);
				}

				if (newRepoDescriptors.length < repoInputs.length) {
					newRepoDescriptors = (await workspace.getRepositoryDescriptors({ force: true })).filter(
						r => !oldDescriptorIds.has(r.id),
					);
				}

				for (const { repo, repoName, url } of repoInputs) {
					const successfullyAddedDescriptor = newRepoDescriptors.find(
						r => r.name.toLowerCase() === repoName || r.url === url,
					);
					if (successfullyAddedDescriptor == null) continue;

					await this.locateWorkspaceRepo(workspaceId, successfullyAddedDescriptor, repo);
				}
			},
		);
	}

	@debug({ args: (workspaceId: string) => ({ workspaceId: workspaceId }) })
	async removeCloudWorkspaceRepo(workspaceId: string, descriptor: CloudWorkspaceRepositoryDescriptor): Promise<void> {
		const workspace = this.getCloudWorkspace(workspaceId);
		if (workspace == null) return;

		const confirmation = await window.showWarningMessage(
			`确定要从此工作区移除 ${descriptor.name} 吗？此操作无法撤销。`,
			{ modal: true },
			{ title: '确认' },
			{ title: '取消', isCloseAffordance: true },
		);
		if (confirmation == null || confirmation.title === '取消') return;
		try {
			const response = await this._api.removeReposFromWorkspace(workspaceId, [
				{ owner: descriptor.provider_organization_id, repoName: descriptor.name },
			]);

			if (response?.data.remove_repositories_from_project == null) return;

			workspace.removeRepositories([descriptor.name]);
		} catch (error) {
			void window.showErrorMessage(error.message);
		}
	}

	async resolveWorkspaceRepositoriesByName(
		workspace: CloudWorkspace | LocalWorkspace,
		options?: {
			cancellation?: AbortSignal;
			repositories?: GlRepository[];
			resolveFromPath?: boolean;
			usePathMapping?: boolean;
		},
	): Promise<WorkspaceRepositoriesByName>;
	async resolveWorkspaceRepositoriesByName(
		workspaceId: string,
		options?: {
			cancellation?: AbortSignal;
			repositories?: GlRepository[];
			resolveFromPath?: boolean;
			usePathMapping?: boolean;
		},
	): Promise<WorkspaceRepositoriesByName>;
	@debug({
		args: (workspaceOrId: CloudWorkspace | LocalWorkspace | string) => ({
			workspaceOrId: typeof workspaceOrId === 'string' ? workspaceOrId : workspaceOrId.id,
		}),
	})
	async resolveWorkspaceRepositoriesByName(
		workspaceOrId: CloudWorkspace | LocalWorkspace | string,
		options?: {
			cancellation?: AbortSignal;
			repositories?: GlRepository[];
			resolveFromPath?: boolean;
			usePathMapping?: boolean;
		},
	): Promise<WorkspaceRepositoriesByName> {
		const workspaceRepositoriesByName: WorkspaceRepositoriesByName = new Map<string, RepositoryMatch>();

		const workspace =
			workspaceOrId instanceof CloudWorkspace || workspaceOrId instanceof LocalWorkspace
				? workspaceOrId
				: (this.getLocalWorkspace(workspaceOrId) ?? this.getCloudWorkspace(workspaceOrId));
		if (workspace == null) return workspaceRepositoriesByName;

		const repoDescriptors = await workspace.getRepositoryDescriptors();
		if (repoDescriptors == null || repoDescriptors.length === 0) return workspaceRepositoriesByName;

		const currentRepositories = options?.repositories ?? this.container.git.repositories;

		const reposProviderMap = new Map<string, GlRepository>();
		const reposPathMap = new Map<string, GlRepository>();
		for (const repo of currentRepositories) {
			if (options?.cancellation?.aborted) break;

			reposPathMap.set(normalizePath(repo.uri.fsPath.toLowerCase()), repo);

			if (workspace instanceof CloudWorkspace) {
				const remotes = await repo.git.remotes.getRemotes();
				for (const remote of remotes) {
					const remoteDescriptor = await getRemoteDescriptor(remote);
					if (remoteDescriptor == null) continue;

					reposProviderMap.set(
						`${remoteDescriptor.provider}/${remoteDescriptor.owner}/${remoteDescriptor.repoName}`,
						repo,
					);
				}
			}
		}

		for (const descriptor of repoDescriptors) {
			let repoLocalPath = null;
			let foundRepo = null;

			// Local workspace repo descriptors should match on local path
			if (descriptor.id == null) {
				repoLocalPath = descriptor.localPath;
				// Cloud workspace repo descriptors should match on either provider/owner/name or url on any remote
			} else if (options?.usePathMapping === true) {
				repoLocalPath = await this.getMappedPathForCloudWorkspaceRepoDescriptor(descriptor);
			}

			if (repoLocalPath != null) {
				foundRepo = reposPathMap.get(normalizePath(repoLocalPath.toLowerCase()));
			}

			if (foundRepo == null && descriptor.id != null && descriptor.provider != null) {
				foundRepo = reposProviderMap.get(
					`${descriptor.provider.toLowerCase()}/${descriptor.provider_organization_id.toLowerCase()}/${descriptor.name.toLowerCase()}`,
				);
			}

			if (repoLocalPath != null && foundRepo == null && options?.resolveFromPath === true) {
				foundRepo = await this.container.git.getOrAddRepository(Uri.file(repoLocalPath), {
					opened: false,
					force: true,
				});
				// TODO: Add this logic back in once we think through virtual repository support a bit more.
				// We want to support virtual repositories not just as an automatic backup, but as a user choice.
				/*if (!foundRepo) {
					let uri: Uri | undefined = undefined;
					if (repoLocalPath) {
						uri = Uri.file(repoLocalPath);
					} else if (descriptor.url) {
						uri = Uri.parse(descriptor.url);
						uri = uri.with({
							scheme: Schemes.Virtual,
							authority: encodeAuthority<GitHubAuthorityMetadata>('github'),
							path: uri.path,
						});
					}
					if (uri) {
						foundRepo = await this.container.git.getOrAddRepository(uri, { opened: false });
					}
				}*/
			}

			if (foundRepo != null) {
				workspaceRepositoriesByName.set(descriptor.name, { descriptor: descriptor, repository: foundRepo });
			}
		}

		return workspaceRepositoriesByName;
	}

	@debug()
	async saveAsCodeWorkspaceFile(workspaceId: string): Promise<void> {
		const workspace = this.getCloudWorkspace(workspaceId) ?? this.getLocalWorkspace(workspaceId);
		if (workspace == null) return;

		const repoDescriptors = await workspace.getRepositoryDescriptors();
		if (repoDescriptors == null) return;

		const workspaceRepositoriesByName = await workspace.getRepositoriesByName();

		if (workspaceRepositoriesByName.size === 0) {
			void window.showErrorMessage('在本地找不到此工作区中的任何仓库。请至少定位一个仓库。', { modal: true });
			return;
		}

		const workspaceFolderPaths: string[] = [];
		for (const repoMatch of workspaceRepositoriesByName.values()) {
			const repo = repoMatch.repository;
			if (!repo.virtual) {
				workspaceFolderPaths.push(repo.uri.fsPath);
			}
		}

		if (workspaceFolderPaths.length < repoDescriptors.length) {
			const confirmation = await window.showWarningMessage(
				`此工作区中的部分仓库无法在本地定位。是否继续？`,
				{ modal: true },
				{ title: '继续' },
				{ title: '取消', isCloseAffordance: true },
			);
			if (confirmation == null || confirmation.title === '取消') return;
		}

		// Have the user choose a name and location for the new workspace file
		const newWorkspaceUri = await window.showSaveDialog({
			defaultUri: Uri.file(`${workspace.name}.code-workspace`),
			filters: {
				代码工作区: ['code-workspace'],
			},
			title: '为新的代码工作区文件选择位置',
		});

		if (newWorkspaceUri == null) return;

		const newWorkspaceAutoAddSetting = await this.chooseCodeWorkspaceAutoAddSetting();

		const created = await this._sharedStorage?.createOrUpdateCodeWorkspaceFile(
			newWorkspaceUri,
			workspaceFolderPaths,
			{
				workspaceId: workspaceId,
				workspaceAutoAddSetting: newWorkspaceAutoAddSetting,
			},
		);

		if (!created) {
			void window.showErrorMessage('无法创建新的工作区文件。请查看日志了解详情');
			return;
		}

		workspace.setLocalPath(newWorkspaceUri.fsPath);

		type LocationMessageItem = MessageItem & { location?: OpenWorkspaceLocation };

		const openNewWindow: LocationMessageItem = { title: '在新窗口中打开', location: 'newWindow' };
		const openCurrent: LocationMessageItem = { title: '在当前窗口中打开', location: 'currentWindow' };
		const cancel: LocationMessageItem = { title: '取消', isCloseAffordance: true } as const;
		const result = await window.showInformationMessage(
			`已为 ${workspace.name} 创建工作区文件。是否立即打开？`,
			{ modal: true },
			openNewWindow,
			openCurrent,
			cancel,
		);

		if (result == null || result === cancel) return;

		void this.openCodeWorkspaceFile(workspaceId, { location: result.location });
	}

	@debug()
	async chooseCodeWorkspaceAutoAddSetting(options?: { current?: boolean }): Promise<WorkspaceAutoAddSetting> {
		if (
			options?.current &&
			(workspace.workspaceFile == null ||
				this._currentWorkspaceId == null ||
				this._currentWorkspaceAutoAddSetting == null)
		) {
			return 'disabled';
		}

		const defaultOption = options?.current ? this._currentWorkspaceAutoAddSetting : 'disabled';

		type QuickPickItemWithOption = QuickPickItem & { option: WorkspaceAutoAddSetting };

		const autoAddOptions: QuickPickItemWithOption[] = [
			{
				label: '打开工作区（窗口）时自动添加',
				description: this._currentWorkspaceAutoAddSetting === 'enabled' ? '当前' : undefined,
				option: 'enabled',
			},
			{
				label: '打开工作区（窗口）时询问',
				description: this._currentWorkspaceAutoAddSetting === 'prompt' ? '当前' : undefined,
				option: 'prompt',
			},
			{
				label: '从不',
				description: this._currentWorkspaceAutoAddSetting === 'disabled' ? '当前' : undefined,
				option: 'disabled',
			},
		];

		const newWorkspaceAutoAddOption = await window.showQuickPick<QuickPickItemWithOption>(autoAddOptions, {
			placeHolder: '选择将缺失仓库自动添加到当前 VS Code 工作区的行为',
			title: '关联工作区：自动添加仓库',
		});
		if (newWorkspaceAutoAddOption?.option == null) return defaultOption;

		const newWorkspaceAutoAddSetting = newWorkspaceAutoAddOption.option;

		if (options?.current && workspace.workspaceFile != null) {
			const updated = await this._sharedStorage?.updateCodeWorkspaceFileSettings(workspace.workspaceFile, {
				workspaceAutoAddSetting: newWorkspaceAutoAddSetting,
			});
			if (!updated) return this._currentWorkspaceAutoAddSetting;

			this._currentWorkspaceAutoAddSetting = newWorkspaceAutoAddSetting;
		}

		return newWorkspaceAutoAddSetting;
	}

	@debug()
	async openCodeWorkspaceFile(workspaceId: string, options?: { location?: OpenWorkspaceLocation }): Promise<void> {
		const workspace = this.getCloudWorkspace(workspaceId) ?? this.getLocalWorkspace(workspaceId);
		if (workspace == null) return;
		if (workspace.localPath == null) {
			const create = await window.showInformationMessage(
				`${workspace.name} 的工作区文件尚未创建。是否现在创建？`,
				{ modal: true },
				{ title: '创建' },
				{ title: '取消', isCloseAffordance: true },
			);

			if (create == null || create.title === '取消') return;
			return void this.saveAsCodeWorkspaceFile(workspaceId);
		}

		let openLocation: OpenWorkspaceLocation = options?.location === 'currentWindow' ? 'currentWindow' : 'newWindow';
		if (!options?.location) {
			const openLocationChoice = await window.showInformationMessage(
				`您希望如何打开 ${workspace.name} 的工作区文件？`,
				{ modal: true },
				{ title: '在新窗口中打开', location: 'newWindow' as const },
				{ title: '在当前窗口中打开', location: 'currentWindow' as const },
				{ title: '取消', isCloseAffordance: true },
			);

			if (openLocationChoice == null || openLocationChoice.title === '取消') return;
			openLocation = openLocationChoice.location ?? 'newWindow';
		}

		if (!(await this._sharedStorage?.confirmCloudWorkspaceCodeWorkspaceFilePath(workspace.id))) {
			await this._sharedStorage?.removeCloudWorkspaceCodeWorkspaceFile(workspace.id);
			workspace.setLocalPath(undefined);
			const locateChoice = await window.showInformationMessage(
				`找不到 ${workspace.name} 的工作区文件。是否现在定位？`,
				{ modal: true },
				{ title: '定位' },
				{ title: '取消', isCloseAffordance: true },
			);

			if (locateChoice?.title !== '定位') return;
			const newPath = (
				await window.showOpenDialog({
					defaultUri: Uri.file(workspace.localPath),
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					filters: {
						代码工作区: ['code-workspace'],
					},
					title: '定位工作区文件',
				})
			)?.[0]?.fsPath;

			if (newPath == null) return;

			await this._sharedStorage?.storeCloudWorkspaceCodeWorkspaceFileLocation(workspace.id, newPath);
			workspace.setLocalPath(newPath);
		}

		openWorkspace(Uri.file(workspace.localPath), { location: openLocation });
	}

	private async getMappedPathForCloudWorkspaceRepoDescriptor(
		descriptor: CloudWorkspaceRepositoryDescriptor,
	): Promise<string | undefined> {
		let repoLocalPath = await this.getCloudWorkspaceRepoPath(descriptor.workspaceId, descriptor.id);
		repoLocalPath ??= (
			await this._repositoryLocator?.getLocation(descriptor.url ?? undefined, {
				repoName: descriptor.name,
				provider: descriptor.provider ?? undefined,
				owner: descriptor.provider_organization_id,
			})
		)?.[0];

		return repoLocalPath;
	}
}

async function getRemoteDescriptor(remote: GitRemote): Promise<RemoteDescriptor | undefined> {
	if (remote.provider?.owner == null) return undefined;

	const remoteRepoName = remote.provider.path.split('/').pop();
	if (remoteRepoName == null) return undefined;
	return {
		provider: remote.provider.id.toLowerCase(),
		owner: remote.provider.owner.toLowerCase(),
		repoName: remoteRepoName.toLowerCase(),
		url: await getRemoteProviderUrl(remote.provider, { type: RemoteResourceType.Repo }),
	};
}

function getCurrentWorkspaceId(): string | undefined {
	return workspace.getConfiguration('gitkraken')?.get<string>('workspaceId');
}

export function scheduleAddMissingCurrentWorkspaceRepos(container: Container): void {
	const currentWorkspaceId = getCurrentWorkspaceId();
	if (currentWorkspaceId == null) return;

	setTimeout(() => container.workspaces.addMissingCurrentWorkspaceRepos(), 10000);
}

// TODO: Add back in once we think through virtual repository support a bit more.
/* function encodeAuthority<T>(scheme: string, metadata?: T): string {
	return `${scheme}${metadata != null ? `+${encodeUtf8Hex(JSON.stringify(metadata))}` : ''}`;
} */
