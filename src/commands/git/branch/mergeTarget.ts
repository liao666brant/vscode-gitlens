import { ThemeIcon } from 'vscode';
import type { Container } from '../../../container.js';
import type { GitBranch } from '../../../git/models/branch.js';
import type { GitBranchReference } from '../../../git/models/reference.js';
import type { Repository } from '../../../git/models/repository.js';
import { getReferenceLabel } from '../../../git/utils/reference.utils.js';
import type {
	PartialStepState,
	StepGenerator,
	StepResultGenerator,
	StepsContext,
	StepSelection,
	StepState,
} from '../../quick-wizard/models/steps.js';
import { StepResultBreak } from '../../quick-wizard/models/steps.js';
import type { QuickPickStep } from '../../quick-wizard/models/steps.quickpick.js';
import { QuickCommand } from '../../quick-wizard/quickCommand.js';
import { pickBranchStep, pickOrResetBranchStep } from '../../quick-wizard/steps/branches.js';
import { pickRepositoryStep } from '../../quick-wizard/steps/repositories.js';
import { StepsController } from '../../quick-wizard/stepsController.js';
import {
	appendReposToTitle,
	assertStepState,
	canPickStepContinue,
	createConfirmStep,
} from '../../quick-wizard/utils/steps.utils.js';
import type { BranchContext } from '../branch.js';

const Steps = {
	PickRepo: 'branch-mergeTarget-pick-repo',
	PickBranch: 'branch-mergeTarget-pick-branch',
	PickMergeTargetBranch: 'branch-mergeTarget-pick-merge-target',
	Confirm: 'branch-mergeTarget-confirm',
} as const;
type StepNames = (typeof Steps)[keyof typeof Steps];
export type BranchMergeTargetStepNames = StepNames;

type Context = BranchContext<StepNames>;

interface State<Repo = string | Repository> {
	repo: Repo;
	reference: GitBranchReference | string;
	/** Specifies the desired merge target; use `null` to reset to auto-detected */
	mergeTarget?: GitBranchReference | string | null;
	suggestedMergeTarget?: GitBranchReference | string;
}
export type BranchMergeTargetState = State;

export interface BranchMergeTargetGitCommandArgs {
	readonly command: 'branch-mergeTarget';
	confirm?: boolean;
	state?: Partial<State>;
}

export class BranchMergeTargetGitCommand extends QuickCommand<State> {
	constructor(container: Container, args?: BranchMergeTargetGitCommandArgs) {
		super(container, 'branch-mergeTarget', 'mergeTarget', '更改合并目标', {
			description: '更改分支的合并目标',
		});

		this.initialState = { confirm: args?.confirm, ...args?.state };
	}

	protected createContext(context?: StepsContext<any>): Context {
		return {
			...context,
			container: this.container,
			repos: this.container.git.openRepositories,
			associatedView: this.container.views.branches,
			showTags: false,
			title: this.title,
		};
	}

	protected async *steps(state: PartialStepState<State>, context?: Context): StepGenerator {
		context ??= this.createContext();
		using steps = new StepsController<StepNames>(context, this);

		while (!steps.isComplete) {
			context.title = this.title;

			if (steps.isAtStep(Steps.PickRepo) || state.repo == null || typeof state.repo === 'string') {
				// Only show the picker if there are multiple repositories
				if (context.repos.length === 1) {
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

			assertStepState<State<Repository>>(state);

			if (steps.isAtStep(Steps.PickBranch) || state.reference == null) {
				using step = steps.enterStep(Steps.PickBranch);

				const result = yield* pickBranchStep(state, context, {
					filter: (b: GitBranch) => !b.remote,
					picked: typeof state.reference === 'string' ? state.reference : state.reference?.ref,
					placeholder: '选择要更改合并目标的分支',
				});
				if (result === StepResultBreak) {
					state.reference = undefined!;
					if (step.goBack() == null) break;
					continue;
				}

				state.reference = result;
			}

			const refName = typeof state.reference === 'string' ? state.reference : state.reference?.name;
			const svc = this.container.git.getRepositoryService(state.repo.uri);

			if (
				steps.isAtStep(Steps.PickMergeTargetBranch) ||
				state.mergeTarget === undefined /* explicit undefined as null signifies "reset" */
			) {
				using step = steps.enterStep(Steps.PickMergeTargetBranch);

				const detectedMergeTarget = await svc.branches.getStoredDetectedMergeTargetBranchName?.(refName);
				const userMergeTarget = await svc.branches.getStoredUserMergeTargetBranchName?.(refName);

				const suggestedMergeTarget =
					(typeof state.mergeTarget === 'string' ? state.mergeTarget : undefined) ??
					(typeof state.suggestedMergeTarget === 'string' ? state.suggestedMergeTarget : undefined) ??
					userMergeTarget ??
					detectedMergeTarget ??
					(await svc.branches.getBaseBranchName?.(refName));

				const result = yield* pickOrResetBranchStep(state, context, {
					filter: (b: GitBranch) => b.remote && b.name !== refName,
					placeholder: '选择合并目标分支',
					picked: suggestedMergeTarget,
					reset:
						userMergeTarget != null /* && detectedMergeTarget !== userMergeTarget*/
							? {
									label: '重置合并目标',
									detail: '将合并目标分支重置为自动检测',
									button: { icon: new ThemeIcon('discard'), tooltip: '重置合并目标' },
								}
							: undefined,
				});
				if (result === StepResultBreak) {
					state.mergeTarget = undefined;
					if (step.goBack() == null) break;
					continue;
				}

				state.mergeTarget = result ?? null;
			}

			if (!steps.isAtStepOrUnset(Steps.Confirm)) continue;

			{
				using step = steps.enterStep(Steps.Confirm);

				const result = yield* this.confirmStep(state, context);
				if (result === StepResultBreak) {
					if (step.goBack() == null) break;
					continue;
				}
			}

			steps.markStepsComplete();

			const mergeTargetName = typeof state.mergeTarget === 'string' ? state.mergeTarget : state.mergeTarget?.name;
			await svc.branches.storeUserMergeTargetBranchName?.(refName, mergeTargetName);
		}

		return steps.isComplete ? undefined : StepResultBreak;
	}

	private *confirmStep(state: StepState<State<Repository>>, context: Context): StepResultGenerator<void> {
		const referenceLabel =
			typeof state.reference === 'string' ? state.reference : getReferenceLabel(state.reference);
		const mergeTargetLabel =
			typeof state.mergeTarget === 'string'
				? state.mergeTarget
				: state.mergeTarget
					? getReferenceLabel(state.mergeTarget, { label: false })
					: undefined;

		let title;
		let detail;
		if (state.mergeTarget == null) {
			title = '重置合并目标';
			detail = `将把 ${referenceLabel} 的合并目标重置为自动检测`;
		} else {
			title = '更改合并目标';
			detail = `将把 ${referenceLabel} 的合并目标设为 ${mergeTargetLabel}`;
		}

		const step: QuickPickStep = createConfirmStep(
			appendReposToTitle(`确认${title}`, state, context),
			[{ label: title, detail: detail }],
			context,
		);
		const selection: StepSelection<typeof step> = yield step;
		return canPickStepContinue(step, state, selection) ? undefined : StepResultBreak;
	}
}
