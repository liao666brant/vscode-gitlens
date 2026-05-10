import type { ConfigurationChangeEvent, StatusBarItem, TextEditor, Uri } from 'vscode';
import { CancellationTokenSource, Disposable, MarkdownString, StatusBarAlignment, window } from 'vscode';
import type { ToggleFileChangesAnnotationCommandArgs } from '../commands/toggleFileAnnotations.js';
import type { GlCommands } from '../constants.commands.js';
import { GlyphChars } from '../constants.js';
import type { Container } from '../container.js';
import { CommitFormatter } from '../git/formatters/commitFormatter.js';
import type { PullRequest } from '../git/models/pullRequest.js';
import { detailsMessage } from '../hovers/hovers.js';
import { createCommand } from '../system/-webview/command.js';
import { configuration } from '../system/-webview/configuration.js';
import { isTrackableTextEditor } from '../system/-webview/vscode/editors.js';
import { createMarkdownCommandLink } from '../system/commands.js';
import { trace } from '../system/decorators/log.js';
import { once } from '../system/event.js';
import { getScopedLogger } from '../system/logger.scope.js';
import type { MaybePausedResult } from '../system/promise.js';
import { getSettledValue, pauseOnCancelOrTimeout } from '../system/promise.js';
import type { LinesChangeEvent, LineState } from '../trackers/lineTracker.js';

export class StatusBarController implements Disposable {
	private _cancellation: CancellationTokenSource | undefined;
	private readonly _disposable: Disposable;
	private _selectedSha: string | undefined;
	private _statusBarBlame: StatusBarItem | undefined;
	private _statusBarMode: StatusBarItem | undefined;

	constructor(private readonly container: Container) {
		this._disposable = Disposable.from(
			once(container.onReady)(this.onReady, this),
			configuration.onDidChange(this.onConfigurationChanged, this),
		);
	}

	dispose(): void {
		this.clearBlame();

		this._statusBarBlame?.dispose();
		this._statusBarMode?.dispose();

		this.container.lineTracker.unsubscribe(this);
		this._disposable.dispose();
	}

	private onReady(): void {
		this.onConfigurationChanged();
	}

	private onConfigurationChanged(e?: ConfigurationChangeEvent) {
		if (configuration.changed(e, 'mode')) {
			const mode = configuration.get('mode.statusBar.enabled') ? this.container.mode : undefined;
			if (mode?.statusBarItemName) {
				const alignment =
					configuration.get('mode.statusBar.alignment') !== 'left'
						? StatusBarAlignment.Right
						: StatusBarAlignment.Left;

				if (configuration.changed(e, 'mode.statusBar.alignment')) {
					if (this._statusBarMode?.alignment !== alignment) {
						this._statusBarMode?.dispose();
						this._statusBarMode = undefined;
					}
				}

				this._statusBarMode =
					this._statusBarMode ??
					window.createStatusBarItem(
						'gitlens.mode',
						alignment,
						alignment === StatusBarAlignment.Right ? 999 : 1,
					);
				this._statusBarMode.name = 'GitLens Modes';
				this._statusBarMode.command = 'gitlens.switchMode' satisfies GlCommands;
				this._statusBarMode.text = mode.statusBarItemName;
				this._statusBarMode.tooltip = new MarkdownString(
					`**${mode.statusBarItemName}** ${GlyphChars.Dash} ${mode.description}\n\n---\n\n点击切换 GitLens 模式`,
					true,
				);
				this._statusBarMode.accessibilityInformation = {
					label: `GitLens 模式：${mode.statusBarItemName}\n点击切换 GitLens 模式`,
				};
				this._statusBarMode.show();
			} else {
				this._statusBarMode?.dispose();
				this._statusBarMode = undefined;
			}
		}

		if (!configuration.changed(e, 'statusBar')) return;

		if (configuration.get('statusBar.enabled')) {
			const alignment =
				configuration.get('statusBar.alignment') !== 'left'
					? StatusBarAlignment.Right
					: StatusBarAlignment.Left;

			if (configuration.changed(e, 'statusBar.alignment')) {
				if (this._statusBarBlame?.alignment !== alignment) {
					this._statusBarBlame?.dispose();
					this._statusBarBlame = undefined;
				}
			}

			this._statusBarBlame =
				this._statusBarBlame ??
				window.createStatusBarItem(
					'gitlens.blame',
					alignment,
					alignment === StatusBarAlignment.Right ? 1000 : 0,
				);
			this._statusBarBlame.name = 'GitLens Current Line Blame';
			this._statusBarBlame.command = configuration.get('statusBar.command');

			if (configuration.changed(e, 'statusBar.enabled')) {
				this.container.lineTracker.subscribe(
					this,
					this.container.lineTracker.onDidChangeActiveLines(this.onActiveLinesChanged, this),
				);
			}
		} else if (configuration.changed(e, 'statusBar.enabled')) {
			this.container.lineTracker.unsubscribe(this);

			this._statusBarBlame?.dispose();
			this._statusBarBlame = undefined;
		}
	}

	@trace({
		args: e => ({
			e: `editor=${e.editor?.document.uri.toString(true)}, selections=${e.selections
				?.map(s => `[${s.anchor}-${s.active}]`)
				.join(',')}, pending=${Boolean(e.pending)}, reason=${e.reason}`,
		}),
	})
	private onActiveLinesChanged(e: LinesChangeEvent) {
		// If we need to reduceFlicker, don't clear if only the selected lines changed
		let clear = !(
			configuration.get('statusBar.reduceFlicker') &&
			e.reason === 'selection' &&
			(e.pending || e.selections != null)
		);
		if (!e.pending && e.selections != null) {
			const state = this.container.lineTracker.getState(e.selections[0].active);
			if (state?.commit != null) {
				void this.updateBlame(e.editor!, state);

				return;
			}

			clear = true;
		}

		if (clear) {
			this.clearBlame();

			if (e.suspended && e.editor?.document.isDirty && this._statusBarBlame != null) {
				const statusBarItem = this._statusBarBlame;
				const trackedDocumentPromise = this.container.documentTracker.get(e.editor.document);
				queueMicrotask(async () => {
					const doc = await trackedDocumentPromise;
					if (doc == null) return;

					const status = await doc?.getStatus();
					if (!status?.blameable) return;

					statusBarItem.tooltip = new MarkdownString();
					statusBarItem.tooltip.isTrusted = {
						enabledCommands: ['gitlens.showSettingsPage' satisfies GlCommands],
					};

					if (doc.canDirtyIdle) {
						statusBarItem.text = '$(watch) 注释暂停';
						statusBarItem.tooltip.appendMarkdown(
							`注释将在 [${configuration.get(
								'advanced.blame.delayAfterEdit',
							)} 毫秒延迟](${createMarkdownCommandLink<[undefined, string]>('gitlens.showSettingsPage', [
								undefined,
								'advanced.blame.delayAfterEdit',
							])} '更改编辑后延迟') 后恢复，以限制因存在未保存更改而产生的性能影响`,
						);
					} else {
						statusBarItem.text = '$(debug-pause) 注释暂停';
						statusBarItem.tooltip.appendMarkdown(
							`注释将在保存后恢复，因为存在未保存更改且文件超过了 [${configuration.get(
								'advanced.blame.sizeThresholdAfterEdit',
							)} 行阈值](${createMarkdownCommandLink<[undefined, string]>('gitlens.showSettingsPage', [
								undefined,
								'advanced.blame.sizeThresholdAfterEdit',
							])} '更改编辑后行阈值') 以限制性能影响`,
						);
					}

					statusBarItem.show();
				});
			}
		} else if (this._statusBarBlame?.text.startsWith('$(git-commit)')) {
			this._statusBarBlame.text = `$(watch)${this._statusBarBlame.text.substring(13)}`;
		}
	}

	clearBlame(): void {
		this._selectedSha = undefined;
		this._cancellation?.cancel();
		this._statusBarBlame?.hide();
	}

	@trace({ args: (editor, state) => ({ editor: editor, state: state.commit?.sha }) })
	private async updateBlame(editor: TextEditor, state: LineState) {
		const scope = getScopedLogger();

		const cfg = configuration.get('statusBar');
		if (!cfg.enabled || this._statusBarBlame == null || !isTrackableTextEditor(editor)) {
			this._cancellation?.cancel();
			this._selectedSha = undefined;

			scope?.addExitInfo(
				`skipped; ${!cfg.enabled || this._statusBarBlame == null ? 'disabled' : 'not a trackable editor'}`,
			);

			return;
		}

		const { commit } = state;
		if (commit == null) {
			this._cancellation?.cancel();

			scope?.addExitInfo('skipped; no commit found');

			return;
		}

		// We can avoid refreshing if the commit is the same, except when the commit is uncommitted, since we need to incorporate the line number in the hover
		if (this._selectedSha === commit.sha && !commit.isUncommitted) {
			if (this._statusBarBlame?.text.startsWith('$(watch)')) {
				this._statusBarBlame.text = `$(git-commit)${this._statusBarBlame.text.substring(8)}`;
			}

			scope?.addExitInfo('skipped; same commit');

			return;
		}

		this._selectedSha = commit.sha;

		this._cancellation?.cancel();
		this._cancellation = new CancellationTokenSource();
		const cancellation = this._cancellation.token;

		let actionTooltip: string;
		switch (cfg.command) {
			case 'gitlens.copyRemoteCommitUrl':
				actionTooltip = '点击复制远程提交 URL';
				break;
			case 'gitlens.copyRemoteFileUrl':
				this._statusBarBlame.command = 'gitlens.copyRemoteFileUrlToClipboard' satisfies GlCommands;
				actionTooltip = '点击复制远程文件修订版 URL';
				break;
			case 'gitlens.diffWithPrevious':
				this._statusBarBlame.command = 'gitlens.diffLineWithPrevious' satisfies GlCommands;
				actionTooltip = '点击打开与上一修订版的行变更';
				break;
			case 'gitlens.diffWithWorking':
				this._statusBarBlame.command = 'gitlens.diffLineWithWorking' satisfies GlCommands;
				actionTooltip = '点击打开与工作文件的行变更';
				break;
			case 'gitlens.openCommitOnRemote':
				actionTooltip = '点击在远程打开提交';
				break;
			case 'gitlens.openFileOnRemote':
				actionTooltip = '点击在远程打开修订版';
				break;
			case 'gitlens.revealCommitInView':
				actionTooltip = '点击在侧边栏中显示提交';
				break;
			case 'gitlens.showCommitsInView':
				actionTooltip = '点击搜索提交';
				break;
			case 'gitlens.showQuickCommitDetails':
				actionTooltip = '点击显示提交';
				break;
			case 'gitlens.showQuickCommitFileDetails':
				actionTooltip = '点击显示提交（文件）';
				break;
			case 'gitlens.showQuickRepoHistory':
				actionTooltip = '点击显示分支历史';
				break;
			case 'gitlens.showQuickFileHistory':
				actionTooltip = '点击显示文件历史';
				break;
			case 'gitlens.toggleCodeLens':
				actionTooltip = '点击切换 Git CodeLens';
				break;
			case 'gitlens.toggleFileBlame':
				this._statusBarBlame.command = 'gitlens.toggleFileBlame:statusbar' satisfies GlCommands;
				actionTooltip = '点击切换文件注释';
				break;
			case 'gitlens.toggleFileChanges': {
				if (commit.file != null) {
					this._statusBarBlame.command = createCommand<[Uri, ToggleFileChangesAnnotationCommandArgs]>(
						'gitlens.toggleFileChanges:statusbar',
						'Toggle File Changes',
						commit.file.uri,
						{
							type: 'changes',
							context: { sha: commit.sha, only: false, selection: false },
						},
					);
				} else {
					this._statusBarBlame.command = 'gitlens.toggleFileChanges:statusbar' satisfies GlCommands;
				}
				actionTooltip = '点击切换文件变更';
				break;
			}
			case 'gitlens.toggleFileChangesOnly': {
				if (commit.file != null) {
					this._statusBarBlame.command = createCommand<[Uri, ToggleFileChangesAnnotationCommandArgs]>(
						'gitlens.toggleFileChanges:statusbar',
						'Toggle File Changes',
						commit.file.uri,
						{
							type: 'changes',
							context: { sha: commit.sha, only: true, selection: false },
						},
					);
				} else {
					this._statusBarBlame.command = 'gitlens.toggleFileChanges:statusbar' satisfies GlCommands;
				}
				actionTooltip = '点击切换文件变更';
				break;
			}
			case 'gitlens.toggleFileHeatmap':
				this._statusBarBlame.command = 'gitlens.toggleFileHeatmap:statusbar' satisfies GlCommands;
				actionTooltip = '点击切换文件热力图';
				break;
		}

		this._statusBarBlame.tooltip = new MarkdownString(`加载中... \n\n---\n\n${actionTooltip}`);
		this._statusBarBlame.accessibilityInformation = {
			label: `${this._statusBarBlame.text}\n${actionTooltip}`,
		};

		const svc = this.container.git.getRepositoryService(commit.repoPath);
		const remotes = await svc.remotes.getBestRemotesWithProviders();
		const [remote] = remotes;

		const defaultDateFormat = configuration.get('defaultDateFormat');
		const getBranchAndTagTipsPromise =
			CommitFormatter.has(cfg.format, 'tips') || CommitFormatter.has(cfg.tooltipFormat, 'tips')
				? svc.getBranchesAndTagsTipsLookup()
				: undefined;

		const showPullRequests =
			!commit.isUncommitted &&
			remote?.supportsIntegration() &&
			cfg.pullRequests.enabled &&
			(CommitFormatter.has(
				cfg.format,
				'pullRequest',
				'pullRequestAgo',
				'pullRequestAgoOrDate',
				'pullRequestDate',
				'pullRequestState',
			) ||
				CommitFormatter.has(
					cfg.tooltipFormat,
					'pullRequest',
					'pullRequestAgo',
					'pullRequestAgoOrDate',
					'pullRequestDate',
					'pullRequestState',
				));

		function setBlameText(
			statusBarItem: StatusBarItem,
			getBranchAndTagTips: Awaited<typeof getBranchAndTagTipsPromise> | undefined,
			pr: Promise<PullRequest | undefined> | PullRequest | undefined,
		) {
			statusBarItem.text = `$(git-commit) ${CommitFormatter.fromTemplate(cfg.format, commit, {
				dateFormat: cfg.dateFormat === null ? defaultDateFormat : cfg.dateFormat,
				getBranchAndTagTips: getBranchAndTagTips,
				messageTruncateAtNewLine: true,
				pullRequest: pr,
				pullRequestPendingMessage: 'PR $(watch)',
				remotes: remotes,
			})}`;
			statusBarItem.accessibilityInformation = {
				label: `${statusBarItem.text}\n${actionTooltip}`,
			};
		}

		async function getBlameTooltip(
			container: Container,
			getBranchAndTagTips: Awaited<typeof getBranchAndTagTipsPromise> | undefined,
			pr: Promise<PullRequest | undefined> | PullRequest | undefined,
			timeout?: number,
		) {
			return detailsMessage(container, commit, commit.getGitUri(), commit.lines[0].line - 1, {
				autolinks: true,
				cancellation: cancellation,
				dateFormat: defaultDateFormat,
				format: cfg.tooltipFormat,
				getBranchAndTagTips: getBranchAndTagTips,
				pullRequest: pr,
				pullRequests: showPullRequests && pr != null,
				remotes: remotes,
				timeout: timeout,
				sourceName: 'statusbar:hover',
			});
		}

		let prResult: MaybePausedResult<PullRequest | undefined> | undefined;
		if (showPullRequests) {
			// TODO: Make this configurable?
			const timeout = 100;

			prResult = await pauseOnCancelOrTimeout(
				commit.getAssociatedPullRequest(remote),
				cancellation,
				timeout,
				async result => {
					if (result.reason !== 'timedout' || this._statusBarBlame == null) return;

					// If the PR is taking too long, refresh the status bar once it completes

					scope?.warn(`\u2022 pull request query took too long (over ${timeout} ms)`);

					const [getBranchAndTagTipsResult, prResult] = await Promise.allSettled([
						getBranchAndTagTipsPromise,
						result.value,
					]);

					if (cancellation.isCancellationRequested || this._statusBarBlame == null) return;

					const pr = getSettledValue(prResult);
					const getBranchAndTagTips = getSettledValue(getBranchAndTagTipsResult);

					scope?.trace('\u2022  pull request query completed; updating...');

					setBlameText(this._statusBarBlame, getBranchAndTagTips, pr);

					const tooltip = await getBlameTooltip(this.container, getBranchAndTagTips, pr);
					if (tooltip != null) {
						this._statusBarBlame.tooltip = tooltip.appendMarkdown(`\n\n---\n\n${actionTooltip}`);
					}
				},
			);
		}

		const getBranchAndTagTips = getBranchAndTagTipsPromise != null ? await getBranchAndTagTipsPromise : undefined;

		if (cancellation.isCancellationRequested) return;

		setBlameText(this._statusBarBlame, getBranchAndTagTips, prResult?.value);
		this._statusBarBlame.show();

		const tooltipResult = await pauseOnCancelOrTimeout(
			getBlameTooltip(this.container, getBranchAndTagTips, prResult?.value, 20),
			cancellation,
			100,
			async result => {
				if (result.reason !== 'timedout' || this._statusBarBlame == null) return;

				const tooltip = await result.value;
				if (tooltip != null) {
					this._statusBarBlame.tooltip = tooltip.appendMarkdown(`\n\n---\n\n${actionTooltip}`);
				}
			},
		);

		if (!cancellation.isCancellationRequested && !tooltipResult.paused && tooltipResult.value != null) {
			this._statusBarBlame.tooltip = tooltipResult.value.appendMarkdown(`\n\n---\n\n${actionTooltip}`);
		}
	}
}
