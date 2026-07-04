/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars */

import type { IssueOrPullRequest } from '@gitlens/git/models/issueOrPullRequest.js';
import type { Issue } from '@gitlens/git/models/issue.js';
import type { CommitAuthor } from '@gitlens/git/models/author.js';
import type { RemoteProviderId } from '@gitlens/git/models/remoteProvider.js';
import type { RepositoryMetadata } from '@gitlens/git/models/repositoryMetadata.js';
import type { ResourceDescriptor } from '@gitlens/git/models/resourceDescriptor.js';
import type { SearchQuery } from '@gitlens/git/models/search.js';
import type {
	CloudGitSelfManagedHostIntegrationIds,
	IntegrationIds,
	IssuesCloudHostIntegrationId,
} from '../../constants.integrations.js';
import type { GlRepository } from '../../git/models/repository.js';
import { IpcRequest } from '../../webviews/ipc/models/ipc.js';

// MIT replacement for removed commercial modules. It keeps community build paths inert.
type ProStubAny = any;
type DisposableLike = { dispose(): void };
type EventLike<T> = (listener: (e: T) => void, thisArgs?: unknown) => DisposableLike;

const emptyDisposable: DisposableLike = Object.freeze({ dispose: () => {} });

class SimpleEmitter<T> {
	private readonly listeners = new Set<(e: T) => void>();

	readonly event: EventLike<T> = (listener, thisArgs) => {
		const bound = thisArgs == null ? listener : listener.bind(thisArgs);
		this.listeners.add(bound);
		return { dispose: () => void this.listeners.delete(bound) };
	};

	fire(e: T): void {
		for (const listener of this.listeners) {
			listener(e);
		}
	}
}

const proStubTarget = function proStubTarget() {
	return undefined;
};

export const proStub = new Proxy(proStubTarget, {
	apply: () => undefined,
	construct: () => ({}),
	get: (_target, property) => {
		if (property === Symbol.toPrimitive) return () => '';
		if (property === 'then') return undefined;
		return proStub;
	},
}) as ProStubAny;

export type CommunityPlan = {
	id: 'community';
	actual: { id: 'community' };
	effective: { id: 'community' };
};

export type SubscriptionAccount = {
	id?: string;
	email?: string;
	name?: string;
	verified?: boolean;
	[key: string]: unknown;
};

export type Subscription = {
	account?: SubscriptionAccount;
	plan: CommunityPlan;
	state: 0;
	[key: string]: unknown;
};

const communitySubscription: Subscription = {
	plan: { id: 'community', actual: { id: 'community' }, effective: { id: 'community' } },
	state: 0,
};

export type SubscriptionChangeEvent = {
	current: Subscription;
	previous: Subscription;
	etag: number;
};

export type ConfiguredIntegrationDescriptor = {
	integrationId: IntegrationIds;
	domain?: string;
	[key: string]: unknown;
};

export type ConfiguredIntegrationsChangeEvent = {
	added: ConfiguredIntegrationDescriptor[];
	configured: ConfiguredIntegrationDescriptor[];
	removed: ConfiguredIntegrationDescriptor[];
	etag: number;
};

export type ConnectionStateChangeEvent = {
	reason?: 'connected' | 'disconnected';
	integrationId?: string;
	[key: string]: unknown;
};

export class IntegrationBase {
	readonly id: IntegrationIds = 'github' as IntegrationIds;
	readonly name = 'Community';
	readonly domain = '';
	readonly icon = '';
	readonly etag = 0;
	readonly sessionFingerprint = 'community';
	readonly maybeConnected: boolean | undefined = false;

	autolinks(): never[] {
		return [];
	}

	isConnected(): Promise<boolean> {
		return Promise.resolve(false);
	}

	access(): Promise<boolean> {
		return Promise.resolve(false);
	}

	connect(..._args: unknown[]): Promise<boolean> {
		return Promise.resolve(false);
	}

	disconnect(..._args: unknown[]): Promise<void> {
		return Promise.resolve();
	}

	getAccountForCommit(..._args: unknown[]): Promise<CommitAuthor | undefined> {
		return Promise.resolve(undefined);
	}

	getDefaultBranch(..._args: unknown[]): Promise<{ name: string } | undefined> {
		return Promise.resolve(undefined);
	}

	getLinkedIssueOrPullRequest(
		_descriptor: ResourceDescriptor,
		_id: unknown,
		_options?: unknown,
	): Promise<IssueOrPullRequest | undefined> {
		return Promise.resolve(undefined);
	}

	getPullRequestForBranch(..._args: unknown[]): Promise<undefined> {
		return Promise.resolve(undefined);
	}

	getPullRequestForCommit(..._args: unknown[]): Promise<undefined> {
		return Promise.resolve(undefined);
	}

	getRepositoryMetadata(..._args: unknown[]): Promise<RepositoryMetadata | undefined> {
		return Promise.resolve(undefined);
	}
}

export class GitHostIntegration extends IntegrationBase {
	getRepoInfo(_target: unknown): Promise<{ id: string } | undefined> {
		return Promise.resolve(undefined);
	}
}

export class IssuesIntegration extends IntegrationBase {}

export type Integration = GitHostIntegration | IssuesIntegration;

export class ServerConnection {
	constructor(..._args: unknown[]) {
		void _args;
	}

	dispose(): void {}
}

export class UrlsProvider {
	constructor(..._args: unknown[]) {
		void _args;
	}

	dispose(): void {}
}

export class AccountAuthenticationProvider {
	constructor(..._args: unknown[]) {
		void _args;
	}

	dispose(): void {}
}

export class SubscriptionService {
	private readonly emitter = new SimpleEmitter<SubscriptionChangeEvent>();
	etag = 0;
	readonly onDidChange = this.emitter.event;

	constructor(..._args: unknown[]) {
		void _args;
	}

	getSubscription(_force?: boolean): Promise<Subscription> {
		return Promise.resolve(communitySubscription);
	}

	loginOrSignUp(..._args: unknown[]): Promise<boolean | undefined> {
		return Promise.resolve(undefined);
	}

	resendVerification(..._args: unknown[]): Promise<boolean | undefined> {
		return Promise.resolve(undefined);
	}

	upgrade(..._args: unknown[]): Promise<boolean | undefined> {
		return Promise.resolve(undefined);
	}

	dispose(): void {}
}

export class OrganizationService {
	constructor(..._args: unknown[]) {
		void _args;
	}

	getOrganizations(): Promise<unknown[]> {
		return Promise.resolve([]);
	}

	getMemberById(..._args: unknown[]): Promise<{ email?: string } | undefined> {
		return Promise.resolve(undefined);
	}

	dispose(): void {}
}

export class ConfiguredIntegrationService {
	constructor(..._args: unknown[]) {
		void _args;
	}

	dispose(): void {}
}

export class IntegrationAuthenticationService {
	constructor(..._args: unknown[]) {
		void _args;
	}

	dispose(): void {}
}

export class IntegrationService {
	private readonly changeEmitter = new SimpleEmitter<ConfiguredIntegrationsChangeEvent>();
	private readonly connectionEmitter = new SimpleEmitter<ConnectionStateChangeEvent>();
	readonly onDidChange = this.changeEmitter.event;
	readonly onDidChangeConnectionState = this.connectionEmitter.event;

	constructor(..._args: unknown[]) {
		void _args;
	}

	getConfigured(): Promise<ConfiguredIntegrationDescriptor[]> {
		return Promise.resolve([]);
	}

	getConfiguredLite(..._args: unknown[]): ConfiguredIntegrationDescriptor[] {
		return [];
	}

	get(..._args: unknown[]): Promise<GitHostIntegration | undefined> {
		return Promise.resolve(undefined);
	}

	connectCloudIntegrations(..._args: unknown[]): Promise<boolean> {
		return Promise.resolve(false);
	}

	reset(): Promise<void> {
		return Promise.resolve();
	}

	dispose(): void {}
}

export class AIProviderService {
	readonly enabled = false;
	readonly allowed = false;
	readonly actions = {
		generateCreatePullRequest: (
			..._args: unknown[]
		): Promise<'cancelled' | { result: { summary: string; body: string } } | undefined> =>
			Promise.resolve(undefined),
		generateStashMessage: (
			..._args: unknown[]
		): Promise<'cancelled' | { result: { summary: string } } | undefined> => Promise.resolve(undefined),
	};

	constructor(..._args: unknown[]) {
		void _args;
	}

	getProvidersConfiguration(): Promise<Map<AIProviders, AIProviderDescriptorWithConfiguration>> {
		return Promise.resolve(new Map());
	}

	getModel(..._args: unknown[]): Promise<AIModelDescriptor | undefined> {
		return Promise.resolve(undefined);
	}

	getModels(..._args: unknown[]): Promise<AIModel[]> {
		return Promise.resolve([]);
	}

	resetProviderKey(..._args: unknown[]): void {}

	reset(_silent?: boolean): Promise<void> {
		return Promise.resolve();
	}

	resetConfirmations(): void {}

	dispose(): void {}
}

export class DraftService {
	constructor(..._args: unknown[]) {
		void _args;
	}

	createDraft(..._args: unknown[]): Promise<Draft> {
		return Promise.resolve({
			author: {},
			deepLinkUrl: '',
		});
	}

	getCodeSuggestions(..._args: unknown[]): Promise<Draft[]> {
		return Promise.resolve([]);
	}

	dispose(): void {}
}

export class EnrichmentService {
	constructor(..._args: unknown[]) {
		void _args;
	}

	dispose(): void {}
}

export class LaunchpadProvider {
	constructor(..._args: unknown[]) {
		void _args;
	}

	getCategorizedItems(..._args: unknown[]): Promise<LaunchpadCategorizedResult> {
		return Promise.resolve({ items: [] });
	}

	dispose(): void {}
}

export class ProductConfigProvider {
	constructor(..._args: unknown[]) {
		void _args;
	}

	getApplicablePromo(..._args: unknown[]): Promise<{ content?: { quickpick?: { detail?: string } } } | undefined> {
		return Promise.resolve(undefined);
	}
}

export class RepositoryIdentityService {
	constructor(..._args: unknown[]) {
		void _args;
	}

	storeRepositoryLocations(..._args: unknown[]): Promise<void> {
		return Promise.resolve();
	}

	getRepository(..._args: unknown[]): Promise<GlRepository | undefined> {
		return Promise.resolve(undefined);
	}

	dispose(): void {}
}

export class WorkspacesApi {
	constructor(..._args: unknown[]) {
		void _args;
	}

	dispose(): void {}
}

export class WorkspacesService {
	constructor(..._args: unknown[]) {
		void _args;
	}

	dispose(): void {}
}

export class CloudIntegrationService {
	constructor(..._args: unknown[]) {
		void _args;
	}

	dispose(): void {}
}

export class AzureDevOpsApi {
	constructor(..._args: unknown[]) {
		void _args;
	}

	dispose(): void {}
}

export class BitbucketApi {
	constructor(..._args: unknown[]) {
		void _args;
	}

	dispose(): void {}
}

export class GitHubApi {
	dispose(): void {}
}

export class GitLabApi {
	constructor(..._args: unknown[]) {
		void _args;
	}

	dispose(): void {}
}

export const createGitHubApi = (): GitHubApi => new GitHubApi();

export function isSubscriptionPaidPlan(_plan: unknown): boolean {
	return false;
}

export function isSubscriptionPaid(_subscription: unknown): boolean {
	return false;
}

export function isSubscriptionTrial(_subscription: unknown): boolean {
	return false;
}

export function isSubscriptionTrialOrPaidFromState(_state: unknown): boolean {
	return false;
}

export function isGitHostIntegration(integration: Integration | undefined): integration is GitHostIntegration {
	return integration instanceof GitHostIntegration;
}

export const providersMetadata: Record<string, { name: string; iconKey: string; type: 'git' | 'issues' }> = new Proxy(
	{},
	{
		get: (_target, property) => ({
			name: String(property),
			iconKey: String(property),
			type: 'git',
		}),
	},
) as Record<string, { name: string; iconKey: string; type: 'git' | 'issues' }>;

export function convertRemoteProviderIdToIntegrationId(
	_providerId: RemoteProviderId | string,
): IntegrationIds | undefined {
	return undefined;
}

export function getIntegrationConnectedKey(id: IntegrationIds, domain?: string): `integration:connected:${string}` {
	return `integration:connected:${domain == null ? id : `${id}:${domain}`}`;
}

export function getIntegrationIdForRemote(_provider: unknown): IntegrationIds | undefined {
	return undefined;
}

export function isCloudGitSelfManagedHostIntegrationId(
	_id: IntegrationIds | string | undefined,
): _id is CloudGitSelfManagedHostIntegrationIds {
	return false;
}

export function isIssueCloudIntegrationId(_id: unknown): _id is IssuesCloudHostIntegrationId {
	return false;
}

export function ensureAccess(..._args: unknown[]): Promise<boolean> {
	return Promise.resolve(false);
}

export function ensureAccount(..._args: unknown[]): Promise<boolean> {
	return Promise.resolve(false);
}

export function ensurePaidPlan(..._args: unknown[]): Promise<boolean> {
	return Promise.resolve(false);
}

export function supportsCodeSuggest(..._args: unknown[]): boolean {
	return false;
}

export function getEntityIdentifierInput(..._args: unknown[]): undefined {
	return undefined;
}

export function showPatchesView(..._args: unknown[]): void {}

export function confirmDraftStorage(..._args: unknown[]): Promise<boolean> {
	return Promise.resolve(false);
}

export function getSubscriptionNextPaidPlanId(_subscription: Subscription): string | undefined {
	return undefined;
}

export function getLaunchpadItemGroups(_item: LaunchpadItem): LaunchpadGroup[] {
	return [];
}

export const launchpadCategoryToGroupMap = new Map<string, LaunchpadGroup>();
export const sharedCategoryToLaunchpadActionCategoryMap = new Map<string, string>();

export const ChooseAuthorRequest = new IpcRequest<
	{ picked?: string[]; placeholder?: string; title?: string },
	{ authors?: string[] }
>('home', 'chooseAuthor');
export const ChooseComparisonRequest = new IpcRequest<{ placeholder?: string; title?: string }, { range?: string }>(
	'home',
	'chooseComparison',
);
export const ChooseFileRequest = new IpcRequest<
	{ openLabel?: string; picked?: string[]; title?: string; type?: 'file' | 'folder' },
	{ files?: string[] }
>('home', 'chooseFile');
export const ChooseRefRequest = new IpcRequest<
	{
		allowedAdditionalInput?: { range?: boolean; rev?: boolean };
		include?: string[];
		picked?: string;
		placeholder?: string;
		title?: string;
	},
	{ name?: string }
>('home', 'chooseRef');
export const SearchHistoryDeleteRequest = new IpcRequest<
	{ query: string; repoPath?: string },
	{ history: SearchQuery[] }
>('home', 'searchHistory/delete');
export const SearchHistoryGetRequest = new IpcRequest<{ repoPath?: string }, { history: SearchQuery[] }>(
	'home',
	'searchHistory/get',
);
export const SearchHistoryStoreRequest = new IpcRequest<
	{ repoPath?: string; search: SearchQuery },
	{ history: SearchQuery[] }
>('home', 'searchHistory/store');

export const activeOverviewStateContext: ProStubAny = proStub;
export type activeOverviewStateContext<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const activityDecayToMs: ProStubAny = proStub;
export type activityDecayToMs<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AgentDescriptor: ProStubAny = proStub;
export type AgentDescriptor = { id: string; label: string; kind?: string; [key: string]: unknown };
export const agentOverviewStateContext: ProStubAny = proStub;
export type agentOverviewStateContext<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AgentProviderCallbacks: ProStubAny = proStub;
export type AgentProviderCallbacks<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AgentRoute: ProStubAny = proStub;
export type AgentRoute = string;
export const AgentSession: ProStubAny = proStub;
export type AgentSession<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AgentSessionPhase: ProStubAny = proStub;
export type AgentSessionPhase<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AgentSessionProvider: ProStubAny = proStub;
export type AgentSessionProvider<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AgentSessionStatus: ProStubAny = proStub;
export type AgentSessionStatus<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AIActionType: ProStubAny = proStub;
export type AIActionType = string;
export const AiAllAccessOptInPathPrefix: ProStubAny = proStub;
export type AiAllAccessOptInPathPrefix<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AIError: ProStubAny = proStub;
export type AIError<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AIErrorReason: ProStubAny = proStub;
export type AIErrorReason<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AIExplainSourceContext: ProStubAny = proStub;
export type AIExplainSourceContext<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AIGenerateChangelogChange: ProStubAny = proStub;
export type AIGenerateChangelogChange<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AIGenerateChangelogChanges: ProStubAny = proStub;
export type AIGenerateChangelogChanges<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AIModel: ProStubAny = proStub;
export type AIModel = {
	id: string;
	name: string;
	provider: { id: AIProviders };
	default?: boolean;
	hidden?: boolean;
	[key: string]: unknown;
};
export const AIModelDescriptor: ProStubAny = proStub;
export type AIModelDescriptor = { provider: AIProviders; model: string; name?: string; [key: string]: unknown };
export const AIModelScope: ProStubAny = proStub;
export type AIModelScope = string;
export const AINoRequestDataError: ProStubAny = proStub;
export type AINoRequestDataError<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AIProviderAndModel: ProStubAny = proStub;
export type AIProviderAndModel = { provider: AIProviders; model: string; [key: string]: unknown };
export const AIProviderDescriptorWithConfiguration: ProStubAny = proStub;
export type AIProviderDescriptorWithConfiguration = {
	id: AIProviders;
	name: string;
	configured?: boolean;
	primary?: boolean;
	models?: unknown[];
	[key: string]: unknown;
};
export const AIProviders: ProStubAny = proStub;
export type AIProviders = string;
export const AIResponse: ProStubAny = proStub;
export type AIResponse<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AIResultContext: ProStubAny = proStub;
export type AIResultContext<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AppState: ProStubAny = proStub;
export type AppState<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const arePlusFeaturesEnabled: ProStubAny = proStub;
export type arePlusFeaturesEnabled<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AssociateIssueWithBranchCommand: ProStubAny = proStub;
export type AssociateIssueWithBranchCommand<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const AssociateIssueWithBranchCommandArgs: ProStubAny = proStub;
export type AssociateIssueWithBranchCommandArgs<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const AuthenticationRequiredError: ProStubAny = proStub;
export type AuthenticationRequiredError<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AuthenticationUriPathPrefix: ProStubAny = proStub;
export type AuthenticationUriPathPrefix<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const Change: ProStubAny = proStub;
export type Change = {
	repository: GlRepository | { name?: string; path: string; uri: string };
	checked?: boolean | 'staged';
	files?: { staged?: boolean; [key: string]: unknown }[] | unknown[];
	[key: string]: unknown;
};
export const changeBranchMergeTarget: ProStubAny = proStub;
export type changeBranchMergeTarget<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const ChatActions: ProStubAny = proStub;
export type ChatActions<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const ChatMode: ProStubAny = proStub;
export type ChatMode<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const chipStateSuffix: ProStubAny = proStub;
export type chipStateSuffix<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const classifyNetworkError: ProStubAny = proStub;
export type classifyNetworkError<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const claudeCodeBlockingHookEvents: ProStubAny = proStub;
export type claudeCodeBlockingHookEvents<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const ClaudeCodeHookEvent: ProStubAny = proStub;
export type ClaudeCodeHookEvent<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const claudeCodeNonBlockingHookEvents: ProStubAny = proStub;
export type claudeCodeNonBlockingHookEvents<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const ClaudeCodeProvider: ProStubAny = proStub;
export type ClaudeCodeProvider<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const CloudIntegrationAuthenticationUriPathPrefix: ProStubAny = proStub;
export type CloudIntegrationAuthenticationUriPathPrefix<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const CloudWorkspace: ProStubAny = proStub;
export type CloudWorkspace<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const CloudWorkspaceRepositoryDescriptor: ProStubAny = proStub;
export type CloudWorkspaceRepositoryDescriptor<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const CloudWorkspacesPathMap: ProStubAny = proStub;
export type CloudWorkspacesPathMap<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const CodeWorkspaceFileContents: ProStubAny = proStub;
export type CodeWorkspaceFileContents<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const CommitFrequencyData: ProStubAny = proStub;
export type CommitFrequencyData<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const ComposerCommandArgs: ProStubAny = proStub;
export type ComposerCommandArgs<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const ComposerComposeIntegration: ProStubAny = proStub;
export type ComposerComposeIntegration<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const ComposerWebviewShowingArgs: ProStubAny = proStub;
export type ComposerWebviewShowingArgs<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const ConflictToolsIntegration: ProStubAny = proStub;
export type ConflictToolsIntegration<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const CreateDraft: ProStubAny = proStub;
export type CreateDraft<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const CreateDraftChange: ProStubAny = proStub;
export type CreateDraftChange = {
	repository: GlRepository;
	revision: { to: string; from: string };
	prEntityId?: string;
};
export function decodeEntityIdentifiersFromGitConfig(encoded: string): GitConfigEntityIdentifier[] {
	const parsed = JSON.parse(encoded) as unknown;
	return Array.isArray(parsed) ? (parsed as GitConfigEntityIdentifier[]) : [];
}
export const deleteBranchOrWorktree: ProStubAny = proStub;
export type deleteBranchOrWorktree<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const DidChangeNotification: ProStubAny = proStub;
export type DidChangeNotification<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const DidChangeSubscriptionNotification: ProStubAny = proStub;
export type DidChangeSubscriptionNotification<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const Draft: ProStubAny = proStub;
export type Draft = {
	id?: string;
	title?: string;
	updatedAt?: string | number | Date;
	visibility?: string;
	author?: { id?: string; email?: string; name?: string; avatarUri?: string };
	deepLinkUrl?: string;
	organizationId?: string;
	[key: string]: unknown;
};
export const DraftPatchFileChange: ProStubAny = proStub;
export type DraftPatchFileChange<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const DraftUserSelection: ProStubAny = proStub;
export type DraftUserSelection = Record<string, unknown>;
export const DraftVisibility: ProStubAny = proStub;
export type DraftVisibility = string;
export function encodeIssueOrPullRequestForGitConfig(
	issue: IssueOrPullRequest,
	_owner: ResourceDescriptor,
): GitConfigEntityIdentifier {
	return {
		entityId: issue.nodeId,
	};
}
export const ensurePlusFeaturesEnabled: ProStubAny = proStub;
export type ensurePlusFeaturesEnabled<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const executeChatAction: ProStubAny = proStub;
export type executeChatAction<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const extractAIResultContext: ProStubAny = proStub;
export type extractAIResultContext<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const getAIResultContext: ProStubAny = proStub;
export type getAIResultContext<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export function getIssueFromGitConfigEntityIdentifier(
	_container: unknown,
	_identifier: GitConfigEntityIdentifier,
	_options?: unknown,
): Promise<Issue | undefined> {
	return Promise.resolve(undefined);
}
export const getIssueOwner: ProStubAny = proStub;
export type getIssueOwner<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const getLaunchpadSummary: ProStubAny = proStub;
export type getLaunchpadSummary<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const getPhaseForStatus: ProStubAny = proStub;
export type getPhaseForStatus<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const getProviderIdFromEntityIdentifier: ProStubAny = proStub;
export type getProviderIdFromEntityIdentifier<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const getPullRequestBranchDeepLink: ProStubAny = proStub;
export type getPullRequestBranchDeepLink<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const getSubscriptionProductPlanName: ProStubAny = proStub;
export type getSubscriptionProductPlanName<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const getSubscriptionTimeRemaining: ProStubAny = proStub;
export type getSubscriptionTimeRemaining<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const GitConfigEntityIdentifier: ProStubAny = proStub;
export type GitConfigEntityIdentifier = {
	entityId?: string;
	[key: string]: unknown;
};
export const GitHubAuthorityMetadata: ProStubAny = proStub;
export type GitHubAuthorityMetadata<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const GitHubGitProvider: ProStubAny = proStub;
export type GitHubGitProvider<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const GkWorkspacesSharedStorageProvider: ProStubAny = proStub;
export type GkWorkspacesSharedStorageProvider<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const GlGitHubGitProvider: ProStubAny = proStub;
export type GlGitHubGitProvider<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const GlHomeHeader: ProStubAny = proStub;
export type GlHomeHeader<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const GraphBranchContextValue: ProStubAny = proStub;
export type GraphBranchContextValue<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const GraphColumnConfig: ProStubAny = proStub;
export type GraphColumnConfig = { width?: number; isHidden?: boolean; mode?: string };
export const GraphCommitContextValue: ProStubAny = proStub;
export type GraphCommitContextValue<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const GraphComposeIntegration: ProStubAny = proStub;
export type GraphComposeIntegration<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const GraphDisplayMode: ProStubAny = proStub;
export type GraphDisplayMode = string;
export const GraphItemRefContext: ProStubAny = proStub;
export type GraphItemRefContext<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const GraphItemRefGroupContext: ProStubAny = proStub;
export type GraphItemRefGroupContext<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const GraphSidebarPanel: ProStubAny = proStub;
export type GraphSidebarPanel = string;
export const GraphStashContextValue: ProStubAny = proStub;
export type GraphStashContextValue<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const GraphStatusBarController: ProStubAny = proStub;
export type GraphStatusBarController<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const GraphTagContextValue: ProStubAny = proStub;
export type GraphTagContextValue<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const GraphTreemapMode: ProStubAny = proStub;
export type GraphTreemapMode = string;
export const GraphWebviewShowingArgs: ProStubAny = proStub;
export type GraphWebviewShowingArgs<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const groupAndSortLaunchpadItems: ProStubAny = proStub;
export type groupAndSortLaunchpadItems<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const inactiveOverviewStateContext: ProStubAny = proStub;
export type inactiveOverviewStateContext<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const IntegrationConnectedKey: ProStubAny = proStub;
export type IntegrationConnectedKey = `integration:connected:${string}`;
export const isActiveAgentPhase: ProStubAny = proStub;
export type isActiveAgentPhase<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const isAgentDescriptor: ProStubAny = proStub;
export type isAgentDescriptor<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const LaunchpadCategorizedResult: ProStubAny = proStub;
export type LaunchpadCategorizedResult = { items?: LaunchpadItem[] };
export const LaunchpadCommand: ProStubAny = proStub;
export type LaunchpadCommand<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const LaunchpadCommandArgs: ProStubAny = proStub;
export type LaunchpadCommandArgs<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const LaunchpadGroup: ProStubAny = proStub;
export type LaunchpadGroup = string;
export const launchpadGroupIconMap: ProStubAny = proStub;
export type launchpadGroupIconMap<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const launchpadGroupLabelMap: ProStubAny = proStub;
export type launchpadGroupLabelMap<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const LaunchpadIndicator: ProStubAny = proStub;
export type LaunchpadIndicator<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const LaunchpadItem: ProStubAny = proStub;
export type LaunchpadItem = {
	url?: string;
	uuid: string;
	type: string;
	actionableCategory: string;
	suggestedActionCategory: string;
	suggestedActions: unknown[];
	failingCI: boolean;
	hasConflicts: boolean;
	reviewDecision?: unknown;
	reviews?: unknown[];
	approvalReviewCount: number;
	changeRequestReviewCount: number;
	commentReviewCount: number;
	codeSuggestionsCount: number;
	author?: unknown;
	createdDate?: unknown;
	viewer: Record<string, unknown>;
	[key: string]: unknown;
};
export const LaunchpadSummaryResult: ProStubAny = proStub;
export type LaunchpadSummaryResult<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const linkStyles: ProStubAny = proStub;
export type linkStyles<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const LocalDraft: ProStubAny = proStub;
export type LocalDraft<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const LocalWorkspace: ProStubAny = proStub;
export type LocalWorkspace<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const LocalWorkspaceFileData: ProStubAny = proStub;
export type LocalWorkspaceFileData<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const LocalWorkspaceRepositoryDescriptor: ProStubAny = proStub;
export type LocalWorkspaceRepositoryDescriptor<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const LoginUriPathPrefix: ProStubAny = proStub;
export type LoginUriPathPrefix<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const mcpRegistrationAllowed: ProStubAny = proStub;
export type mcpRegistrationAllowed<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const mcpRegistrationEnabled: ProStubAny = proStub;
export type mcpRegistrationEnabled<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const mergeIntoCurrent: ProStubAny = proStub;
export type mergeIntoCurrent<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const NaturalLanguageSearchOptions: ProStubAny = proStub;
export type NaturalLanguageSearchOptions<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const NaturalLanguageSearchProcessor: ProStubAny = proStub;
export type NaturalLanguageSearchProcessor<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const needsCursorMcpCleanupNotice: ProStubAny = proStub;
export type needsCursorMcpCleanupNotice<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const openChat: ProStubAny = proStub;
export type openChat<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const openMergeTargetComparison: ProStubAny = proStub;
export type openMergeTargetComparison<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const OrgAIProviders: ProStubAny = proStub;
export type OrgAIProviders = Record<string, boolean>;
export const OrganizationMember: ProStubAny = proStub;
export type OrganizationMember<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const OrganizationRole: ProStubAny = proStub;
export type OrganizationRole = string;
export const OrganizationSettings: ProStubAny = proStub;
export type OrganizationSettings = Record<string, unknown>;
export const PaidSubscriptionPlanIds: ProStubAny = proStub;
export type PaidSubscriptionPlanIds = string;
export const PendingPermission: ProStubAny = proStub;
export type PendingPermission<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const PendingPermissionKind: ProStubAny = proStub;
export type PendingPermissionKind<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const PermissionDecision: ProStubAny = proStub;
export type PermissionDecision<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const PermissionSuggestion: ProStubAny = proStub;
export type PermissionSuggestion<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const pickAgentStandalone: ProStubAny = proStub;
export type pickAgentStandalone<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const prepareCompareDataForAIRequest: ProStubAny = proStub;
export type prepareCompareDataForAIRequest<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const Promo: ProStubAny = proStub;
export type Promo<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const PromoKeys: ProStubAny = proStub;
export type PromoKeys = string;
export const PromoLocation: ProStubAny = proStub;
export type PromoLocation<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const PromoPlans: ProStubAny = proStub;
export type PromoPlans<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const ProviderAuth: ProStubAny = proStub;
export type ProviderAuth<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const pushBranch: ProStubAny = proStub;
export type pushBranch<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const rebaseCurrentOnto: ProStubAny = proStub;
export type rebaseCurrentOnto<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const registerComposerWebviewCommands: ProStubAny = proStub;
export type registerComposerWebviewCommands<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const registerComposerWebviewPanel: ProStubAny = proStub;
export type registerComposerWebviewPanel<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const registerGraphWebviewCommands: ProStubAny = proStub;
export type registerGraphWebviewCommands<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const registerGraphWebviewPanel: ProStubAny = proStub;
export type registerGraphWebviewPanel<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const registerGraphWebviewView: ProStubAny = proStub;
export type registerGraphWebviewView<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const registerPatchDetailsWebviewPanel: ProStubAny = proStub;
export type registerPatchDetailsWebviewPanel<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const registerPatchDetailsWebviewView: ProStubAny = proStub;
export type registerPatchDetailsWebviewView<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const registerTimelineWebviewCommands: ProStubAny = proStub;
export type registerTimelineWebviewCommands<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const registerTimelineWebviewPanel: ProStubAny = proStub;
export type registerTimelineWebviewPanel<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const registerTimelineWebviewView: ProStubAny = proStub;
export type registerTimelineWebviewView<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const RequiredSubscriptionPlanIds: ProStubAny = proStub;
export type RequiredSubscriptionPlanIds = string;
export const resolveDefaultAgent: ProStubAny = proStub;
export type resolveDefaultAgent<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const ruleStyles: ProStubAny = proStub;
export type ruleStyles<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const runAgent: ProStubAny = proStub;
export type runAgent<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const RunningOperationExecState: ProStubAny = proStub;
export type RunningOperationExecState<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const scheduleAddMissingCurrentWorkspaceRepos: ProStubAny = proStub;
export type scheduleAddMissingCurrentWorkspaceRepos<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const sendFeedbackEvent: ProStubAny = proStub;
export type sendFeedbackEvent<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const SharedGkStorageLocationProvider: ProStubAny = proStub;
export type SharedGkStorageLocationProvider<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const ShowInCommitGraphCommandArgs: ProStubAny = proStub;
export type ShowInCommitGraphCommandArgs<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const showUnhelpfulFeedbackPicker: ProStubAny = proStub;
export type showUnhelpfulFeedbackPicker<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const StartReviewChatAction: ProStubAny = proStub;
export type StartReviewChatAction<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const StartReviewCommand: ProStubAny = proStub;
export type StartReviewCommand<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const StartReviewCommandArgs: ProStubAny = proStub;
export type StartReviewCommandArgs<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const StartWorkChatAction: ProStubAny = proStub;
export type StartWorkChatAction<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const StartWorkCommand: ProStubAny = proStub;
export type StartWorkCommand<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const StartWorkCommandArgs: ProStubAny = proStub;
export type StartWorkCommandArgs<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const statusIconFor: ProStubAny = proStub;
export type statusIconFor<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const storeChatActionDeepLink: ProStubAny = proStub;
export type storeChatActionDeepLink<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const SubscriptionPlanIds: ProStubAny = proStub;
export type SubscriptionPlanIds = 'community' | string;
export const SubscriptionStateString: ProStubAny = proStub;
export type SubscriptionStateString = string;
export const SubscriptionUpdatedUriPathPrefix: ProStubAny = proStub;
export type SubscriptionUpdatedUriPathPrefix<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const SubscriptionUpgradeCommandArgs: ProStubAny = proStub;
export type SubscriptionUpgradeCommandArgs<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const SupportedAIModels: ProStubAny = proStub;
export type SupportedAIModels = AIProviderAndModel;
export const supportsCursorMcpRegistration: ProStubAny = proStub;
export type supportsCursorMcpRegistration<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const supportsMcpExtensionRegistration: ProStubAny = proStub;
export type supportsMcpExtensionRegistration<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const TimelineCommandArgs: ProStubAny = proStub;
export type TimelineCommandArgs<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const TimelinePeriod: ProStubAny = proStub;
export type TimelinePeriod = string;
export const TimelineScopeType: ProStubAny = proStub;
export type TimelineScopeType = string;
export const TimelineSliceBy: ProStubAny = proStub;
export type TimelineSliceBy = string;
export const TreemapConfig: ProStubAny = proStub;
export type TreemapConfig<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const TreemapData: ProStubAny = proStub;
export type TreemapData<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const TreemapMode: ProStubAny = proStub;
export type TreemapMode<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const TreemapNode: ProStubAny = proStub;
export type TreemapNode<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const UnhelpfulResult: ProStubAny = proStub;
export type UnhelpfulResult<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const VisualizationMode: ProStubAny = proStub;
export type VisualizationMode = string;
export const WorkspaceAutoAddSetting: ProStubAny = proStub;
export type WorkspaceAutoAddSetting<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;

export type SimulationState = ProStubAny;
