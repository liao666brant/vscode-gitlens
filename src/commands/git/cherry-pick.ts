import { ThemeIcon, window } from 'vscode';
import { CherryPickError, SigningError } from '@gitlens/git/errors.js';
import type { GitBranch } from '@gitlens/git/models/branch.js';
import type { GitLog } from '@gitlens/git/models/log.js';
import type { ConflictDetectionResult } from '@gitlens/git/models/mergeConflicts.js';
import type { GitPausedOperationStatus } from '@gitlens/git/models/pausedOperationStatus.js';
import type { GitReference } from '@gitlens/git/models/reference.js';
import { getReferenceLabel, isRevisionReference } from '@gitlens/git/utils/reference.utils.js';
import { createRevisionRange } from '@gitlens/git/utils/revision.utils.js';
import { ensureArray } from '@gitlens/utils/array.js';
import { Logger } from '@gitlens/utils/logger.js';
import type { Container } from '../../container.js';
import { skipPausedOperation } from '../../git/actions/pausedOperation.js';
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
import { QuickCommand } from '../quick-wizard/quickCommand.js';
import { pickCommitsStep } from '../quick-wizard/steps/commits.js';
import { pickBranchOrTagStep } from '../quick-wizard/steps/references.js';
import { canSkipRepositoryPick, pickRepositoryStep } from '../quick-wizard/steps/repositories.js';
import { StepsController } from '../quick-wizard/stepsController.js';
import { appendReposToTitle, assertStepState, canPickStepContinue } from '../quick-wizard/utils/steps.utils.js';

const Steps = {
	PickRepo: 'cherry-pick-pick-repo',
	PickBranchOrTag: 'cherry-pick-pick-branch-or-tag',
	PickCommits: 'cherry-pick-pick-commits',
	Confirm: 'cherry-pick-confirm',
} as const;
type StepNames = (typeof Steps)[keyof typeof Steps];

interface Context extends StepsContext<StepNames> {
	repos: GlRepository[];
	associatedView: ViewsWithRepositoryFolders;
	cache: Map<string, Promise<GitLog | undefined>>;
	destination: GitBranch;
	selectedBranchOrTag: GitReference | undefined;
	showTags: boolean;
	title: string;
}

type Flags = '--edit' | '--no-commit';
interface State<Repo = string | GlRepository, Refs = GitReference | GitReference[]> {
	repo: Repo;
	references: Refs;
	flags: Flags[];
}

export interface CherryPickGitCommandArgs {
	readonly command: 'cherry-pick';
	state?: Partial<State>;
}

export class CherryPickGitCommand extends QuickCommand<State> {
	constructor(container: Container, args?: CherryPickGitCommandArgs) {
		super(container, 'cherry-pick', 'cherry-pick', '拣选提交', {
			description: '将指定提交的更改合入当前分支',
		});

		this.initialState = { confirm: true, ...args?.state };
	}

	override get canSkipConfirm(): boolean {
		return false;
	}

	private async execute(state: StepState<State<GlRepository, GitReference[]>>) {
		this.container.telemetry.sendEvent('gitCommand/run', { command: 'cherry-pick' });

		try {
			const result = await state.repo.git.ops?.cherryPick?.(
				state.references.map(c => c.ref),
				{
					edit: state.flags.includes('--edit'),
					noCommit: state.flags.includes('--no-commit'),
				},
			);
			if (result?.conflicted) {
				void window.showWarningMessage(
					'Unable to cherry-pick due to conflicts. Resolve the conflicts before continuing, or abort the cherry-pick.',
				);
				void executeCommand('gitlens.showCommitsView');
			}
		} catch (ex) {
			// Don't show an error message if the user intentionally aborted the cherry-pick
			if (CherryPickError.is(ex, 'aborted')) {
				Logger.debug(ex.message, this.title);
				return;
			}

			Logger.error(ex, this.title);

			if (CherryPickError.is(ex, 'wouldOverwriteChanges')) {
				void window.showWarningMessage('无法执行拣选提交。你的本地更改会被覆盖。请先提交或暂存更改后再试。');
				return;
			}

			if (CherryPickError.is(ex, 'conflicts')) {
				this.container.telemetry.sendEvent('gitCommand/conflict', { command: 'cherry-pick' });
				void window.showWarningMessage(
					'由于存在冲突，无法执行拣选提交。请先解决冲突再继续，或中止本次拣选提交。',
				);
				void executeCommand('gitlens.showCommitsView');
				return;
			}

			if (CherryPickError.is(ex, 'alreadyInProgress')) {
				void window.showWarningMessage(
					'无法执行拣选提交。当前已有拣选提交正在进行。请先继续或中止当前拣选提交。',
				);
				void executeCommand('gitlens.showCommitsView');
				return;
			}

			if (CherryPickError.is(ex, 'emptyCommit')) {
				let pausedOperation: GitPausedOperationStatus | undefined;
				try {
					pausedOperation = await state.repo.git.pausedOps?.getPausedOperationStatus?.();
					pausedOperation ??= await state.repo
						.waitForRepoChange(500)
						.then(() => state.repo.git.pausedOps?.getPausedOperationStatus?.());
				} catch {}

				const pausedAt = pausedOperation
					? getReferenceLabel(pausedOperation?.incoming, { icon: false, label: true, quoted: true })
					: undefined;

				const skip = { title: '跳过' };
				const cancel = { title: '取消', isCloseAffordance: true };
				const result = await window.showInformationMessage(
					`无法完成拣选提交操作，因为 ${pausedAt ?? '该提交'} 产生了空提交。\n\n是否要跳过 ${pausedAt ?? '该提交'}？`,
					{ modal: true },
					skip,
					cancel,
				);
				if (result === skip) {
					return void skipPausedOperation(state.repo.git);
				}

				void executeCommand('gitlens.showCommitsView');
				return;
			}

			void showGitErrorMessage(
				ex,
				CherryPickError.is(ex) || SigningError.is(ex) ? undefined : '无法执行拣选提交',
			);
		}
	}

	override isFuzzyMatch(name: string): boolean {
		return super.isFuzzyMatch(name) || name === 'cherry';
	}

	protected createContext(context?: StepsContext<any>): Context {
		return {
			...context,
			container: this.container,
			repos: this.container.git.openRepositories,
			associatedView: this.container.views.commits,
			cache: new Map<string, Promise<GitLog | undefined>>(),
			destination: undefined!,
			selectedBranchOrTag: undefined,
			showTags: true,
			title: this.title,
		};
	}

	protected async *steps(state: PartialStepState<State>, context?: Context): StepGenerator {
		context = this.createContext();
		using steps = new StepsController<StepNames>(context, this);

		state.flags ??= [];

		if (state.references != null && !Array.isArray(state.references)) {
			state.references = [state.references];
		}

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

			context.title = `${this.title} into ${getReferenceLabel(context.destination, {
				icon: false,
				label: false,
			})}`;

			if (steps.isAtStep(Steps.PickBranchOrTag) || !state.references?.length) {
				using step = steps.enterStep(Steps.PickBranchOrTag);

				const result: StepResult<GitReference> = yield* pickBranchOrTagStep(state, context, {
					filter: { branches: b => b.id !== context.destination.id },
					placeholder: context => `选择要从中拣选提交的分支${context.showTags ? '或标签' : ''}`,
					picked: context.selectedBranchOrTag?.ref,
					value: context.selectedBranchOrTag == null ? state.references?.[0]?.ref : undefined,
				});
				if (result === StepResultBreak) {
					state.references = undefined!;
					if (step.goBack() == null) break;
					continue;
				}

				if (isRevisionReference(result)) {
					state.references = [result];
					context.selectedBranchOrTag = undefined;
				} else {
					context.selectedBranchOrTag = result;
				}
			}

			if (context.selectedBranchOrTag == null && state.references?.length) {
				const branches: string[] = await state.repo.git.branches.getBranchesWithCommits(
					state.references.map(r => r.ref),
					undefined,
					{ mode: 'contains' },
				);
				if (branches.length) {
					const branch = await state.repo.git.branches.getBranch(branches[0]);
					if (branch != null) {
						context.selectedBranchOrTag = branch;
					}
				}
			}

			if (
				context.selectedBranchOrTag != null &&
				(steps.isAtStep(Steps.PickCommits) || !state.references?.length)
			) {
				using step = steps.enterStep(Steps.PickCommits);

				const rev = createRevisionRange(context.destination.ref, context.selectedBranchOrTag.ref, '..');

				let log = context.cache.get(rev);
				if (log == null) {
					log = state.repo.git.commits.getLog(rev, { merges: 'first-parent' });
					context.cache.set(rev, log);
				}

				const result: StepResult<GitReference[]> = yield* pickCommitsStep(state, context, {
					emptyItems: [
						createDirectiveQuickPickItem(Directive.Cancel, true, {
							label: '确定',
							detail: `在 ${getReferenceLabel(context.selectedBranchOrTag, { icon: false })} 上未找到可拣选的提交`,
						}),
					],
					log: await log,
					onDidLoadMore: log => context.cache.set(rev, Promise.resolve(log)),
					picked: state.references?.map(r => r.ref),
					placeholder: (context, log) =>
						!log?.commits.size
							? `在 ${getReferenceLabel(context.selectedBranchOrTag, { icon: false })} 上未找到可拣选的提交`
							: `选择要拣选到 ${getReferenceLabel(context.destination, { icon: false })} 的提交`,
				});
				if (result === StepResultBreak) {
					state.references = undefined!;
					if (step.goBack() == null) break;
					continue;
				}

				state.references = result;
			}

			assertStepState<State<GlRepository, GitReference[]>>(state);

			if (this.confirm(state.confirm)) {
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
		state: StepState<State<GlRepository, GitReference[]>>,
		context: Context,
	): AsyncStepResultGenerator<Flags[]> {
		const items: FlagsQuickPickItem<Flags>[] = [
			createFlagsQuickPickItem<Flags>(state.flags, [], {
				label: this.title,
				detail: `将把 ${getReferenceLabel(state.references, { label: false })} 应用到 ${getReferenceLabel(
					context.destination,
					{ label: false },
				)}`,
			}),
			createFlagsQuickPickItem<Flags>(state.flags, ['--edit'], {
				label: `${this.title} 并编辑`,
				description: '--edit',
				detail: `将编辑并把 ${getReferenceLabel(state.references, {
					label: false,
				})} 应用到 ${getReferenceLabel(context.destination, {
					label: false,
				})}`,
			}),
			createFlagsQuickPickItem<Flags>(state.flags, ['--no-commit'], {
				label: `${this.title} 且不提交`,
				description: '--no-commit',
				detail: `将把 ${getReferenceLabel(state.references, { label: false })} 应用到 ${getReferenceLabel(
					context.destination,
					{ label: false },
				)}，但不提交`,
			}),
		];

		let potentialConflict: Promise<ConflictDetectionResult | undefined> | undefined;
		const subscription = await this.container.subscription.getSubscription();
		if (isSubscriptionTrialOrPaidFromState(subscription?.state)) {
			// Reverse the commits since they're typically in newest-to-oldest order (from git log),
			// but conflict detection needs oldest-to-newest order to properly simulate cherry-pick
			potentialConflict = state.repo.git.branches.getPotentialApplyConflicts?.(
				context.destination.name,
				ensureArray(state.references)
					.map(r => r.ref)
					.reverse(),
				{ stopOnFirstConflict: true },
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
							detail: `将产生${result.stoppedOnFirstConflict ? '至少 ' : ''}${result.conflict.files.length} 个需要解决的冲突文件`,
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

		step = this.createConfirmStep(appendReposToTitle(`确认 ${context.title}`, state, context), [
			...notices,
			...items,
		]);
		const selection: StepSelection<typeof step> = yield step;
		return canPickStepContinue(step, state, selection) ? selection[0].item : StepResultBreak;
	}
}
