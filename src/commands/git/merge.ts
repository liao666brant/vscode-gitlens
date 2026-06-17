import { ThemeIcon, window } from 'vscode';
import { MergeError, SigningError } from '@gitlens/git/errors.js';
import type { GitBranch } from '@gitlens/git/models/branch.js';
import type { GitLog } from '@gitlens/git/models/log.js';
import type { ConflictDetectionResult } from '@gitlens/git/models/mergeConflicts.js';
import type { GitReference } from '@gitlens/git/models/reference.js';
import { getReferenceLabel, isRevisionReference } from '@gitlens/git/utils/reference.utils.js';
import { createRevisionRange } from '@gitlens/git/utils/revision.utils.js';
import { Logger } from '@gitlens/utils/logger.js';
import { pluralize } from '@gitlens/utils/string.js';
import type { Container } from '../../container.js';
import type { GlRepository } from '../../git/models/repository.js';
import { showGitErrorMessage } from '../../messages.js';
import { isSubscriptionTrialOrPaidFromState } from '../../plus/gk/utils/subscription.utils.js';
import { createQuickPickSeparator } from '../../quickpicks/items/common.js';
import type { DirectiveQuickPickItem } from '../../quickpicks/items/directive.js';
import { createDirectiveQuickPickItem, Directive } from '../../quickpicks/items/directive.js';
import type { FlagsQuickPickItem } from '../../quickpicks/items/flags.js';
import { createFlagsQuickPickItem } from '../../quickpicks/items/flags.js';
import { executeCommand } from '../../system/-webview/command.js';
import type { ViewsWithRepositoryFolders } from '../../views/viewBase.js';
import type {
	AsyncStepResultGenerator,
	PartialStepState,
	StepGenerator,
	StepResult,
	StepsContext,
	StepSelection,
	StepState,
} from '../quick-wizard/models/steps.js';
import { StepResultBreak } from '../quick-wizard/models/steps.js';
import type { QuickPickStep } from '../quick-wizard/models/steps.quickpick.js';
import { PickCommitToggleQuickInputButton } from '../quick-wizard/quickButtons.js';
import { QuickCommand } from '../quick-wizard/quickCommand.js';
import { pickCommitStep } from '../quick-wizard/steps/commits.js';
import { pickBranchOrTagStep } from '../quick-wizard/steps/references.js';
import { canSkipRepositoryPick, pickRepositoryStep } from '../quick-wizard/steps/repositories.js';
import { StepsController } from '../quick-wizard/stepsController.js';
import { appendReposToTitle, assertStepState, canPickStepContinue } from '../quick-wizard/utils/steps.utils.js';

const Steps = {
	PickRepo: 'merge-pick-repo',
	PickBranchOrTag: 'merge-pick-branch-or-tag',
	PickCommit: 'merge-pick-commit',
	Confirm: 'merge-confirm',
} as const;
type StepNames = (typeof Steps)[keyof typeof Steps];

interface Context extends StepsContext<StepNames> {
	repos: GlRepository[];
	associatedView: ViewsWithRepositoryFolders;
	cache: Map<string, Promise<GitLog | undefined>>;
	destination: GitBranch;
	pickCommit: boolean;
	pickCommitForItem: boolean;
	selectedBranchOrTag: GitReference | undefined;
	showTags: boolean;
	title: string;
}

type Flags = '--ff-only' | '--no-ff' | '--squash' | '--no-commit';
interface State<Repo = string | GlRepository> {
	repo: Repo;
	reference: GitReference;
	flags: Flags[];
}

export interface MergeGitCommandArgs {
	readonly command: 'merge';
	state?: Partial<State>;
}

function formatCommitCount(count: number | undefined) {
	return `${count ?? 0} 个提交`;
}

export class MergeGitCommand extends QuickCommand<State> {
	constructor(container: Container, args?: MergeGitCommandArgs) {
		super(container, 'merge', 'merge', '合并', {
			description: '将指定分支的更改合并到当前分支',
		});

		this.initialState = { confirm: true, ...args?.state };
	}

	override get canSkipConfirm(): boolean {
		return false;
	}

	private async execute(state: StepState<State<GlRepository>>) {
		const options: { fastForward?: boolean | 'only'; noCommit?: boolean; squash?: boolean } = {};

		if (state.flags.includes('--ff-only')) {
			options.fastForward = 'only';
		} else if (state.flags.includes('--no-ff')) {
			options.fastForward = false;
		}
		if (state.flags.includes('--squash')) {
			options.squash = true;
		}
		if (state.flags.includes('--no-commit')) {
			options.noCommit = true;
		}

		this.container.telemetry.sendEvent('gitCommand/run', { command: 'merge' });

		try {
			const result = await state.repo.git.ops?.merge(state.reference.ref, options);
			if (result?.conflicted) {
				void window.showWarningMessage(
					'Unable to merge due to conflicts. Resolve the conflicts before continuing, or abort the merge.',
				);
				void executeCommand('gitlens.showCommitsView');
			}
		} catch (ex) {
			// Don't show an error message if the user intentionally aborted the merge
			if (MergeError.is(ex, 'aborted')) {
				Logger.debug(ex.message, this.title);
				return;
			}

			Logger.error(ex, this.title);

			if (MergeError.is(ex, 'uncommittedChanges') || MergeError.is(ex, 'wouldOverwriteChanges')) {
				void window.showWarningMessage('无法合并。你的本地更改会被覆盖。请先提交或存储更改后再试。');
				return;
			}

			if (MergeError.is(ex, 'conflicts')) {
				this.container.telemetry.sendEvent('gitCommand/conflict', { command: 'merge' });
				void window.showWarningMessage('由于存在冲突，无法合并。请先解决冲突再继续，或中止本次合并。');
				void executeCommand('gitlens.showCommitsView');
				return;
			}

			if (MergeError.is(ex, 'alreadyInProgress')) {
				void window.showWarningMessage('无法合并。当前已有合并正在进行。请先继续或中止当前合并。');
				void executeCommand('gitlens.showCommitsView');
				return;
			}

			void showGitErrorMessage(ex, MergeError.is(ex) || SigningError.is(ex) ? undefined : '无法合并');
		}
	}

	protected createContext(context?: StepsContext<any>): Context {
		return {
			...context,
			container: this.container,
			repos: this.container.git.openRepositories,
			associatedView: this.container.views.commits,
			cache: new Map<string, Promise<GitLog | undefined>>(),
			destination: undefined!,
			pickCommit: false,
			pickCommitForItem: false,
			selectedBranchOrTag: undefined,
			showTags: true,
			title: this.title,
		};
	}

	protected async *steps(state: PartialStepState<State>, context?: Context): StepGenerator {
		context ??= this.createContext();
		using steps = new StepsController<StepNames>(context, this);

		state.flags ??= [];

		while (!steps.isComplete) {
			context.title = this.title;

			if (steps.isAtStep(Steps.PickRepo) || state.repo == null || typeof state.repo === 'string') {
				// Skip the picker only when the sole available repo is the one requested
				if (canSkipRepositoryPick(context.repos, state.repo)) {
					[state.repo] = context.repos;
				} else {
					using step = steps.enterStep(Steps.PickRepo);

					const result = yield* pickRepositoryStep(state, context, step);
					if (result === StepResultBreak) {
						state.repo = undefined!;
						if (step.goBack() == null) break;
						continue;
					}

					state.repo = result;
				}
			}

			assertStepState<State<GlRepository>>(state);

			if (context.destination == null) {
				const branch = await state.repo.git.branches.getBranch();
				if (branch == null) break;

				context.destination = branch;
			}

			context.title = `${this.title}到 ${getReferenceLabel(context.destination, {
				icon: false,
				label: false,
			})}`;
			context.pickCommitForItem = false;

			if (steps.isAtStep(Steps.PickBranchOrTag) || state.reference == null) {
				using step = steps.enterStep(Steps.PickBranchOrTag);

				const pickCommitToggle = new PickCommitToggleQuickInputButton(context.pickCommit, context, () => {
					context.pickCommit = !context.pickCommit;
					pickCommitToggle.on = context.pickCommit;
				});

				const result: StepResult<GitReference> = yield* pickBranchOrTagStep(state, context, {
					placeholder: context => `选择要合并的分支${context.showTags ? '或标签' : ''}`,
					picked: context.selectedBranchOrTag?.ref,
					value: context.selectedBranchOrTag == null ? state.reference?.ref : undefined,
					additionalButtons: [pickCommitToggle],
				});
				if (result === StepResultBreak) {
					state.reference = undefined!;
					if (step.goBack() == null) break;
					continue;
				}

				state.reference = result;
				context.selectedBranchOrTag = undefined;
			}

			if (!isRevisionReference(state.reference)) {
				context.selectedBranchOrTag = state.reference;
			}

			if (
				context.selectedBranchOrTag != null &&
				(steps.isAtStep(Steps.PickCommit) ||
					context.pickCommit ||
					context.pickCommitForItem ||
					state.reference.ref === context.destination.ref)
			) {
				using step = steps.enterStep(Steps.PickCommit);

				const rev = context.selectedBranchOrTag.ref;

				let log = context.cache.get(rev);
				if (log == null) {
					log = state.repo.git.commits.getLog(rev, { merges: 'first-parent' });
					context.cache.set(rev, log);
				}

				const result: StepResult<GitReference> = yield* pickCommitStep(state, context, {
					emptyItems: [
						createDirectiveQuickPickItem(Directive.Cancel, true, {
							label: '确定',
							detail: `在 ${getReferenceLabel(context.selectedBranchOrTag, { icon: false })} 上未找到提交`,
						}),
					],
					ignoreFocusOut: true,
					log: await log,
					onDidLoadMore: log => context.cache.set(rev, Promise.resolve(log)),
					placeholder: (context, log) =>
						!log?.commits.size
							? `在 ${getReferenceLabel(context.selectedBranchOrTag, { icon: false })} 上未找到提交`
							: `选择要合并到 ${getReferenceLabel(context.destination, { icon: false })} 的提交`,
					picked: state.reference?.ref,
				});
				if (result === StepResultBreak) {
					if (step.goBack() == null) break;
					continue;
				}

				state.reference = result;
			}

			{
				using step = steps.enterStep(Steps.Confirm);

				const result = yield* this.confirmStep(state, context);
				if (result === StepResultBreak) {
					state.flags = [];
					if (step.goBack() == null) break;
					continue;
				}

				state.flags = result;
			}

			steps.markStepsComplete();

			void this.execute(state);
		}

		return steps.isComplete ? undefined : StepResultBreak;
	}

	private async *confirmStep(
		state: StepState<State<GlRepository>>,
		context: Context,
	): AsyncStepResultGenerator<Flags[]> {
		const counts = await state.repo.git.commits.getLeftRightCommitCount(
			createRevisionRange(context.destination.ref, state.reference.ref, '...'),
		);

		const title = `将 ${getReferenceLabel(state.reference, { icon: false, label: false })} 合并到 ${getReferenceLabel(context.destination, { icon: false, label: false })}`;
		const count = counts != null ? counts.right : 0;
		if (count === 0) {
			const step: QuickPickStep<DirectiveQuickPickItem> = this.createConfirmStep(
				appendReposToTitle(`确认${title}`, state, context),
				[],
				createDirectiveQuickPickItem(Directive.Cancel, true, {
					label: '确定',
					detail: `${getReferenceLabel(context.destination, {
						capitalize: true,
						label: false,
					})} 已与 ${getReferenceLabel(state.reference, { label: false })} 保持同步`,
				}),
				{
					placeholder: `无可合并内容；${getReferenceLabel(context.destination, {
						label: false,
						icon: false,
					})} 已保持最新`,
				},
			);
			const selection: StepSelection<typeof step> = yield step;
			canPickStepContinue(step, state, selection);
			return StepResultBreak;
		}

		const items = [
			createFlagsQuickPickItem<Flags>(state.flags, [], {
				label: this.title,
				detail: `将把 ${getReferenceLabel(state.reference, {
					label: false,
				})} 的 ${formatCommitCount(count)} 合并到 ${getReferenceLabel(context.destination, { label: false })}`,
				picked: true,
			}),
			createFlagsQuickPickItem<Flags>(state.flags, ['--ff-only'], {
				label: `快进${this.title}`,
				description: '--ff-only',
				detail: `将通过快进方式把 ${getReferenceLabel(state.reference, {
					label: false,
				})} 的 ${formatCommitCount(count)} 合并到 ${getReferenceLabel(context.destination, { label: false })}`,
			}),
			createFlagsQuickPickItem<Flags>(state.flags, ['--squash'], {
				label: `压缩${this.title}`,
				description: '--squash',
				detail: `将把 ${getReferenceLabel(state.reference, {
					label: false,
				})} 的 ${formatCommitCount(count)} 压缩为一个提交后再合并到 ${getReferenceLabel(context.destination, { label: false })}`,
			}),
			createFlagsQuickPickItem<Flags>(state.flags, ['--no-ff'], {
				label: `非快进${this.title}`,
				description: '--no-ff',
				detail: `合并 ${getReferenceLabel(state.reference, {
					label: false,
				})} 的 ${formatCommitCount(count)} 到 ${getReferenceLabel(context.destination, { label: false })} 时将创建合并提交`,
			}),
			createFlagsQuickPickItem<Flags>(state.flags, ['--no-ff', '--no-commit'], {
				label: `先不提交${this.title}`,
				description: '--no-commit --no-ff',
				detail: `在将 ${getReferenceLabel(state.reference, {
					label: false,
				})} 的 ${formatCommitCount(count)} 合并到 ${getReferenceLabel(context.destination, { label: false })} 后，先暂停并等待你手动提交`,
			}),
		];

		let potentialConflict: Promise<ConflictDetectionResult | undefined> | undefined;
		const subscription = await this.container.subscription.getSubscription();
		if (isSubscriptionTrialOrPaidFromState(subscription?.state)) {
			potentialConflict = state.repo.git.branches.getPotentialMergeConflicts?.(
				state.reference.name,
				context.destination.name,
			);
		}

		let step: QuickPickStep<DirectiveQuickPickItem | FlagsQuickPickItem<Flags>>;

		const notices: DirectiveQuickPickItem[] = [];
		if (potentialConflict) {
			void potentialConflict?.then(result => {
				if (result == null || result.status === 'clean') {
					notices.splice(
						0,
						1,
						createDirectiveQuickPickItem(Directive.Noop, false, {
							label: '未检测到冲突',
							iconPath: new ThemeIcon('check'),
						}),
					);
				} else if (result.status === 'error') {
					notices.splice(
						0,
						1,
						createDirectiveQuickPickItem(Directive.Noop, false, {
							label: '无法检测冲突',
							detail: result.message,
							iconPath: new ThemeIcon('error'),
						}),
					);
				} else {
					notices.splice(
						0,
						1,
						createDirectiveQuickPickItem(Directive.Noop, false, {
							label: '检测到冲突',
							detail: `将产生 ${result.conflict.files.length} 个需要解决的冲突文件`,
							iconPath: new ThemeIcon('warning'),
						}),
					);
				}

				if (step.quickpick != null) {
					const active = step.quickpick.activeItems;
					step.quickpick.items = [
						...notices,
						...items,
						createQuickPickSeparator(),
						createDirectiveQuickPickItem(Directive.Cancel),
					];
					step.quickpick.activeItems = active;
				}
			});

			notices.push(
				createDirectiveQuickPickItem(Directive.Noop, false, {
					label: `$(loading~spin) \u00a0正在检测冲突...`,
					// Don't use this, because the spin here causes the icon to spin incorrectly
					//iconPath: new ThemeIcon('loading~spin'),
				}),
				createQuickPickSeparator(),
			);
		}

		step = this.createConfirmStep(appendReposToTitle(`确认${title}`, state, context), [...notices, ...items]);
		const selection: StepSelection<typeof step> = yield step;
		return canPickStepContinue(step, state, selection) ? selection[0].item : StepResultBreak;
	}
}
