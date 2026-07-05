import { Uri, window } from 'vscode';
import type { PullRequest, PullRequestComparisonRefs } from '@gitlens/git/models/pullRequest.js';
import type { CreatePullRequestRemoteResource } from '@gitlens/git/models/remoteResource.js';
import type { LeftRightCommitCountResult } from '@gitlens/git/providers/commits.js';
import {
	getComparisonRefsForPullRequest,
	getRepositoryIdentityForPullRequest,
} from '@gitlens/git/utils/pullRequest.utils.js';
import { gitSuffixRegex } from '@gitlens/git/utils/remote.utils.js';
import { createRevisionRange } from '@gitlens/git/utils/revision.utils.js';
import { Schemes } from '../../../constants.js';
import type { Source } from '../../../constants.telemetry.js';
import type { Container } from '../../../container.js';
import type { GlRepository } from '../../models/repository.js';

// ponytail: AI PR 描述生成在社区构建中已移除；社区构建不提供 AI 功能。
// 保留函数签名以避免改动 remote.utils.ts 调用点，始终返回 undefined。
export function describePullRequestWithAI(
	_container: Container,
	_repo: string | GlRepository,
	_resource: CreatePullRequestRemoteResource,
	_source: Source,
	_options?: { progress?: unknown },
): Promise<{ title: string; description: string } | undefined> {
	return Promise.resolve(undefined);
}

export async function ensurePullRequestRefs(
	pr: PullRequest,
	repo: GlRepository,
	options?: { silent?: true; promptMessage?: never } | { silent?: never; promptMessage?: string },
	refs?: PullRequestComparisonRefs,
): Promise<LeftRightCommitCountResult | undefined> {
	if (pr.refs == null) return undefined;

	refs ??= getComparisonRefsForPullRequest(repo.path, pr.refs);
	const range = createRevisionRange(refs.base.ref, refs.head.ref, '...');

	let counts = await repo.git.commits.getLeftRightCommitCount(range);
	if (counts == null) {
		if (await ensurePullRequestRemote(pr, repo, options)) {
			counts = await repo.git.commits.getLeftRightCommitCount(range);
		}
	}

	return counts;
}

export async function ensurePullRequestRemote(
	pr: PullRequest,
	repo: GlRepository,
	options?: { silent?: true; promptMessage?: never } | { silent?: never; promptMessage?: string },
): Promise<boolean> {
	const identity = getRepositoryIdentityForPullRequest(pr);
	if (identity.remote.url == null) return false;

	const prRemoteUrl = identity.remote.url.replace(gitSuffixRegex, '');

	let found = false;
	for (const remote of await repo.git.remotes.getRemotes()) {
		if (remote.matches(prRemoteUrl)) {
			found = true;
			break;
		}
	}

	if (found) return true;

	const confirm = { title: '添加远程' };
	const cancel = { title: '取消', isCloseAffordance: true };
	if (!options?.silent) {
		const result = await window.showInformationMessage(
			`${
				options?.promptMessage ?? `无法为 PR #${pr.id} 找到对应的远程。`
			}\n是否要为“${identity.provider.repoDomain}”添加一个远程？`,
			{ modal: true },
			confirm,
			cancel,
		);

		if (result === confirm) {
			await repo.git.remotes.addRemoteWithResult?.(identity.provider.repoDomain, identity.remote.url, {
				fetch: true,
			});
			return true;
		}
	}

	return false;
}

export async function getOpenedPullRequestRepo(
	container: Container,
	pr: PullRequest,
	repoPath?: string,
): Promise<GlRepository | undefined> {
	if (repoPath) return container.git.getRepository(repoPath);

	const repo = await getOrOpenPullRequestRepository(container, pr, { promptIfNeeded: true });
	return repo;
}

export async function getOrOpenPullRequestRepository(
	container: Container,
	pr: PullRequest,
	options?: { promptIfNeeded?: boolean; skipVirtual?: boolean },
): Promise<GlRepository | undefined> {
	const identity = getRepositoryIdentityForPullRequest(pr);
	let repo = await container.repositoryIdentity.getRepository(identity, {
		openIfNeeded: true,
		keepOpen: false,
		prompt: false,
	});

	if (repo == null && !options?.skipVirtual) {
		const virtualUri = getVirtualUriForPullRequest(pr);
		if (virtualUri != null) {
			repo = await container.git.getOrAddRepository(virtualUri, { opened: false, detectNested: false });
		}
	}

	if (repo == null) {
		const baseIdentity = getRepositoryIdentityForPullRequest(pr, false);
		repo = await container.repositoryIdentity.getRepository(baseIdentity, {
			openIfNeeded: true,
			keepOpen: false,
			prompt: false,
		});
	}

	if (repo == null && options?.promptIfNeeded) {
		repo = await container.repositoryIdentity.getRepository(identity, {
			openIfNeeded: true,
			keepOpen: false,
			prompt: true,
		});
	}

	return repo;
}

export function getVirtualUriForPullRequest(pr: PullRequest): Uri | undefined {
	if (pr.provider.id !== 'github') return undefined;

	const uri = Uri.parse(pr.refs?.base?.url ?? pr.url);
	return uri.with({ scheme: Schemes.Virtual, authority: 'github', path: uri.path });
}
