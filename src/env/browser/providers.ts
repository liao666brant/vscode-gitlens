import type { Cache } from '@gitlens/git/cache.js';
import type { GitProvider } from '@gitlens/git/providers/provider.js';
import type { GitResult, GitRunOptions } from '@gitlens/git/run.types.js';
import type { UnifiedDisposable } from '@gitlens/utils/disposable.js';
import type { Container } from '../../container.js';
import type { GlGitProvider } from '../../git/gitProvider.js';
import type { TelemetryService } from '../../telemetry/telemetry.js';

export function git(
	_container: Container,
	_options: GitRunOptions,
	..._args: any[]
): Promise<GitResult<string | Buffer>> {
	return Promise.resolve({ stdout: '', exitCode: 0 });
}

export function getSupportedGitProviders(
	_container: Container,
	_cache: Cache,
	_register: (provider: GitProvider, canHandle: (repoPath: string) => boolean) => UnifiedDisposable,
): Promise<GlGitProvider[]> {
	return Promise.resolve([]);
}

let _telemetryService: TelemetryService | undefined;
export function getTelementryService(): TelemetryService | undefined {
	return _telemetryService;
}

export function setTelemetryService(service: TelemetryService): void {
	_telemetryService = service;
}
