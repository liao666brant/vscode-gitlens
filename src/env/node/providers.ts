import { workspace } from 'vscode';
import type { Cache } from '@gitlens/git/cache.js';
import type { GitProvider } from '@gitlens/git/providers/provider.js';
import type { GitResult, GitRunOptions } from '@gitlens/git/run.types.js';
import { Git } from '@gitlens/git-cli/exec/git.js';
import { findGitPath } from '@gitlens/git-cli/exec/locator.js';
import type { UnifiedDisposable } from '@gitlens/utils/disposable.js';
import type { Container } from '../../container.js';
import type { GlGitProvider } from '../../git/gitProvider.js';
import { configuration } from '../../system/-webview/configuration.js';
import type { TelemetryService } from '../../telemetry/telemetry.js';
import { GlCliGitProvider } from './git/cliGitProvider.js';
import { VslsGitProvider } from './git/vslsGitProvider.js';

let vslsGitInstance: Git | undefined;
function ensureVslsGit(): Git {
	if (vslsGitInstance == null) {
		const locator = () => findGitPath(configuration.getCore('git.path'));
		vslsGitInstance = new Git(locator, {
			isTrusted: () => workspace.isTrusted,
		});
	}
	return vslsGitInstance;
}

export function git(
	_container: Container,
	options: GitRunOptions,
	...args: any[]
): Promise<GitResult<string | Buffer>> {
	return ensureVslsGit().run(options, ...args);
}

export function getSupportedGitProviders(
	container: Container,
	cache: Cache,
	register: (provider: GitProvider, canHandle: (repoPath: string) => boolean) => UnifiedDisposable,
): Promise<GlGitProvider[]> {
	return Promise.resolve([
		new GlCliGitProvider(container, cache, register),
		new VslsGitProvider(container, cache, register),
	]);
}

let _telemetryService: TelemetryService | undefined;
export function getTelementryService(): TelemetryService | undefined {
	return _telemetryService;
}

export function setTelemetryService(service: TelemetryService): void {
	_telemetryService = service;
}
