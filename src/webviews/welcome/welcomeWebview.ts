import { Disposable, env } from 'vscode';
import type { WebviewTelemetryContext } from '../../constants.telemetry.js';
import type { WalkthroughContextKeys } from '../../constants.walkthroughs.js';
import type { Container } from '../../container.js';
import { registerCommand } from '../../system/-webview/command.js';
import type { WebviewHost, WebviewProvider, WebviewShowingArgs } from '../webviewProvider.js';
import type { WebviewShowOptions } from '../webviewsController.js';
import type { State, WalkthroughProgress } from './protocol.js';
import { DidChangeWalkthroughProgress, DidFocusWalkthrough } from './protocol.js';
import type { WelcomeWebviewShowingArgs } from './registration.js';

export class WelcomeWebviewProvider implements WebviewProvider<State, State, WelcomeWebviewShowingArgs> {
	private readonly _disposable: Disposable;

	constructor(
		private readonly container: Container,
		private readonly host: WebviewHost<'gitlens.views.welcome'>,
	) {
		this._disposable = Disposable.from(
			this.container.walkthrough.onDidChangeProgress(this.onWalkthroughProgressChanged, this),
		);
	}

	dispose(): void {
		this._disposable.dispose();
	}

	getTelemetryContext(): WebviewTelemetryContext {
		return {
			...this.host.getTelemetryContext(),
		};
	}

	onShowing(
		loading: boolean,
		_options?: WebviewShowOptions,
		...args: WebviewShowingArgs<WelcomeWebviewShowingArgs, State>
	): [boolean, Record<`context.${string}`, string | number | boolean> | undefined] {
		void args;

		if (!loading) {
			void this.host.notify(DidFocusWalkthrough, undefined);
		}
		return [true, undefined];
	}

	includeBootstrap(): Promise<State> {
		return this.getState();
	}

	registerCommands(): Disposable[] {
		if (this.host.is('view')) {
			return [registerCommand(`${this.host.id}.refresh`, () => this.host.refresh(true), this)];
		}
		return [];
	}

	private onWalkthroughProgressChanged(): void {
		const walkthroughProgress = this.getWalkthroughProgress();
		if (walkthroughProgress != null) {
			void this.host.notify(DidChangeWalkthroughProgress, { walkthroughProgress: walkthroughProgress });
		}
	}

	private getWalkthroughProgress(): WalkthroughProgress | undefined {
		const walkthroughState = this.container.walkthrough.getState();
		const state = Object.fromEntries(walkthroughState) as Record<WalkthroughContextKeys, boolean>;

		return {
			allCount: this.container.walkthrough.walkthroughSize,
			doneCount: this.container.walkthrough.doneCount,
			progress: this.container.walkthrough.progress,
			state: state,
		};
	}

	private getState(): Promise<State> {
		return Promise.resolve({
			...this.host.baseWebviewState,
			webroot: this.host.getWebRoot(),
			hostAppName: env.appName,
			walkthroughProgress: this.getWalkthroughProgress(),
		});
	}
}
