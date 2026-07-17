// Community build: cloud/rich integrations are inert. These types and services preserve the
// integration framework shape so host/webview code compiles and runs without any real
// authentication, connection, or remote data — every query resolves empty/disconnected.
import type { IssueOrPullRequest } from '@gitlens/git/models/issueOrPullRequest.js';
import type { Issue } from '@gitlens/git/models/issue.js';
import type { CommitAuthor } from '@gitlens/git/models/author.js';
import type { RemoteProviderId } from '@gitlens/git/models/remoteProvider.js';
import type { RepositoryMetadata } from '@gitlens/git/models/repositoryMetadata.js';
import type {
	IssueResourceDescriptor,
	RepositoryDescriptor,
	ResourceDescriptor,
} from '@gitlens/git/models/resourceDescriptor.js';
import type {
	CloudGitSelfManagedHostIntegrationIds,
	IntegrationIds,
	IssuesCloudHostIntegrationId,
} from '../../constants.integrations.js';
import type { GlRepository } from '../models/repository.js';

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

export type ConfiguredIntegrationDescriptor = {
	integrationId: IntegrationIds;
	domain?: string;
};

export type ConfiguredIntegrationsChangeEvent = {
	added: ConfiguredIntegrationDescriptor[];
	configured: ConfiguredIntegrationDescriptor[];
	removed: ConfiguredIntegrationDescriptor[];
	etag: number;
};

export type ConnectionStateChangeEvent = {
	key: string;
	reason?: 'connected' | 'disconnected';
	integrationId?: string;
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

export const providersMetadata: Record<string, { name: string; iconKey: string; type: 'git' | 'issues' }> = {};

export function convertRemoteProviderIdToIntegrationId(
	_providerId: RemoteProviderId | string,
): IntegrationIds | undefined {
	return undefined;
}

export type IntegrationConnectedKey = `integration:connected:${string}`;

export function getIntegrationConnectedKey(id: IntegrationIds, domain?: string): IntegrationConnectedKey {
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

export type GitConfigEntityIdentifier = {
	entityId?: string;
	[key: string]: unknown;
};

export function decodeEntityIdentifiersFromGitConfig(encoded: string): GitConfigEntityIdentifier[] {
	const parsed = JSON.parse(encoded) as unknown;
	return Array.isArray(parsed) ? (parsed as GitConfigEntityIdentifier[]) : [];
}

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

export function getIssueOwner(_issue: unknown): IssueResourceDescriptor | RepositoryDescriptor | undefined {
	return undefined;
}
