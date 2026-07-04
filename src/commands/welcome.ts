import { urls } from '../constants.js';
import type { Container } from '../container.js';
import { command, executeCoreCommand } from '../system/-webview/command.js';
import { openUrl } from '../system/-webview/vscode/uris.js';
import { GlCommandBase } from './commandBase.js';

@command()
export class WelcomeOpenHelpCenterCommand extends GlCommandBase {
	constructor(private readonly container: Container) {
		super('gitlens.welcome.openHelpCenter');
	}

	execute(): void {
		const url = urls.helpCenter;
		this.container.telemetry.sendEvent('welcome/action', {
			type: 'url',
			name: 'open/help-center',
			url: url,
		});
		void openUrl(url);
	}
}

@command()
export class WelcomeCloseCommand extends GlCommandBase {
	constructor() {
		super('gitlens.views.welcome.close');
	}

	execute(): void {
		void executeCoreCommand('gitlens.views.welcome.toggleVisibility');
	}
}
