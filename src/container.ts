import type { ConfigurationChangeEvent, Disposable, Event, ExtensionContext } from 'vscode';
import { EventEmitter, ExtensionMode } from 'vscode';
import { IpcService } from '@env/ipc/ipcService.js';
import { setTelemetryService } from '@env/providers.js';
import { debug } from '@gitlens/utils/decorators/log.js';
import { memoize } from '@gitlens/utils/decorators/memoize.js';
import { FileAnnotationController } from './annotations/fileAnnotationController.js';
import { ActionRunners } from './api/actionRunners.js';
import { AutolinksProvider } from './autolinks/autolinksProvider.js';
import { setDefaultGravatarsStyle } from './avatars.js';
import { CacheProvider } from './cache.js';
import type { ToggleFileAnnotationCommandArgs } from './commands/toggleFileAnnotations.js';
import type { DateSource, DateStyle, Mode } from './config.js';
import type { GlCommands } from './constants.commands.js';
import { extensionPrefix } from './constants.js';
import { EventBus } from './eventBus.js';
import { GitFileSystemProvider } from './git/fsProvider.js';
import { GitProviderService } from './git/gitProviderService.js';
import type { RepositoryLocationProvider } from './git/location/repositorylocationProvider.js';
import { registerPublishListener } from './git/publishListener.js';
import { OnboardingService } from './onboarding/onboardingService.js';
import { UsageTracker } from './onboarding/usageTracker.js';
import { WalkthroughStateProvider } from './onboarding/walkthroughStateProvider.js';
import { IntegrationService, RepositoryIdentityService } from './community/stubs/pro.js';
import { StatusBarController } from './statusbar/statusBarController.js';
import { executeCommand } from './system/-webview/command.js';
import { configuration } from './system/-webview/configuration.js';
import { Keyboard } from './system/-webview/keyboard.js';
import type { Storage } from './system/-webview/storage.js';
import { TelemetryService } from './telemetry/telemetry.js';
import { GitTerminalLinkProvider } from './terminal/linkProvider.js';
import { GitDocumentTracker } from './trackers/documentTracker.js';
import { LineTracker } from './trackers/lineTracker.js';
import { DeepLinkService } from './uris/deepLinks/deepLinkService.js';
import { UriService } from './uris/uriService.js';
import { ViewFileDecorationProvider } from './views/viewDecorationProvider.js';
import { Views } from './views/views.js';
import { VirtualFileSystemService } from './virtual/virtualFileSystemService.js';
import { VslsController } from './vsls/vsls.js';
import { RebaseEditorProvider } from './webviews/rebase/rebaseEditor.js';
import { registerSettingsWebviewCommands, registerSettingsWebviewPanel } from './webviews/settings/registration.js';
import { WebviewCommandRegistrar } from './webviews/webviewCommandRegistrar.js';
import { WebviewsController } from './webviews/webviewsController.js';

export type Environment = 'dev' | 'staging' | 'production';

export class Container {
	static #instance: Container | undefined;
	static #proxy = new Proxy<Container>({} as Container, {
		get: function (_target, prop) {
			// In case anyone has cached this instance
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			if (Container.#instance != null) return (Container.#instance as any)[prop];

			// Allow access to config before we are initialized
			if (prop === 'config') return configuration.getAll();

			// debugger;
			throw new Error('Container is not initialized');
		},
	});

	static create(
		context: ExtensionContext,
		storage: Storage,
		prerelease: boolean,
		version: string,
		previousVersion: string | undefined,
	): Container {
		if (Container.#instance != null) throw new Error('Container is already initialized');

		Container.#instance = new Container(context, storage, prerelease, version, previousVersion);
		return Container.#instance;
	}

	static get instance(): Container {
		return Container.#instance ?? Container.#proxy;
	}

	private _onReady: EventEmitter<void> = new EventEmitter<void>();
	get onReady(): Event<void> {
		if (this._ready) {
			const emitter = new EventEmitter<void>();
			setTimeout(() => emitter.fire(), 0);
			return emitter.event;
		}

		return this._onReady.event;
	}

	toLoggable(): string {
		return '<container>';
	}

	readonly BranchDateFormatting = {
		dateFormat: undefined! as string | null,
		dateStyle: undefined! as DateStyle,

		reset: (): void => {
			this.BranchDateFormatting.dateFormat = configuration.get('defaultDateFormat');
			this.BranchDateFormatting.dateStyle = configuration.get('defaultDateStyle');
		},
	};

	readonly CommitDateFormatting = {
		dateFormat: null as string | null,
		dateSource: 'authored' as DateSource,
		dateStyle: 'relative' as DateStyle,

		reset: (): void => {
			this.CommitDateFormatting.dateFormat = configuration.get('defaultDateFormat');
			this.CommitDateFormatting.dateSource = configuration.get('defaultDateSource');
			this.CommitDateFormatting.dateStyle = configuration.get('defaultDateStyle');
		},
	};

	readonly CommitShaFormatting = {
		length: 7,

		reset: (): void => {
			// Don't allow shas to be shortened to less than 5 characters
			this.CommitShaFormatting.length = Math.max(5, configuration.get('advanced.abbreviatedShaLength'));
		},
	};

	readonly PullRequestDateFormatting = {
		dateFormat: null as string | null,
		dateStyle: 'relative',

		reset: (): void => {
			this.PullRequestDateFormatting.dateFormat = configuration.get('defaultDateFormat');
			this.PullRequestDateFormatting.dateStyle = configuration.get('defaultDateStyle');
		},
	};

	readonly TagDateFormatting = {
		dateFormat: null as string | null,
		dateStyle: 'relative',

		reset: (): void => {
			this.TagDateFormatting.dateFormat = configuration.get('defaultDateFormat');
			this.TagDateFormatting.dateStyle = configuration.get('defaultDateStyle');
		},
	};

	private _disposables: Disposable[];
	private _terminalLinks: GitTerminalLinkProvider | undefined;

	private constructor(
		context: ExtensionContext,
		storage: Storage,
		prerelease: boolean,
		version: string,
		previousVersion: string | undefined,
	) {
		this._context = context;
		this._prerelease = prerelease;
		this._version = version;
		this._previousVersion = previousVersion;
		this.ensureModeApplied();

		this._disposables = [
			configuration,
			(this._storage = storage),
			(this._onboarding = new OnboardingService(storage, version)),
			(this._telemetry = new TelemetryService(this)),
			(this._usage = new UsageTracker(this, storage)),
			configuration.onDidChangeAny(this.onAnyConfigurationChanged, this),
		];
		setTelemetryService(this._telemetry);

		this._disposables.push((this._uri = new UriService(this)));
		this._disposables.push((this._walkthrough = new WalkthroughStateProvider(this)));

		this._disposables.push((this._eventBus = new EventBus()));
		this._disposables.push((this._ipc = new IpcService(this)));
		this._disposables.push((this._git = new GitProviderService(this)));
		this._disposables.push(new GitFileSystemProvider(this));
		this._disposables.push((this._virtualFs = new VirtualFileSystemService(this)));

		this._disposables.push((this._deepLinks = new DeepLinkService(this)));

		this._disposables.push((this._actionRunners = new ActionRunners(this)));
		this._disposables.push(registerPublishListener(this));
		this._disposables.push((this._documentTracker = new GitDocumentTracker(this)));
		this._disposables.push((this._lineTracker = new LineTracker(this, this._documentTracker)));
		this._disposables.push((this._keyboard = new Keyboard()));
		this._disposables.push((this._vsls = new VslsController(this)));

		this._disposables.push((this._fileAnnotationController = new FileAnnotationController(this)));
		this._disposables.push((this._statusBarController = new StatusBarController(this)));

		const webviewCommandRegistrar = new WebviewCommandRegistrar();
		this._disposables.push(webviewCommandRegistrar);

		const webviews = new WebviewsController(this, webviewCommandRegistrar);
		this._disposables.push(webviews);
		this._disposables.push((this._views = new Views(this, webviews)));

		this._disposables.push((this._rebaseEditor = new RebaseEditorProvider(this, webviewCommandRegistrar)));

		const settingsPanels = registerSettingsWebviewPanel(webviews);
		this._disposables.push(settingsPanels);
		this._disposables.push(registerSettingsWebviewCommands(settingsPanels));

		this._disposables.push(new ViewFileDecorationProvider());

		if (configuration.get('terminalLinks.enabled')) {
			this._disposables.push((this._terminalLinks = new GitTerminalLinkProvider(this)));
		}

		this._disposables.push(
			configuration.onDidChange(e => {
				if (configuration.changed(e, 'terminalLinks.enabled')) {
					this._terminalLinks?.dispose();
					this._terminalLinks = undefined;
					if (configuration.get('terminalLinks.enabled')) {
						this._disposables.push((this._terminalLinks = new GitTerminalLinkProvider(this)));
					}
				}
			}),
		);

		context.subscriptions.push({
			dispose: () => this._disposables.reverse().forEach(d => void d?.dispose()),
		});
	}

	deactivate(): void {
		this._deactivating = true;
	}

	private _deactivating: boolean = false;
	get deactivating(): boolean {
		return this._deactivating;
	}

	private _ready: boolean = false;
	private _readyAt: number | undefined;
	/** Timestamp (ms since epoch) when the container transitioned to ready, or `undefined` if not yet ready. */
	get readyAt(): number | undefined {
		return this._readyAt;
	}

	async ready(): Promise<void> {
		if (this._ready) throw new Error('Container is already ready');

		this._ready = true;
		this._readyAt = Date.now();
		await this.registerGitProviders();
		queueMicrotask(() => this._onReady.fire());
	}

	@debug()
	private async registerGitProviders(): Promise<void> {
		await this._git.registerProviders();
	}

	private onAnyConfigurationChanged(e: ConfigurationChangeEvent) {
		if (!configuration.changedAny(e, extensionPrefix)) return;

		this._mode = undefined;

		if (configuration.changed(e, 'defaultGravatarsStyle')) {
			setDefaultGravatarsStyle(configuration.get('defaultGravatarsStyle'));
		}

		if (configuration.changed(e, 'mode')) {
			this.ensureModeApplied();
		}
	}

	private readonly _actionRunners: ActionRunners;
	get actionRunners(): ActionRunners {
		return this._actionRunners;
	}

	private _autolinks: AutolinksProvider | undefined;
	get autolinks(): AutolinksProvider {
		if (this._autolinks == null) {
			this._disposables.push((this._autolinks = new AutolinksProvider(this)));
		}

		return this._autolinks;
	}

	private _cache: CacheProvider | undefined;
	get cache(): CacheProvider {
		if (this._cache == null) {
			this._disposables.push((this._cache = new CacheProvider(this)));
		}

		return this._cache;
	}

	private readonly _context: ExtensionContext;
	get context(): ExtensionContext {
		return this._context;
	}

	@memoize()
	get debugging(): boolean {
		return this._context.extensionMode === ExtensionMode.Development;
	}

	private readonly _deepLinks: DeepLinkService;
	get deepLinks(): DeepLinkService {
		return this._deepLinks;
	}

	private readonly _documentTracker: GitDocumentTracker;
	get documentTracker(): GitDocumentTracker {
		return this._documentTracker;
	}

	@memoize()
	get env(): Environment {
		return 'production';
	}

	private readonly _eventBus: EventBus;
	get events(): EventBus {
		return this._eventBus;
	}

	private readonly _ipc: IpcService;
	get ipc(): IpcService {
		return this._ipc;
	}

	get extensionMode(): ExtensionMode {
		return this._context.extensionMode;
	}

	private readonly _fileAnnotationController: FileAnnotationController;
	get fileAnnotations(): FileAnnotationController {
		return this._fileAnnotationController;
	}

	private readonly _virtualFs: VirtualFileSystemService;
	get virtualFs(): VirtualFileSystemService {
		return this._virtualFs;
	}

	private readonly _git: GitProviderService;
	get git(): GitProviderService {
		return this._git;
	}

	@memoize()
	get id(): string {
		return this._context.extension.id;
	}

	private _integrations: IntegrationService | undefined;
	get integrations(): IntegrationService {
		if (this._integrations == null) {
			this._disposables.push((this._integrations = new IntegrationService(this)));
		}
		return this._integrations;
	}

	private readonly _keyboard: Keyboard;
	get keyboard(): Keyboard {
		return this._keyboard;
	}

	private readonly _lineTracker: LineTracker;
	get lineTracker(): LineTracker {
		return this._lineTracker;
	}

	private _mode: Mode | undefined;
	get mode(): Mode | undefined {
		this._mode ??= configuration.get('modes')?.[configuration.get('mode.active')];
		return this._mode;
	}

	private readonly _prerelease;
	get prerelease(): boolean {
		return this._prerelease;
	}

	@memoize()
	get prereleaseOrDebugging(): boolean {
		return this._prerelease || this.debugging;
	}

	private readonly _rebaseEditor: RebaseEditorProvider;
	get rebaseEditor(): RebaseEditorProvider {
		return this._rebaseEditor;
	}

	private _repositoryIdentity: RepositoryIdentityService | undefined;
	get repositoryIdentity(): RepositoryIdentityService {
		if (this._repositoryIdentity == null) {
			this._disposables.push(
				(this._repositoryIdentity = new RepositoryIdentityService(this, this.repositoryLocator)),
			);
		}
		return this._repositoryIdentity;
	}

	private _repositoryLocator: RepositoryLocationProvider | null | undefined;
	get repositoryLocator(): RepositoryLocationProvider | undefined {
		this._repositoryLocator ??= null;
		return undefined;
	}

	private readonly _statusBarController: StatusBarController;
	get statusBar(): StatusBarController {
		return this._statusBarController;
	}

	private readonly _storage: Storage;
	get storage(): Storage {
		return this._storage;
	}

	private readonly _onboarding: OnboardingService;
	get onboarding(): OnboardingService {
		return this._onboarding;
	}

	private readonly _telemetry: TelemetryService;
	get telemetry(): TelemetryService {
		return this._telemetry;
	}

	private readonly _uri: UriService;
	get uri(): UriService {
		return this._uri;
	}

	private readonly _usage: UsageTracker;
	get usage(): UsageTracker {
		return this._usage;
	}

	private readonly _walkthrough: WalkthroughStateProvider;
	get walkthrough(): WalkthroughStateProvider {
		return this._walkthrough;
	}

	private readonly _version: string;
	get version(): string {
		return this._version;
	}

	private readonly _previousVersion: string | undefined;
	get previousVersion(): string | undefined {
		return this._previousVersion;
	}

	private readonly _views: Views;
	get views(): Views {
		return this._views;
	}

	private readonly _vsls: VslsController;
	get vsls(): VslsController {
		return this._vsls;
	}

	private ensureModeApplied() {
		const mode = this.mode;
		if (mode == null) {
			configuration.clearOverrides();

			return;
		}

		if (mode.annotations != null) {
			let command: GlCommands | undefined;
			switch (mode.annotations) {
				case 'blame':
					command = 'gitlens.toggleFileBlame:mode';
					break;
				case 'changes':
					command = 'gitlens.toggleFileChanges:mode';
					break;
				case 'heatmap':
					command = 'gitlens.toggleFileHeatmap:mode';
					break;
			}

			if (command != null) {
				const commandArgs: ToggleFileAnnotationCommandArgs = { type: mode.annotations, on: true };
				// Make sure to delay the execution by a bit so that the configuration changes get propagated first
				setTimeout(executeCommand, 50, command, commandArgs);
			}
		}

		// Apply any required configuration overrides
		configuration.applyOverrides({
			get: (section, value): unknown => {
				if (mode.annotations != null) {
					if (configuration.matches(`${mode.annotations}.toggleMode`, section, value)) {
						return 'window';
					}

					if (configuration.matches(mode.annotations, section, value)) {
						return typeof value === 'object' && value != null
							? { ...(value as unknown as Record<string, unknown>), toggleMode: 'window' }
							: value;
					}
				}

				for (const key of ['statusBar'] as const) {
					if (mode[key] != null) {
						if (configuration.matches(`${key}.enabled`, section, value)) {
							return mode[key];
						} else if (configuration.matches(key, section, value)) {
							return typeof value === 'object' && value != null
								? { ...(value as unknown as Record<string, unknown>), enabled: mode[key] }
								: value;
						}
					}
				}

				return value;
			},
			getAll: cfg => {
				if (mode.annotations != null) {
					cfg[mode.annotations].toggleMode = 'window';
				}

				if (mode.statusBar != null) {
					cfg.statusBar.enabled = mode.statusBar;
				}

				return cfg;
			},
			onDidChange: e => {
				// When the mode or modes change, we will simulate that all the affected configuration also changed
				if (!configuration.changed(e, ['mode', 'modes'])) return e;

				const originalAffectsConfiguration = e.affectsConfiguration;
				return {
					...e,
					affectsConfiguration: (section, scope) =>
						/^gitlens\.(?:modes?|blame|changes|heatmap|statusBar)\b/.test(section)
							? true
							: originalAffectsConfiguration(section, scope),
				};
			},
		});
	}
}

export function isContainer(container: any): container is Container {
	return container instanceof Container;
}
