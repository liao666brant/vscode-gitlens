import type { IntegrationConnectedKey } from './community/stubs/pro.js';
import type { GitRevisionRangeNotation } from '@gitlens/git/models/revision.js';
import type { GraphBranchesVisibility, ViewShowBranchComparison } from './config.js';
import type { IntegrationIds } from './constants.integrations.js';
import type { TrackedUsage, TrackedUsageKeys } from './constants.telemetry.js';
import type { GroupableTreeViewTypes, TreeViewTypes } from './constants.views.js';
import type { Environment } from './container.js';
import type { OnboardingStorage } from './onboarding/models/onboarding.js';
import type { DeepLinkServiceState } from './uris/deepLinks/deepLink.js';

export type SecretKeys = IntegrationAuthenticationKeys | `gitlens.plus.auth:${Environment}` | 'deepLinks:pending';

export type IntegrationAuthenticationKeys =
	| `gitlens.integration.auth:${IntegrationIds}|${string}`
	| `gitlens.integration.auth.cloud:${IntegrationIds}|${string}`;

export const enum SyncedStorageKeys {
	Version = 'gitlens:synced:version',
	PreReleaseVersion = 'gitlens:synced:preVersion',
}

export type DeprecatedGlobalStorage = {
	/** @deprecated */
	pendingWelcomeOnFocus: boolean;
	/** @deprecated */
	'plus:discountNotificationShown': boolean;
	/** @deprecated */
	'plus:migratedAuthentication': boolean;
	/** @deprecated */
	'plus:renewalDiscountNotificationShown': boolean;
	/** @deprecated */
	'views:layout': 'gitlens' | 'scm';
	/** @deprecated */
	'views:commitDetails:dismissed': 'sidebar'[];
	'mcp:banner:dismissed': boolean;
	/** @deprecated Use OnboardingService */
	'views:scm:grouped:welcome:dismissed': boolean;
	/** @deprecated Use OnboardingService dismiss('composer:onboarding') */
	'composer:onboarding:dismissed': string;
	/** @deprecated Use OnboardingService setItemState('composer:onboarding', ...) */
	'composer:onboarding:stepReached': number;
} & {
	/** @deprecated */
	[key in `disallow:connection:${string}`]: any;
};

interface GlobalStorageCore {
	avatars: [string, StoredAvatar][];
	repoVisibility: [string, StoredRepoVisibilityInfo][];
	pendingWhatsNewOnFocus: boolean;
	'synced:version': string;
	// Keep the pre-release version separate from the released version
	'synced:preVersion': string;
	usages: Record<TrackedUsageKeys, TrackedUsage>;
	version: string;
	// Keep the pre-release version separate from the released version
	preVersion: string;
	'confirm:draft:storage': boolean;
	'graph:searchMode': StoredGraphSearchMode;
	'graph:useNaturalLanguageSearch': boolean;
	'integrations:configured': StoredIntegrationConfigurations;
	/** Unified onboarding/dismissible UI state */
	'onboarding:state': OnboardingStorage;
}

type GlobalStorageDynamic = Record<`provider:authentication:skip:${string}`, boolean> &
	Record<`gk:${string}:organizations`, Stored<StoredOrganization[]>> &
	Record<`jira:${string}:organizations`, Stored<StoredJiraOrganization[] | undefined>> &
	Record<`jira:${string}:projects`, Stored<StoredJiraProject[] | undefined>> &
	Record<`azure:${string}:account`, Stored<StoredAzureAccount | undefined>> &
	Record<`azure:${string}:organizations`, Stored<StoredAzureOrganization[] | undefined>> &
	Record<`azure:${string}:projects`, Stored<StoredAzureProject[] | undefined>> &
	Record<`bitbucket:${string}:account`, Stored<StoredBitbucketAccount | undefined>> &
	Record<`bitbucket:${string}:workspaces`, Stored<StoredBitbucketWorkspace[] | undefined>> &
	Record<`bitbucket-server:${string}:account`, Stored<StoredBitbucketAccount | undefined>>;

export type GlobalStorage = GlobalStorageCore & GlobalStorageDynamic;

/**
 * Storage keys that contain environment-specific data (e.g., file paths, install status).
 * These are automatically scoped by platform and remote info to avoid conflicts when
 * globalState is shared across local/remote environments (Windows, WSL, containers, SSH).
 *
 * Use `storage.getScoped()` / `storage.storeScoped()` / `storage.deleteScoped()` for these keys.
 */
export interface GlobalScopedStorage {
	'gk:cli:install': StoredGkCLIInstallInfo;
}

export interface StoredGkCLIInstallInfo {
	status: 'attempted' | 'unsupported' | 'completed';
	attempts: number;
	version?: string;
}

export type StoredIntegrationConfigurations = Record<
	IntegrationIds,
	StoredConfiguredIntegrationDescriptor[] | undefined
>;

export interface StoredConfiguredIntegrationDescriptor {
	cloud: boolean;
	integrationId: IntegrationIds;
	domain?: string;
	expiresAt?: string;
	scopes: string;
}

export type DeprecatedWorkspaceStorage = {
	/** @deprecated */
	'graph:banners:dismissed': Record<string, boolean>;
	/** @deprecated */
	'views:searchAndCompare:keepResults': boolean;
};

interface WorkspaceStorageCore {
	assumeRepositoriesOnStartup?: boolean;
	'branch:comparisons': StoredBranchComparisons;
	'gitComandPalette:usage': StoredRecentUsage;
	gitPath: string;
	'graph:filtersByRepo': Record<string, StoredGraphFilters>;
	/** Unified onboarding/dismissible UI state (workspace-scoped items) */
	'onboarding:state': OnboardingStorage;
	'starred:repositories': StoredStarred;
	'views:commitDetails:pullRequestExpanded': boolean;
	'views:commitDetails:showSearchBox': boolean;
	'views:commitDetails:searchBoxFilter': boolean;
	'views:repositories:autoRefresh': boolean;
	'views:searchAndCompare:pinned': StoredSearchAndCompareItems;
	'views:scm:grouped:selected': GroupableTreeViewTypes;
}

/**
 * Repository filter values:
 * - `undefined` or `'all'` - show all repositories (new code should set `'all'`)
 * - `'exclude-worktrees'` - show all except linked worktrees (worktrees whose main repo is also open)
 * - `string[]` - show only the specified repository IDs
 */
export type RepositoryFilterValue = 'all' | 'exclude-worktrees' | string[] | undefined;

type WorkspaceStorageDynamic = Record<IntegrationConnectedKey, boolean> &
	Record<`views:${TreeViewTypes}:repositoryFilter`, RepositoryFilterValue> &
	Record<`graph:searchHistory:${string}`, StoredGraphSearchHistory[]>;

export type WorkspaceStorage = WorkspaceStorageCore & WorkspaceStorageDynamic;

export interface Stored<T, SchemaVersion extends number = 1> {
	v: SchemaVersion;
	data: T;
	timestamp?: number;
}

export interface StoredOrganization {
	id: string;
	name: string;
	role: 'owner' | 'admin' | 'billing' | 'user';
}

export interface StoredJiraOrganization {
	key: string;
	id: string;
	name: string;
	url: string;
	avatarUrl: string;
}

export interface StoredJiraProject {
	key: string;
	id: string;
	name: string;
	resourceId: string;
}

export interface StoredAzureAccount {
	id: string;
	name: string | undefined;
	username: string | undefined;
	email: string | undefined;
	avatarUrl: string | undefined;
}

export interface StoredAzureOrganization {
	key: string;
	id: string;
	name: string;
}

export interface StoredAzureProject {
	key: string;
	id: string;
	name: string;
	resourceId: string;
	resourceName: string;
}

export interface StoredBitbucketAccount {
	id: string;
	name: string | undefined;
	username: string | undefined;
	email: string | undefined;
	avatarUrl: string | undefined;
}

export interface StoredBitbucketWorkspace {
	key: string;
	id: string;
	name: string;
	slug: string;
}

export interface StoredAvatar {
	uri: string;
	timestamp: number;
}

export type StoredRepositoryVisibility = 'private' | 'public' | 'local';

export interface StoredRepoVisibilityInfo {
	visibility: StoredRepositoryVisibility;
	timestamp: number;
	remotesHash?: string;
}

export interface StoredBranchComparison {
	ref: string;
	label?: string;
	notation: GitRevisionRangeNotation | undefined;
	type: Exclude<ViewShowBranchComparison, false> | undefined;
	checkedFiles?: string[];
}

export type StoredBranchComparisons = Record<string, string | StoredBranchComparison>;

export interface StoredDeepLinkContext {
	url?: string | undefined;
	repoPath?: string | undefined;
	targetSha?: string | undefined;
	secondaryTargetSha?: string | undefined;
	useProgress?: boolean | undefined;
	state?: DeepLinkServiceState | undefined;
	prData?: string | undefined;
	issueData?: string | undefined;
	instructions?: string | undefined;
	/** Agent descriptor for Start Work / Start Review with `showOpenInAgent`. Plain JSON shape. */
	agent?: unknown;
	/** Worktree path for CLI dispatch `cwd`. */
	worktreePath?: string | undefined;
}

export type StoredGraphExcludeTypes = 'remotes' | 'stashes' | 'tags';

export interface StoredGraphFilters {
	branchesVisibility?: GraphBranchesVisibility;
	includeOnlyRefs?: Record<string, StoredGraphIncludeOnlyRef>;
	excludeRefs?: Record<string, StoredGraphExcludedRef>;
	excludeTypes?: Record<StoredGraphExcludeTypes, boolean>;
	pinnedRef?: StoredGraphPinnedRef;
}

export type StoredGraphRefType = 'head' | 'remote' | 'tag';

export type StoredGraphSearchHistory = {
	query: string;
	matchAll: boolean | undefined;
	matchCase: boolean | undefined;
	matchRegex: boolean | undefined;
	matchWholeWord: boolean | undefined;
	naturalLanguage: boolean | undefined;
	/** For NL queries, store the last known structured form to show in history */
	nlStructuredQuery?: string;
};

export type StoredGraphSearchMode = 'normal' | 'filter';

export interface StoredGraphExcludedRef {
	id: string;
	type: StoredGraphRefType;
	name: string;
	owner?: string;
}

export interface StoredGraphIncludeOnlyRef {
	id: string;
	type: StoredGraphRefType;
	name: string;
	owner?: string;
}

export interface StoredGraphPinnedRef {
	id: string;
	type: StoredGraphRefType;
	name: string;
	owner?: string;
}

export interface StoredNamedRef {
	label?: string;
	ref: string;
}

export interface StoredComparison {
	type: 'comparison';
	timestamp: number;
	path: string;
	ref1: StoredNamedRef;
	ref2: StoredNamedRef;
	notation?: GitRevisionRangeNotation;

	checkedFiles?: string[];
}

export interface StoredSearch {
	type: 'search';
	timestamp: number;
	path: string;
	labels: {
		label: string;
		queryLabel:
			| string
			| {
					label: string;
					resultsType?: { singular: string; plural: string };
			  };
	};
	search: StoredSearchQuery;
}

export interface StoredSearchQuery {
	pattern: string;
	matchAll?: boolean;
	matchCase?: boolean;
	matchRegex?: boolean;
	matchWholeWord?: boolean;
	naturalLanguage?: boolean | { query: string; processedQuery?: string };
}

export type StoredSearchAndCompareItem = StoredComparison | StoredSearch;
export type StoredSearchAndCompareItems = Record<string, StoredSearchAndCompareItem>;
export type StoredStarred = Record<string, boolean>;
export type StoredRecentUsage = Record<string, number>;
