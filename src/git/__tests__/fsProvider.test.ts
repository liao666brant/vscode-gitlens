import * as assert from 'assert';
import { Uri } from 'vscode';
import type { GitTreeEntry } from '@gitlens/git/models/tree.js';
import { encodeGitLensRevisionUriAuthority } from '@gitlens/git/utils/uriAuthority.js';
import { PromiseCache } from '@gitlens/utils/promiseCache.js';
import type { TernarySearchTree } from '@gitlens/utils/searchTree.js';
import { Schemes } from '../../constants.js';
import type { Container } from '../../container.js';
import { GitFileSystemProvider } from '../fsProvider.js';

function createRevisionUri(repoPath: string, ref: string): Uri {
	return Uri.from({
		scheme: Schemes.GitLens,
		authority: encodeGitLensRevisionUriAuthority({ repoPath: repoPath, ref: ref }),
		path: `${repoPath}/`,
	});
}

interface PrivateFsProvider {
	container: Container;
	_searchTreeMap: PromiseCache<string, TernarySearchTree<string, GitTreeEntry>>;
}

function createProvider(container: Container): GitFileSystemProvider {
	// Skip the constructor: it registers the `gitlens` scheme, which the extension under
	// test has already registered in the extension-host test runner.
	const provider = Object.create(GitFileSystemProvider.prototype) as GitFileSystemProvider;
	const privateProvider = provider as unknown as PrivateFsProvider;
	privateProvider.container = container;
	privateProvider._searchTreeMap = new PromiseCache<string, TernarySearchTree<string, GitTreeEntry>>({
		capacity: 50,
		accessTTL: 1000 * 60 * 10, // 10 minutes idle
	});
	return provider;
}

function createMockContainer(
	trees: Record<string, GitTreeEntry[]>,
): Container & { getTreeForRevisionCalls: Record<string, number> } {
	const getTreeForRevisionCalls: Record<string, number> = {};
	const container = {
		git: {
			getRepositoryService: (repoPath: string) => ({
				revision: {
					getTreeForRevision: async (_ref: string) => {
						getTreeForRevisionCalls[repoPath] = (getTreeForRevisionCalls[repoPath] ?? 0) + 1;
						return trees[repoPath] ?? [];
					},
					getTreeEntryForRevision: async (_path: string, _ref: string) => undefined,
				},
			}),
		},
		getTreeForRevisionCalls: getTreeForRevisionCalls,
	} as unknown as Container & { getTreeForRevisionCalls: Record<string, number> };
	return container;
}

suite('GitFileSystemProvider Test Suite', () => {
	suite('Search Tree Cache', () => {
		test('separates cache entries by repoPath when repos share the same ref', async () => {
			const ref = 'main';
			const repoA = '/repo/a';
			const repoB = '/repo/b';

			const trees: Record<string, GitTreeEntry[]> = {
				[repoA]: [
					{ ref: ref, oid: 'a1', path: 'a.txt', size: 1, type: 'blob' },
					{ ref: ref, oid: 'a2', path: 'b.txt', size: 2, type: 'blob' },
				],
				[repoB]: [
					{ ref: ref, oid: 'b1', path: 'c.txt', size: 3, type: 'blob' },
					{ ref: ref, oid: 'b2', path: 'd.txt', size: 4, type: 'blob' },
				],
			};

			const container = createMockContainer(trees);
			const provider = createProvider(container);

			const entriesA = await provider.readDirectory(createRevisionUri(repoA, ref));
			const entriesB = await provider.readDirectory(createRevisionUri(repoB, ref));

			// Regression: the search tree cache was keyed by ref only, so repo B's listing
			// returned repo A's tree for the same ref string (e.g. both on HEAD/main).
			assert.deepStrictEqual(entriesA.map(([name]) => name).sort(), ['a.txt', 'b.txt']);
			assert.deepStrictEqual(entriesB.map(([name]) => name).sort(), ['c.txt', 'd.txt']);

			// Cache semantics are preserved: each repo's tree is built once
			assert.strictEqual(container.getTreeForRevisionCalls[repoA], 1);
			assert.strictEqual(container.getTreeForRevisionCalls[repoB], 1);

			// Re-reading a repo hits the cache
			await provider.readDirectory(createRevisionUri(repoA, ref));
			assert.strictEqual(container.getTreeForRevisionCalls[repoA], 1);
		});
	});
});
