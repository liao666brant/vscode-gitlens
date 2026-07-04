import type { GlCommands } from '../constants.commands.js';
import type { WalkthroughSteps } from '../constants.js';
import { urls } from '../constants.js';
import type { Source, Sources, TelemetryEvents } from '../constants.telemetry.js';
import type { Container } from '../container.js';
import { isWalkthroughSupported } from '../onboarding/walkthroughStateProvider.js';
import { command, executeCommand } from '../system/-webview/command.js';
import { openUrl } from '../system/-webview/vscode/uris.js';
import { openWalkthrough as openWalkthroughCore } from '../system/-webview/vscode.js';
import { GlCommandBase } from './commandBase.js';

@command()
export class GetStartedCommand extends GlCommandBase {
	constructor(private readonly container: Container) {
		super('gitlens.getStarted');
	}

	execute(extensionIdOrsource?: Sources): void {
		const source = extensionIdOrsource !== this.container.context.extension.id ? undefined : extensionIdOrsource;
		openWalkthrough(this.container, source ? { source: { source: source } } : undefined);
	}
}

export interface OpenWalkthroughCommandArgs {
	step?: WalkthroughSteps | undefined;
	source?: Source;
	detail?: string | undefined;
}

@command()
export class OpenWalkthroughCommand extends GlCommandBase {
	constructor(private readonly container: Container) {
		super('gitlens.openWalkthrough');
	}

	execute(args?: OpenWalkthroughCommandArgs): void {
		openWalkthrough(this.container, args);
	}
}

const helpCenterWalkthroughUrls = new Map<WalkthroughSteps | 'default', string>([
	['default', urls.getStarted],
	['get-started-community', urls.getStarted],
]);

function openWalkthrough(container: Container, args?: OpenWalkthroughCommandArgs) {
	const walkthroughSupported = isWalkthroughSupported();
	if (container.telemetry.enabled) {
		const walkthroughEvent: TelemetryEvents['walkthrough'] = { step: args?.step };
		if (!walkthroughSupported) {
			walkthroughEvent.usingFallbackUrl = true;
		}
		container.telemetry.sendEvent('walkthrough', walkthroughEvent, args?.source);
	}

	if (!walkthroughSupported) {
		const url = helpCenterWalkthroughUrls.get(args?.step ?? 'default') ?? urls.getStarted;
		void openUrl(url);
		return;
	}

	void openWalkthroughCore(container.context.extension.id, 'welcome', args?.step, false);
}

@command()
export class WalkthroughOpenWalkthroughCommand extends GlCommandBase {
	constructor(private readonly container: Container) {
		super('gitlens.walkthrough.openWalkthrough');
	}

	execute(): void {
		const command: GlCommands = 'gitlens.openWalkthrough';
		this.container.telemetry.sendEvent('walkthrough/action', {
			type: 'command',
			name: 'open/walkthrough',
			command: command,
		});
		executeCommand<OpenWalkthroughCommandArgs>(command, { source: { source: 'walkthrough' } });
	}
}

@command()
export class WalkthroughOpenHelpCenterCommand extends GlCommandBase {
	constructor(private readonly container: Container) {
		super('gitlens.walkthrough.openHelpCenter');
	}

	execute(): void {
		const url = urls.helpCenter;
		this.container.telemetry.sendEvent('walkthrough/action', {
			type: 'url',
			name: 'open/help-center',
			url: url,
		});
		void openUrl(url);
	}
}

@command()
export class WalkthroughGitLensInspectCommand extends GlCommandBase {
	constructor(private readonly container: Container) {
		super('gitlens.walkthrough.gitlensInspect');
	}

	execute(): void {
		const command: GlCommands = 'gitlens.showCommitDetailsView';
		this.container.telemetry.sendEvent('walkthrough/action', {
			type: 'command',
			name: 'open/inspect',
			command: command,
		});
		executeCommand(command);
	}
}
