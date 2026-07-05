/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars */

import type { IssueOrPullRequest } from '@gitlens/git/models/issueOrPullRequest.js';
import type { Issue } from '@gitlens/git/models/issue.js';
import type { CommitAuthor } from '@gitlens/git/models/author.js';
import type { RemoteProviderId } from '@gitlens/git/models/remoteProvider.js';
import type { RepositoryMetadata } from '@gitlens/git/models/repositoryMetadata.js';
import type { ResourceDescriptor } from '@gitlens/git/models/resourceDescriptor.js';
import type {
	CloudGitSelfManagedHostIntegrationIds,
	IntegrationIds,
	IssuesCloudHostIntegrationId,
} from '../../constants.integrations.js';
import type { GlRepository } from '../../git/models/repository.js';

// MIT replacement for removed commercial modules. It keeps community build paths inert.
type ProStubAny = any;
type DisposableLike = { dispose(): void };
type EventLike<T> = (listener: (e: T) => void, thisArgs?: unknown) => DisposableLike;

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

export const communitySubscription: Subscription = {
	plan: { id: 'community', actual: { id: 'community' }, effective: { id: 'community' } },
	state: 0,
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

export function decodeEntityIdentifiersFromGitConfig(encoded: string): GitConfigEntityIdentifier[] {
	const parsed = JSON.parse(encoded) as unknown;
	return Array.isArray(parsed) ? (parsed as GitConfigEntityIdentifier[]) : [];
}

export const DidChangeNotification: ProStubAny = proStub;
export type DidChangeNotification<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
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
export function encodeIssueOrPullRequestForGitConfig(
	issue: IssueOrPullRequest,
	_owner: ResourceDescriptor,
): GitConfigEntityIdentifier {
	return {
		entityId: issue.nodeId,
	};
}
export function getIssueFromGitConfigEntityIdentifier(
	_container: unknown,
	_identifier: GitConfigEntityIdentifier,
	_options?: unknown,
): Promise<Issue | undefined> {
	return Promise.resolve(undefined);
}
export const getIssueOwner: ProStubAny = proStub;
export type getIssueOwner<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const GitConfigEntityIdentifier: ProStubAny = proStub;
export type GitConfigEntityIdentifier = {
	entityId?: string;
	[key: string]: unknown;
};
export const GitHubAuthorityMetadata: ProStubAny = proStub;
export type GitHubAuthorityMetadata<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const IntegrationConnectedKey: ProStubAny = proStub;
export type IntegrationConnectedKey = `integration:connected:${string}`;

// Live consumers below this point keep their ProStubAny aliases verbatim.

export const AgentDescriptor: ProStubAny = proStub;
export type AgentDescriptor = { id: string; label: string; kind?: string; [key: string]: unknown };
export const AgentRoute: ProStubAny = proStub;
export type AgentRoute = string;
export const AIActionType: ProStubAny = proStub;
export type AIActionType = string;
export const AiAllAccessOptInPathPrefix: ProStubAny = proStub;
export type AiAllAccessOptInPathPrefix<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AIGenerateChangelogChange: ProStubAny = proStub;
export type AIGenerateChangelogChange<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AIGenerateChangelogChanges: ProStubAny = proStub;
export type AIGenerateChangelogChanges<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const AppState: ProStubAny = proStub;
export type AppState<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
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
export const chipStateSuffix: ProStubAny = proStub;
export type chipStateSuffix<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
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
export const GraphColumnConfig: ProStubAny = proStub;
export type GraphColumnConfig = { width?: number; isHidden?: boolean; mode?: string };
export const GraphDisplayMode: ProStubAny = proStub;
export type GraphDisplayMode = string;
export const GraphItemRefContext: ProStubAny = proStub;
export type GraphItemRefContext<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const GraphItemRefGroupContext: ProStubAny = proStub;
export type GraphItemRefGroupContext<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const GraphSidebarPanel: ProStubAny = proStub;
export type GraphSidebarPanel = string;
export const GraphTreemapMode: ProStubAny = proStub;
export type GraphTreemapMode = string;
export const linkStyles: ProStubAny = proStub;
export type linkStyles<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const LocalDraft: ProStubAny = proStub;
export type LocalDraft<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const LocalWorkspace: ProStubAny = proStub;
export type LocalWorkspace<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const LocalWorkspaceRepositoryDescriptor: ProStubAny = proStub;
export type LocalWorkspaceRepositoryDescriptor<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const LoginUriPathPrefix: ProStubAny = proStub;
export type LoginUriPathPrefix<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const NaturalLanguageSearchOptions: ProStubAny = proStub;
export type NaturalLanguageSearchOptions<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const OrganizationMember: ProStubAny = proStub;
export type OrganizationMember<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const OrganizationRole: ProStubAny = proStub;
export type OrganizationRole = string;
export const RequiredSubscriptionPlanIds: ProStubAny = proStub;
export type RequiredSubscriptionPlanIds = string;
export const ruleStyles: ProStubAny = proStub;
export type ruleStyles<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const RunningOperationExecState: ProStubAny = proStub;
export type RunningOperationExecState<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const statusIconFor: ProStubAny = proStub;
export type statusIconFor<T = ProStubAny, T2 = ProStubAny, T3 = ProStubAny, T4 = ProStubAny> = ProStubAny;
export const SubscriptionUpdatedUriPathPrefix: ProStubAny = proStub;
export type SubscriptionUpdatedUriPathPrefix<
	T = ProStubAny,
	T2 = ProStubAny,
	T3 = ProStubAny,
	T4 = ProStubAny,
> = ProStubAny;
export const TimelinePeriod: ProStubAny = proStub;
export type TimelinePeriod = string;
export const TimelineSliceBy: ProStubAny = proStub;
export type TimelineSliceBy = string;
export const VisualizationMode: ProStubAny = proStub;
export type VisualizationMode = string;
