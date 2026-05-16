import type { ConfigurationChangeEvent, StatusBarItem } from 'vscode';
import { Disposable, MarkdownString, StatusBarAlignment, ThemeColor, window } from 'vscode';
import type { OpenWalkthroughCommandArgs } from '../../commands/walkthroughs.js';
import type { Colors } from '../../constants.colors.js';
import type { GitCloudHostIntegrationId } from '../../constants.integrations.js';
import { proBadge } from '../../constants.js';
import type { Container } from '../../container.js';
import { createCommand, executeCommand, registerCommand } from '../../system/-webview/command.js';
import { configuration } from '../../system/-webview/configuration.js';
import { once } from '../../system/event.js';
import { groupByMap } from '../../system/iterable.js';
import { wait } from '../../system/promise.js';
import { pluralize } from '../../system/string.js';
import type { ConnectionStateChangeEvent } from '../integrations/integrationService.js';
import type { LaunchpadCommandArgs } from './launchpad.js';
import type { LaunchpadItem, LaunchpadProvider, LaunchpadRefreshEvent } from './launchpadProvider.js';
import { groupAndSortLaunchpadItems, supportedLaunchpadIntegrations } from './launchpadProvider.js';
import type { LaunchpadGroup } from './models/launchpad.js';
import { launchpadGroupIconMap, launchpadPriorityGroups } from './models/launchpad.js';

type LaunchpadIndicatorState = 'idle' | 'disconnected' | 'loading' | 'load' | 'failed';

export class LaunchpadIndicator implements Disposable {
	private readonly _disposable: Disposable;
	private _categorizedItems: LaunchpadItem[] | undefined;
	/** Tracks if this is the first state after startup */
	private _firstStateAfterStartup: boolean = true;
	private _hasRefreshed: boolean = false;
	private _lastDataUpdate: Date | undefined;
	private _lastRefreshPaused: Date | undefined;
	private _refreshTimer: ReturnType<typeof setInterval> | undefined;
	private _state?: LaunchpadIndicatorState;
	private _statusBarLaunchpad!: StatusBarItem;

	constructor(
		private readonly container: Container,
		private readonly provider: LaunchpadProvider,
	) {
		this._disposable = Disposable.from(
			window.onDidChangeWindowState(this.onWindowStateChanged, this),
			provider.onDidChange(this.onLaunchpadChanged, this),
			provider.onDidRefresh(this.onLaunchpadRefreshed, this),
			configuration.onDidChange(this.onConfigurationChanged, this),
			container.integrations.onDidChangeConnectionState(this.onConnectedIntegrationsChanged, this),
			once(container.onReady)(this.onReady, this),
			...this.registerCommands(),
		);
	}

	dispose(): void {
		this.clearRefreshTimer();
		this._statusBarLaunchpad?.dispose();
		this._disposable.dispose();
	}

	private get pollingEnabled() {
		return (
			configuration.get('launchpad.indicator.polling.enabled') &&
			configuration.get('launchpad.indicator.polling.interval') > 0
		);
	}

	private get pollingInterval() {
		return configuration.get('launchpad.indicator.polling.interval') * 1000 * 60;
	}

	private async onConnectedIntegrationsChanged(e: ConnectionStateChangeEvent) {
		if (supportedLaunchpadIntegrations.includes(e.key as GitCloudHostIntegrationId)) {
			await this.maybeLoadData(true);
		}
	}

	private async onConfigurationChanged(e: ConfigurationChangeEvent) {
		if (!configuration.changed(e, 'launchpad.indicator')) return;

		if (configuration.changed(e, 'launchpad.indicator.label')) {
			this.updateStatusBarCommand();
		}

		let load = false;

		if (configuration.changed(e, 'launchpad.indicator.polling')) {
			if (configuration.changed(e, 'launchpad.indicator.polling.enabled')) {
				load = true;
			} else if (configuration.changed(e, 'launchpad.indicator.polling.interval')) {
				this.startRefreshTimer();
			}
		}

		load ||=
			configuration.changed(e, 'launchpad.indicator.useColors') ||
			configuration.changed(e, 'launchpad.indicator.icon') ||
			configuration.changed(e, 'launchpad.indicator.label') ||
			configuration.changed(e, 'launchpad.indicator.groups');

		if (load) {
			await this.maybeLoadData();
		}
	}

	private async maybeLoadData(forceIfConnected: boolean = false) {
		if (this.pollingEnabled) {
			if (await this.provider.hasConnectedIntegration()) {
				if (this._state === 'load' && this._categorizedItems != null && !forceIfConnected) {
					this.updateStatusBarState('load', this._categorizedItems);
				} else {
					this.updateStatusBarState('loading');
				}
			} else {
				this.updateStatusBarState('disconnected');
			}
		} else {
			this.updateStatusBarState('idle');
		}
	}

	private onLaunchpadRefreshed(e: LaunchpadRefreshEvent) {
		this._hasRefreshed = true;
		if (!this.pollingEnabled) {
			this.updateStatusBarState('idle');

			return;
		}

		if (e.error != null) {
			this.updateStatusBarState('failed');

			return;
		}

		this.updateStatusBarState('load', e.items);
	}

	private async onLaunchpadChanged() {
		this._hasRefreshed = false;
		if (!this.pollingEnabled) {
			this.updateStatusBarState('idle');

			return;
		}

		const items = await this.provider.getCategorizedItems();
		if (items.error != null) {
			this.updateStatusBarState('failed');

			return;
		}

		this.updateStatusBarState('load', items.items);
	}

	private async onReady(): Promise<void> {
		this._statusBarLaunchpad = window.createStatusBarItem('gitlens.launchpad', StatusBarAlignment.Left, 10000 - 3);
		this._statusBarLaunchpad.name = 'GitLens Launchpad';

		await this.maybeLoadData();
		this.updateStatusBarCommand();

		this._statusBarLaunchpad.show();
	}

	private onWindowStateChanged(e: { focused: boolean }) {
		if (this._state === 'disconnected' || this._state === 'idle') return;

		if (!e.focused) {
			this.clearRefreshTimer();
			this._lastRefreshPaused = new Date();

			return;
		}

		if (this._lastRefreshPaused == null) return;
		if (this._state === 'loading') {
			this.startRefreshTimer();

			return;
		}

		const now = Date.now();
		const timeSinceLastUpdate = this._lastDataUpdate != null ? now - this._lastDataUpdate.getTime() : undefined;
		const timeSinceLastUnfocused = now - this._lastRefreshPaused.getTime();
		this._lastRefreshPaused = undefined;

		const refreshInterval = configuration.get('launchpad.indicator.polling.interval') * 1000 * 60;

		let timeToNextPoll = timeSinceLastUpdate != null ? refreshInterval - timeSinceLastUpdate : refreshInterval;
		if (timeToNextPoll < 0) {
			timeToNextPoll = 0;
		}

		const diff = timeToNextPoll - timeSinceLastUnfocused;
		this.startRefreshTimer(diff < 0 ? 0 : diff);
	}

	private clearRefreshTimer() {
		if (this._refreshTimer != null) {
			clearInterval(this._refreshTimer);
			this._refreshTimer = undefined;
		}
	}

	private startRefreshTimer(startDelay?: number) {
		const starting = this._firstStateAfterStartup;
		if (starting) {
			this._firstStateAfterStartup = false;
		}

		this.clearRefreshTimer();
		if (!this.pollingEnabled || this._state === 'disconnected') {
			if (this._state !== 'idle' && this._state !== 'disconnected') {
				this.updateStatusBarState('idle');
			}
			return;
		}

		const startRefreshInterval = () => {
			this._refreshTimer = setInterval(() => {
				void this.provider.getCategorizedItems({ force: true });
			}, this.pollingInterval);
		};

		if (startDelay != null) {
			this._refreshTimer = setTimeout(() => {
				startRefreshInterval();

				// If we are loading at startup, wait to give vscode time to settle before querying
				if (starting) {
					// Using a wait here, instead using the `startDelay` to avoid case where the timer could be cancelled if the user focused a different windows before the timer fires (because we will cancel the timer)
					void wait(5000).then(() => {
						// If something else has already caused a refresh, don't do another one
						if (this._hasRefreshed) return;

						void this.provider.getCategorizedItems({ force: true });
					});
				} else {
					void this.provider.getCategorizedItems({ force: true });
				}
			}, startDelay);
		} else {
			startRefreshInterval();
		}
	}

	private updateStatusBarState(state: LaunchpadIndicatorState, categorizedItems?: LaunchpadItem[]) {
		if (state !== 'load' && state === this._state) return;

		this._state = state;
		this._categorizedItems = categorizedItems;

		const tooltip = new MarkdownString('', true);
		tooltip.supportHtml = true;
		tooltip.isTrusted = true;

		tooltip.appendMarkdown(`GitLens Launchpad ${proBadge}\u00a0\u00a0\u00a0\u00a0&mdash;\u00a0\u00a0\u00a0\u00a0`);
		tooltip.appendMarkdown(
			`[$(question)](command:gitlens.launchpad.indicator.action?%22info%22 "\u8fd9\u662f\u4ec0\u4e48\uff1f")`,
		);
		tooltip.appendMarkdown('\u00a0');
		tooltip.appendMarkdown(
			`[$(gear)](command:workbench.action.openSettings?%22gitlens.launchpad%22 "\u8bbe\u7f6e")`,
		);
		tooltip.appendMarkdown('\u00a0\u00a0|\u00a0\u00a0');
		tooltip.appendMarkdown(
			`[$(circle-slash) \u9690\u85cf](command:gitlens.launchpad.indicator.action?%22hide%22 "\u9690\u85cf")`,
		);

		if (
			state === 'idle' ||
			state === 'disconnected' ||
			state === 'loading' ||
			(state === 'load' && !this.hasInteracted())
		) {
			tooltip.appendMarkdown('\n\n---\n\n');
			tooltip.appendMarkdown(
				`[Launchpad](command:gitlens.launchpad.indicator.action?%22info%22 "了解 Launchpad") 将你的拉取请求组织为可操作的分组，帮助你集中注意力并保持团队畅通。`,
			);
			tooltip.appendMarkdown('\n\n你可以随时通过命令面板中的 `GitLens: Open Launchpad` 命令访问它。');
		}

		switch (state) {
			case 'idle':
				this.clearRefreshTimer();
				this._statusBarLaunchpad.text = '$(rocket)';
				this._statusBarLaunchpad.tooltip = tooltip;
				this._statusBarLaunchpad.color = undefined;
				break;

			case 'disconnected':
				this.clearRefreshTimer();
				tooltip.appendMarkdown(
					`\n\n---\n\n[连接集成](command:gitlens.showLaunchpad?%7B%22source%22%3A%22launchpad-indicator%22%7D "连接集成") 以开始使用。`,
				);

				this._statusBarLaunchpad.text = `$(rocket)$(gitlens-unplug) Launchpad`;
				this._statusBarLaunchpad.tooltip = tooltip;
				this._statusBarLaunchpad.color = undefined;
				break;

			case 'loading':
				this.startRefreshTimer(0);
				tooltip.appendMarkdown('\n\n---\n\n$(loading~spin) 加载中...');

				this._statusBarLaunchpad.text = '$(rocket)$(loading~spin)';
				this._statusBarLaunchpad.tooltip = tooltip;
				this._statusBarLaunchpad.color = undefined;
				break;

			case 'load':
				this.updateStatusBarWithItems(tooltip, categorizedItems);
				break;

			case 'failed':
				this.clearRefreshTimer();
				tooltip.appendMarkdown('\n\n---\n\n$(alert) 无法加载项目');

				this._statusBarLaunchpad.text = '$(rocket)$(alert)';
				this._statusBarLaunchpad.tooltip = tooltip;
				this._statusBarLaunchpad.color = undefined;
				break;
		}

		// After the first state change, clear this
		this._firstStateAfterStartup = false;
	}

	private updateStatusBarCommand() {
		const labelType = configuration.get('launchpad.indicator.label') ?? 'item';
		this._statusBarLaunchpad.command = createCommand<[Omit<LaunchpadCommandArgs, 'command'>]>(
			'gitlens.showLaunchpad',
			'Open Launchpad',
			{
				source: 'launchpad-indicator',
				state: { selectTopItem: labelType === 'item' },
			} satisfies Omit<LaunchpadCommandArgs, 'command'>,
		);
	}

	private updateStatusBarWithItems(tooltip: MarkdownString, categorizedItems: LaunchpadItem[] | undefined) {
		this.sendTelemetryFirstLoadEvent();

		this._lastDataUpdate = new Date();
		const useColors = configuration.get('launchpad.indicator.useColors');
		const groups: LaunchpadGroup[] = configuration.get('launchpad.indicator.groups') ?? [];
		const labelType = configuration.get('launchpad.indicator.label') ?? 'item';
		const iconType = configuration.get('launchpad.indicator.icon') ?? 'default';

		let color: string | ThemeColor | undefined = undefined;
		let priorityIcon: `$(${string})` | undefined;
		let priorityItem: { item: LaunchpadItem; groupLabel: string } | undefined;

		const groupedItems = groupAndSortLaunchpadItems(categorizedItems);
		const totalGroupedItems = [...groupedItems.values()].reduce((total, group) => total + group.length, 0);

		const hasImportantGroupsWithItems = groups.some(group => groupedItems.get(group)?.length);
		if (totalGroupedItems === 0) {
			tooltip.appendMarkdown('\n\n---\n\n');
			tooltip.appendMarkdown('已全部处理完毕！');
		} else if (!hasImportantGroupsWithItems) {
			tooltip.appendMarkdown('\n\n---\n\n');
			tooltip.appendMarkdown(`没有需要你关注的拉取请求\\\n(${totalGroupedItems} 个其他拉取请求)`);
		} else {
			for (const group of groups) {
				const items = groupedItems.get(group);
				if (!items?.length) continue;

				if (tooltip.value.length > 0) {
					tooltip.appendMarkdown(`\n\n---\n\n`);
				}

				const icon = launchpadGroupIconMap.get(group)!;
				switch (group) {
					case 'mergeable': {
						priorityIcon ??= icon;
						color = new ThemeColor('gitlens.launchpadIndicatorMergeableColor' satisfies Colors);
						priorityItem ??= { item: items[0], groupLabel: '可以合并' };
						tooltip.appendMarkdown(
							`<span style="color:var(--vscode-gitlens-launchpadIndicatorMergeableHoverColor);">${icon}</span>$(blank) [${
								labelType === 'item' && priorityItem != null
									? this.getPriorityItemLabel(priorityItem.item, items.length)
									: pluralize('pull request', items.length)
							} can be merged](command:gitlens.showLaunchpad?${encodeURIComponent(
								JSON.stringify({
									source: 'launchpad-indicator',
									state: {
										initialGroup: 'mergeable',
										selectTopItem: true,
									},
								} satisfies Omit<LaunchpadCommandArgs, 'command'>),
							)} "在 Launchpad 中打开可合并项")`,
						);
						break;
					}
					case 'blocked': {
						const action = groupByMap(items, i =>
							i.actionableCategory === 'failed-checks' ||
							i.actionableCategory === 'conflicts' ||
							i.actionableCategory === 'unassigned-reviewers'
								? i.actionableCategory
								: 'blocked',
						);

						const hasMultipleCategories = action.size > 1;

						let item: LaunchpadItem | undefined;
						let actionMessage = '';
						let summaryMessage = '(';

						let actionGroupItems = action.get('unassigned-reviewers');
						if (actionGroupItems?.length) {
							actionMessage = '需要审阅者';
							summaryMessage += `${actionGroupItems.length} ${actionMessage}`;
							item ??= actionGroupItems[0];
						}

						actionGroupItems = action.get('failed-checks');
						if (actionGroupItems?.length) {
							actionMessage = `CI 检查失败`;
							summaryMessage += `${hasMultipleCategories ? ', ' : ''}${
								actionGroupItems.length
							} ${actionMessage}`;
							item ??= actionGroupItems[0];
						}

						actionGroupItems = action.get('conflicts');
						if (actionGroupItems?.length) {
							actionMessage = `存在冲突`;
							summaryMessage += `${hasMultipleCategories ? ', ' : ''}${
								actionGroupItems.length
							} ${actionMessage}`;
							item ??= actionGroupItems[0];
						}

						summaryMessage += ')';

						priorityIcon ??= icon;
						color ??= new ThemeColor('gitlens.launchpadIndicatorBlockedColor' satisfies Colors);
						tooltip.appendMarkdown(
							`<span style="color:var(--vscode-gitlens-launchpadIndicatorBlockedColor);">${icon}</span>$(blank) [${
								labelType === 'item' && item != null && priorityItem == null
									? this.getPriorityItemLabel(item, items.length)
									: pluralize('pull request', items.length)
							} ${
								hasMultipleCategories ? '被阻塞' : actionMessage
							}](command:gitlens.showLaunchpad?${encodeURIComponent(
								JSON.stringify({
									source: 'launchpad-indicator',
									state: {
										initialGroup: 'blocked',
										selectTopItem: true,
									},
								} satisfies Omit<LaunchpadCommandArgs, 'command'>),
							)} "在 Launchpad 中打开被阻塞项")`,
						);
						if (hasMultipleCategories) {
							tooltip.appendMarkdown(`\\\n$(blank)$(blank) ${summaryMessage}`);
						}

						if (item != null) {
							let label = '被阻塞';
							if (item.actionableCategory === 'unassigned-reviewers') {
								label = '需要审阅者';
							} else if (item.actionableCategory === 'failed-checks') {
								label = 'CI 检查失败';
							} else if (item.actionableCategory === 'conflicts') {
								label = '存在冲突';
							}
							priorityItem ??= { item: item, groupLabel: label };
						}
						break;
					}
					case 'follow-up': {
						priorityIcon ??= icon;
						color ??= new ThemeColor('gitlens.launchpadIndicatorAttentionColor' satisfies Colors);
						tooltip.appendMarkdown(
							`<span style="color:var(--vscode-gitlens-launchpadIndicatorAttentionHoverColor);">${icon}</span>$(blank) [${
								labelType === 'item' && priorityItem == null && items.length
									? this.getPriorityItemLabel(items[0], items.length)
									: pluralize('pull request', items.length)
							} ${
								items.length > 1 ? 'require' : 'requires'
							} follow-up](command:gitlens.showLaunchpad?${encodeURIComponent(
								JSON.stringify({
									source: 'launchpad-indicator',
									state: {
										initialGroup: 'follow-up',
										selectTopItem: true,
									},
								} satisfies Omit<LaunchpadCommandArgs, 'command'>),
							)} "在 Launchpad 中打开需跟进项")`,
						);
						priorityItem ??= { item: items[0], groupLabel: '需要跟进' };
						break;
					}
					case 'needs-review': {
						priorityIcon ??= icon;
						color ??= new ThemeColor('gitlens.launchpadIndicatorAttentionColor' satisfies Colors);
						tooltip.appendMarkdown(
							`<span style="color:var(--vscode-gitlens-launchpadIndicatorAttentionHoverColor);">${icon}</span>$(blank) [${
								labelType === 'item' && priorityItem == null && items.length
									? this.getPriorityItemLabel(items[0], items.length)
									: pluralize('pull request', items.length)
							} ${
								items.length > 1 ? 'need' : 'needs'
							} your review](command:gitlens.showLaunchpad?${encodeURIComponent(
								JSON.stringify({
									source: 'launchpad-indicator',
									state: {
										initialGroup: 'needs-review',
										selectTopItem: true,
									},
								} satisfies Omit<LaunchpadCommandArgs, 'command'>),
							)} "在 Launchpad 中打开需审阅项")`,
						);
						priorityItem ??= { item: items[0], groupLabel: '需要你审阅' };
						break;
					}
				}
			}
		}

		const iconSegment = iconType === 'group' && priorityIcon != null ? priorityIcon : '$(rocket)';

		let labelSegment;
		switch (labelType) {
			case 'item':
				labelSegment =
					priorityItem != null
						? ` ${this.getPriorityItemLabel(priorityItem.item)} ${priorityItem.groupLabel}`
						: '';
				break;

			case 'counts':
				labelSegment = '';
				for (const group of groups) {
					if (!launchpadPriorityGroups.includes(group)) continue;

					const count = groupedItems.get(group)?.length ?? 0;
					const icon = launchpadGroupIconMap.get(group)!;

					labelSegment +=
						!labelSegment && iconSegment === icon ? `\u00a0${count}` : `\u00a0\u00a0${icon} ${count}`;
				}
				break;

			default:
				labelSegment = '';
				break;
		}

		this._statusBarLaunchpad.text = `${iconSegment}${labelSegment}`;
		this._statusBarLaunchpad.tooltip = tooltip;
		this._statusBarLaunchpad.color = useColors ? color : undefined;
	}

	private registerCommands(): Disposable[] {
		return [
			registerCommand('gitlens.launchpad.indicator.action', async (action: string) => {
				this.storeFirstInteractionIfNeeded();
				switch (action) {
					case 'info': {
						void executeCommand<OpenWalkthroughCommandArgs>('gitlens.openWalkthrough', {
							step: 'accelerate-pr-reviews',
							source: { source: 'launchpad-indicator', detail: 'info' },
						});
						break;
					}
					case 'hide': {
						const hide = { title: '仍然隐藏' };
						const cancel = { title: '取消', isCloseAffordance: true };
						const action = await window.showInformationMessage(
							'GitLens Launchpad 帮助你集中注意力并保持团队畅通。\n\n确定要隐藏指示器吗？',
							{
								modal: true,
								detail: '\n你可以随时通过 "GitLens: Open Launchpad" 命令访问 Launchpad，也可以通过 "GitLens: Toggle Launchpad Indicator" 命令重新启用指示器。',
							},
							hide,
							cancel,
						);
						if (action === hide) {
							void configuration.updateEffective('launchpad.indicator.enabled', false);
						}
						break;
					}
					default:
						break;
				}
			}),
		];
	}

	private getPriorityItemLabel(item: LaunchpadItem, groupLength?: number) {
		return `${item.repository != null ? `${item.repository.owner.login}/${item.repository.name}` : ''}#${item.id}${
			groupLength != null && groupLength > 1
				? ` and ${pluralize('pull request', groupLength - 1, { infix: ' other ' })}`
				: ''
		}`;
	}

	private sendTelemetryFirstLoadEvent() {
		if (!this.container.telemetry.enabled) return;

		const hasLoaded = this.container.storage.get('launchpad:indicator:hasLoaded') ?? false;
		if (!hasLoaded) {
			void this.container.storage.store('launchpad:indicator:hasLoaded', true).catch();
			this.container.telemetry.sendEvent('launchpad/indicator/firstLoad');
		}
	}

	private storeFirstInteractionIfNeeded() {
		if (this.container.storage.get('launchpad:indicator:hasInteracted') != null) return;
		void this.container.storage.store('launchpad:indicator:hasInteracted', new Date().toISOString());
	}

	private hasInteracted() {
		return this.container.storage.get('launchpad:indicator:hasInteracted') != null;
	}
}

export interface LaunchpadSummaryResult {
	total: number;
	groups: LaunchpadGroup[];
	hasGroupedItems: boolean;

	mergeable?: {
		total: number;
	};

	blocked?: {
		total: number;

		blocked: number;
		conflicts: number;
		failedChecks: number;
		unassignedReviewers: number;
	};

	followUp?: {
		total: number;
	};
	needsReview?: {
		total: number;
	};

	snoozed?: {
		total: number;
		items: LaunchpadItem[];
	};
	pinned?: {
		total: number;
		items: LaunchpadItem[];
	};
}

export function generateLaunchpadSummary(
	items: LaunchpadItem[] | undefined,
	groups: LaunchpadGroup[],
): LaunchpadSummaryResult {
	const groupedItems = groupAndSortLaunchpadItems(items);
	const total = [...groupedItems.values()].reduce((total, group) => total + group.length, 0);
	const hasGroupedItems = groups.some(group => groupedItems.get(group)?.length);

	if (total === 0 || !hasGroupedItems) {
		return { total: total, groups: groups, hasGroupedItems: false };
	}

	const result: LaunchpadSummaryResult = { total: total, groups: groups, hasGroupedItems: hasGroupedItems };

	for (const group of groups) {
		const itemsInGroup = groupedItems.get(group);
		if (!itemsInGroup?.length) continue;

		switch (group) {
			case 'mergeable':
				result.mergeable = { total: itemsInGroup.length };
				break;
			case 'blocked': {
				const grouped = groupByMap(itemsInGroup, i =>
					i.actionableCategory === 'failed-checks' ||
					i.actionableCategory === 'conflicts' ||
					i.actionableCategory === 'unassigned-reviewers'
						? i.actionableCategory
						: 'blocked',
				);

				result.blocked = {
					total: itemsInGroup.length,

					blocked: grouped.get('blocked')?.length ?? 0,
					conflicts: grouped.get('conflicts')?.length ?? 0,
					failedChecks: grouped.get('failed-checks')?.length ?? 0,
					unassignedReviewers: grouped.get('unassigned-reviewers')?.length ?? 0,
				};

				break;
			}
			case 'follow-up':
				result.followUp = { total: itemsInGroup.length };
				break;
			case 'needs-review':
				result.needsReview = { total: itemsInGroup.length };
				break;
			case 'snoozed':
				result.snoozed = { items: itemsInGroup, total: itemsInGroup.length };
				break;
			case 'pinned':
				result.pinned = { items: itemsInGroup, total: itemsInGroup.length };
				break;
		}
	}

	return result;
}
