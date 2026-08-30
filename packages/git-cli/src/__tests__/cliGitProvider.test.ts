import * as assert from 'node:assert';
import * as sinon from 'sinon';
import { Cache } from '@gitlens/git/cache.js';
import type { FileSystemProvider, GitServiceContext } from '@gitlens/git/context.js';
import type { GitResult } from '@gitlens/git/run.types.js';
import { normalizePath } from '@gitlens/utils/path.js';
import { fileUri } from '@gitlens/utils/uri.js';
import { CliGitProvider } from '../cliGitProvider.js';
import { Git } from '../exec/git.js';

suite('CliGitProvider Test Suite', () => {
	let cache: Cache | undefined;
	let provider: CliGitProvider | undefined;
	let sandbox: sinon.SinonSandbox;

	setup(() => {
		sandbox = sinon.createSandbox();
	});

	teardown(() => {
		provider?.dispose();
		cache?.dispose();
		sandbox.restore();
	});

	test('excludeIgnoredUris uses the normalized repository path for the gitDir cache', async () => {
		// Given
		const repoPath = '/repo/';
		const gitDirPath = '/metadata/repo.git';
		const infoExcludePath = normalizePath(`${gitDirPath}/info/exclude`);
		const fs: FileSystemProvider = {
			readDirectory: async () => [],
			readFile: async uri =>
				normalizePath(uri.fsPath) === infoExcludePath
					? new TextEncoder().encode('ignored.txt\n')
					: new Uint8Array(),
			stat: async () => undefined,
		};
		const context: GitServiceContext = { fs: fs };
		const git = new Git(async () => ({ path: 'git', version: '2.0.0' }));
		const emptyResult = {
			exitCode: 0,
			stdout: '',
			stderr: undefined,
			cancelled: false,
		} satisfies GitResult;
		sandbox.stub(git, 'run').resolves(emptyResult);

		cache = new Cache();
		cache.gitDir.set(normalizePath(repoPath), { uri: fileUri(gitDirPath) });
		provider = new CliGitProvider({
			cache: cache,
			context: context,
			git: git,
			locator: async () => ({ path: 'git', version: '2.0.0' }),
		});

		// When
		const result = await provider.excludeIgnoredUris(repoPath, [fileUri('/repo/ignored.txt')]);

		// Then
		assert.deepStrictEqual(result, []);
	});
});
