import type { GitBranch } from '@gitlens/git/models/branch.js';
import type { PullRequest, PullRequestShape } from '@gitlens/git/models/pullRequest.js';
import type { GitRemote } from '@gitlens/git/models/remote.js';
import { RemoteResourceType } from '@gitlens/git/models/remoteResource.js';
import type { GitStatus } from '@gitlens/git/models/status.js';
import { GitWorktree } from '@gitlens/git/models/worktree.js';
import type { BranchContributionsOverview } from '@gitlens/git/providers/branches.js';
import type { GitCommandPriority } from '@gitlens/git/run.types.js';
import { createRevisionRange } from '@gitlens/git/utils/revision.utils.js';
import { filterMap } from '@gitlens/utils/iterable.js';
import { getSettledValue } from '@gitlens/utils/promise.js';
import type { EnrichedAutolink } from '../../autolinks/models/autolinks.js';
import type { Container } from '../../container.js';
import {
	getBranchAssociatedPullRequest,
	getBranchMergeTargetInfo,
	getBranchRemote,
} from '../../git/utils/-webview/branch.utils.js';
import { getContributorAvatarUri } from '../../git/utils/-webview/contributor.utils.js';
import type {
	GetOverviewEnrichmentResponse,
	GetOverviewWipResponse,
	OverviewBranchContributor,
	OverviewBranchEnrichment,
	OverviewBranchIssue,
	OverviewBranchMergeTarget,
	OverviewBranchPullRequest,
} from './overviewBranches.js';

export async function getAutolinkIssuesInfo(
	links: Map<string, EnrichedAutolink> | undefined,
): Promise<OverviewBranchIssue[]> {
	if (links == null) return [];

	const results = await Promise.allSettled(
		filterMap([...links.values()], async autolink => {
			const issueOrPullRequest = autolink?.[0];
			if (issueOrPullRequest == null) return undefined;

			const issue = await issueOrPullRequest;
			if (issue == null) return undefined;

			return {
				type: issue.type,
				id: issue.id,
				title: issue.title,
				url: issue.url,
				state: issue.state,
				draft: issue.type === 'pullrequest' ? (issue as PullRequestShape).isDraft : undefined,
			};
		}),
	);

	return results.map(r => (r.status === 'fulfilled' ? r.value : undefined)).filter(r => r != null);
}

export async function getContributorsInfo(
	_container: Container,
	contributorsPromise: Promise<BranchContributionsOverview | undefined> | undefined,
): Promise<OverviewBranchContributor[]> {
	if (contributorsPromise == null) return [];

	const contributors = await contributorsPromise;
	if (contributors?.contributors == null) return [];

	const result = await Promise.allSettled(
		contributors.contributors.map(
			async c =>
				({
					name: c.name ?? '',
					email: c.email ?? '',
					current: c.current,
					timestamp: c.latestCommitDate?.getTime(),
					count: c.contributionCount,
					stats: c.stats,
					avatarUrl: (await getContributorAvatarUri(c))?.toString(),
				}) satisfies OverviewBranchContributor,
		),
	);
	return result.map(r => (r.status === 'fulfilled' ? r.value : undefined)).filter(r => r != null);
}

export async function getBranchMergeTargetStatusInfo(
	container: Container,
	branch: GitBranch,
	cancellation?: AbortSignal,
	associatedPullRequest?: Promise<PullRequest | undefined>,
): Promise<OverviewBranchMergeTarget | undefined> {
	// Forward cancellation and bound the PR-based merge-target lookup. Without these the
	// integration call (e.g. GitHub PR fetch) can take seconds-to-indefinite when slow,
	// stranding the webview's mergeTarget loading flag because the RPC promise never settles.
	// On timeout, getBranchMergeTargetInfo's paused result is ignored below and we fall through
	// to baseBranch/defaultBranch — a usable answer instead of a stuck spinner.
	const info = await getBranchMergeTargetInfo(container, branch, {
		associatedPullRequest: associatedPullRequest ?? getBranchAssociatedPullRequest(container, branch),
		cancellation: cancellation,
		timeout: 5000,
	});

	let targetResult;
	if (!info.mergeTargetBranch.paused && info.mergeTargetBranch.value) {
		targetResult = info.mergeTargetBranch.value;
	}

	const target = targetResult ?? info.baseBranch ?? info.defaultBranch;
	if (target == null) return undefined;

	const svc = container.git.getRepositoryService(branch.repoPath);
	const targetBranch = await svc.branches.getBranch(target, cancellation);
	// The tip SHA is required — without it the graph's scope anchor can't be placed.
	if (targetBranch?.sha == null) return undefined;
	// Bail when the target tip is the same commit as the focal branch's tip — there's no real
	// merge to describe (happens on the default branch, where the fallback chain has nowhere
	// to land, and on any feature branch transiently equal to its target). Letting it through
	// poisons `scope.mergeTargetTipSha` via `reconcileScopeMergeTarget` / `scopeToBranchById`,
	// and the graph component's `shouldHideWipRowForScope` then hides the WIP row of every
	// worktree on the scoped branch because the parent sha matches the (excluded) merge-target
	// tip. Matches the early-out in `computeScopeAnchor` (graphWebview.ts).
	if (targetBranch.sha === branch.sha) return undefined;

	const [countsResult, conflictResult, mergedStatusResult] = await Promise.allSettled([
		svc.commits.getLeftRightCommitCount(
			createRevisionRange(targetBranch.name, branch.ref, '...'),
			{ excludeMerges: true },
			cancellation,
		),
		svc.branches.getPotentialMergeConflicts?.(branch.name, targetBranch.name, cancellation),
		svc.branches.getBranchMergedStatus?.(branch, targetBranch, cancellation),
	]);

	const counts = getSettledValue(countsResult);
	const status = counts != null ? { ahead: counts.right, behind: counts.left } : undefined;
	const rawMergedStatus = getSettledValue(mergedStatusResult);
	// A branch with zero unique commits vs. its target isn't merged — it's just at (or behind) a
	// point on the target's history. `getBranchMergedStatusCore` returns `merged: true` here because
	// `git merge-base --is-ancestor` succeeds (every commit is an ancestor of its descendants),
	// but no merge has actually occurred. Demote it so the indicator reports "Up to Date" / "X
	// Commits Behind" instead of "Branch Merged".
	const mergedStatus =
		rawMergedStatus?.merged && status?.ahead === 0 ? ({ merged: false } as const) : rawMergedStatus;

	return {
		repoPath: branch.repoPath,
		id: targetBranch.id,
		sha: targetBranch.sha,
		name: targetBranch.name,
		status: status,
		mergedStatus: mergedStatus,
		potentialConflicts: getSettledValue(conflictResult),
		targetBranch: targetBranch.name,
		baseBranch: info.baseBranch,
		defaultBranch: info.defaultBranch,
	};
}

export async function getPullRequestInfo(
	container: Container,
	branch: GitBranch,
	associatedPullRequest?: Promise<PullRequest | undefined>,
): Promise<OverviewBranchPullRequest | undefined> {
	const pr = await (associatedPullRequest ?? getBranchAssociatedPullRequest(container, branch, { avatarSize: 64 }));
	if (pr == null) return undefined;

	return {
		id: pr.id,
		url: pr.url,
		state: pr.state,
		title: pr.title,
		draft: pr.isDraft,
		authorName: pr.author?.name,
		updatedDate: pr.updatedDate?.getTime(),
		reviewDecision: pr.reviewDecision,
		providerId: pr.provider.id,
	};
}

export async function getOverviewWip(
	container: Container,
	branches: Iterable<GitBranch>,
	worktreesByBranch: ReadonlyMap<string, GitWorktree>,
	branchIds: string[],
	options?: {
		priority?: GitCommandPriority;
		signal?: AbortSignal;
		/**
		 * Optional cache-aware status fetcher. Callers (the Graph webview) supply a callback that
		 * routes through their `_wipStatusCache` so repeat overview reads within the
		 * cache TTL don't re-fetch. When omitted, falls back to direct fetches (Home uses this).
		 */
		fetchStatus?: (repoPath: string, signal?: AbortSignal) => Promise<GitStatus | undefined>;
		/**
		 * Cheap mode for Recent worktree-backed branches: probes `status.hasWorkingChanges()`
		 * (`git diff --quiet` + `git ls-files`) per worktree instead of running a full status. Result
		 * carries `hasChanges` only — `workingTreeState`, conflicts, and pausedOp are all undefined
		 * and get filled in lazily on hover via `GetOverviewWipDetailedRequest`. The probe is
		 * `@gate`d at the sub-provider so concurrent identical calls dedup.
		 */
		cheap?: boolean;
	},
): Promise<GetOverviewWipResponse> {
	if (branchIds.length === 0) return {};

	const { priority, signal, fetchStatus, cheap } = options ?? {};
	const statusOptions = priority != null ? { priority: priority } : undefined;

	const branchesById = new Map<string, GitBranch>();
	for (const branch of branches) {
		if (branch.remote) continue;

		branchesById.set(branch.id, branch);
	}

	const result: GetOverviewWipResponse = {};

	if (cheap) {
		// Cheap path: dirty-bit only, no paused-op, no breakdown. Used for Recent worktree-backed
		// cards so they can show a clean/dirty indicator without paying for a full `git status` per
		// branch. The full breakdown is fetched on hover via `GetOverviewWipDetailedRequest`.
		await Promise.allSettled(
			branchIds.map(async branchId => {
				if (!branchesById.has(branchId)) return;

				const wt = worktreesByBranch.get(branchId);
				const path = wt != null && wt.type !== 'bare' ? wt.uri.fsPath : undefined;
				if (path == null) return;

				// Pin staged/unstaged/untracked to true so this matches `status.files.length > 0`
				// (the full-status path's dirty check). Without it, defaults could exclude one of
				// those categories and the cheap probe would disagree with the on-hover detailed
				// fetch — e.g. an all-staged worktree showing the clean pill until hover.
				const hasChanges = await container.git
					.getRepositoryService(path)
					.status.hasWorkingChanges({ staged: true, unstaged: true, untracked: true }, signal);
				result[branchId] = { hasChanges: hasChanges };
			}),
		);

		signal?.throwIfAborted();
		return result;
	}

	const statusPromises = new Map<string, Promise<GitStatus | undefined>>();
	let repoStatusPromise: Promise<GitStatus | undefined> | undefined;

	for (const branchId of branchIds) {
		const branch = branchesById.get(branchId);
		if (branch == null) continue;

		const wt = worktreesByBranch.get(branchId);
		if (wt != null) {
			const wtStatusPromise =
				fetchStatus != null && wt.type !== 'bare'
					? fetchStatus(wt.uri.fsPath, signal)
					: GitWorktree.getStatus(wt, statusOptions, signal);
			statusPromises.set(branchId, wtStatusPromise);
		} else if (branch.current) {
			repoStatusPromise ??=
				fetchStatus != null
					? fetchStatus(branch.repoPath, signal)
					: container.git.getRepositoryService(branch.repoPath).status.getStatus(statusOptions, signal);
			statusPromises.set(branchId, repoStatusPromise);
		}
	}

	await Promise.allSettled(
		Array.from(statusPromises.entries(), async ([branchId, statusPromise]) => {
			const branch = branchesById.get(branchId)!;
			const wt = worktreesByBranch.get(branchId);
			const isActive = branch.current || wt?.opened === true;
			// Paused-op must come from the same repo as the status — for a worktree-backed branch,
			// `branch.repoPath` is the MAIN repo, so a worktree mid-rebase/merge/cherry-pick would
			// otherwise show the main repo's paused-op state (likely none) instead of its own.
			const repoPath = wt?.uri.fsPath ?? branch.repoPath;
			const [statusResult, pausedOpStatusResult] = await Promise.allSettled([
				statusPromise,
				isActive
					? container.git
							.getRepositoryService(repoPath)
							.pausedOps?.getPausedOperationStatus?.(undefined, signal)
					: undefined,
			]);

			const status = getSettledValue(statusResult);
			const pausedOpStatus = getSettledValue(pausedOpStatusResult);

			if (status != null || pausedOpStatus != null) {
				const workingTreeState = status?.diffStatus;
				const hasChanges =
					workingTreeState != null &&
					workingTreeState.added + workingTreeState.changed + workingTreeState.deleted > 0;
				result[branchId] = {
					hasChanges: hasChanges,
					workingTreeState: workingTreeState,
					hasConflicts: status?.hasConflicts,
					conflictsCount: status?.conflicts.length,
					pausedOpStatus: pausedOpStatus,
				};
			}
		}),
	);

	options?.signal?.throwIfAborted();
	return result;
}

interface BranchEnrichmentPromises {
	remote?: Promise<GitRemote | undefined>;
}

export async function getOverviewEnrichment(
	container: Container,
	branches: Iterable<GitBranch>,
	branchIds: string[],
	options: {
		signal?: AbortSignal;
	},
): Promise<GetOverviewEnrichmentResponse> {
	if (branchIds.length === 0) return {};

	const { signal } = options;

	const branchesById = new Map<string, GitBranch>();
	for (const branch of branches) {
		if (branch.remote) continue;

		branchesById.set(branch.id, branch);
	}

	const enrichmentPromises = new Map<string, BranchEnrichmentPromises>();

	for (const branchId of branchIds) {
		const branch = branchesById.get(branchId);
		if (branch == null) continue;

		const promises: BranchEnrichmentPromises = {};

		if (branch.upstream?.missing === false) {
			promises.remote = getBranchRemote(container, branch);
		}

		enrichmentPromises.set(branchId, promises);
	}

	const result: GetOverviewEnrichmentResponse = {};

	await Promise.allSettled(
		Array.from(enrichmentPromises.entries(), async ([branchId, promises]) => {
			const enrichment: OverviewBranchEnrichment = {};

			const [remoteResult] = await Promise.allSettled([promises.remote]);

			const remote = getSettledValue(remoteResult);
			if (remote != null) {
				enrichment.remote = {
					name: remote.name,
					provider: remote.provider
						? {
								name: remote.provider.name,
								icon: remote.provider.icon === 'remote' ? 'cloud' : remote.provider.icon,
								url: await remote.provider.url({ type: RemoteResourceType.Repo }),
								supportedFeatures: remote.provider.supportedFeatures,
							}
						: undefined,
				};
			}

			if (Object.keys(enrichment).length) {
				result[branchId] = enrichment;
			}
		}),
	);

	signal?.throwIfAborted();
	return result;
}
