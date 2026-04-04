import { window } from 'vscode';
import type { Container } from '../../../container.js';
import { revealStash, showStashInDetailsView } from '../../../git/actions/stash.js';
import { StashApplyError } from '../../../git/errors.js';
import type { GitStashReference } from '../../../git/models/reference.js';
import type { Repository } from '../../../git/models/repository.js';
import { getReferenceLabel } from '../../../git/utils/reference.utils.js';
import { showGitErrorMessage } from '../../../messages.js';
import { Logger } from '../../../system/logger.js';
import type {
	PartialStepState,
	StepGenerator,
	StepResult,
	StepResultGenerator,
	StepsContext,
	StepSelection,
	StepState,
} from '../../quick-wizard/models/steps.js';
import { StepResultBreak } from '../../quick-wizard/models/steps.js';
import { RevealInSideBarQuickInputButton, ShowDetailsViewQuickInputButton } from '../../quick-wizard/quickButtons.js';
import { QuickCommand } from '../../quick-wizard/quickCommand.js';
import { pickRepositoryStep } from '../../quick-wizard/steps/repositories.js';
import { pickStashStep } from '../../quick-wizard/steps/stashes.js';
import { StepsController } from '../../quick-wizard/stepsController.js';
import { appendReposToTitle, assertStepState, canPickStepContinue } from '../../quick-wizard/utils/steps.utils.js';
import type { StashContext } from '../stash.js';

const Steps = {
	PickRepo: 'stash-apply-or-pop-pick-repo',
	PickStash: 'stash-apply-or-pop-pick-stash',
	Confirm: 'stash-apply-or-pop-confirm',
} as const;
type StepNames = (typeof Steps)[keyof typeof Steps];
export type StashApplyOrPopStepNames = StepNames;

type Context = StashContext<StepNames>;

type Mode = 'apply' | 'pop';
interface State<Repo = string | Repository> {
	mode: Mode;
	repo: Repo;
	reference: GitStashReference;
}
export type StashApplyOrPopState = State;

export interface StashApplyOrPopGitCommandArgs {
	readonly command: 'stash-apply' | 'stash-pop';
	confirm?: boolean;
	state?: Partial<State>;
}

export class StashApplyOrPopGitCommand extends QuickCommand<State> {
	private readonly mode: Mode;

	constructor(container: Container, args?: StashApplyOrPopGitCommandArgs) {
		const mode = args?.command === 'stash-pop' ? 'pop' : 'apply';
		super(container, `stash.${mode}`, mode, mode === 'pop' ? '弹出存储' : '应用存储', {
			description: mode === 'pop' ? '应用并删除存储' : '将存储应用到工作树',
		});

		this.mode = mode;
		this.initialState = { confirm: args?.confirm, mode: mode, ...args?.state };
	}

	protected createContext(context?: StepsContext<any>): Context {
		return {
			...context,
			container: this.container,
			repos: this.container.git.openRepositories,
			associatedView: this.container.views.stashes,
			readonly: false,
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

			if (steps.isAtStep(Steps.PickStash) || state.reference == null) {
				using step = steps.enterStep(Steps.PickStash);

				const result: StepResult<GitStashReference> = yield* pickStashStep(state, context, {
					stash: await state.repo.git.stash?.getStash(),
					placeholder: (_context, stash) =>
						stash == null
							? `${state.repo.name} 中未找到存储`
							: state.mode === 'pop'
								? '选择要弹出的存储'
								: '选择要应用到工作树的存储',
					picked: state.reference?.ref,
				});
				if (result === StepResultBreak) {
					state.reference = undefined!;
					if (step.goBack() == null) break;
					continue;
				}

				state.reference = result;
			}

			if (this.confirm(state.confirm)) {
				using step = steps.enterStep(Steps.Confirm);

				const result = yield* this.confirmStep(state, context);
				if (result === StepResultBreak) {
					state.mode = this.mode;
					if (step.goBack() == null) break;
					continue;
				}

				state.mode = result;
			}

			steps.markStepsComplete();

			this.container.telemetry.sendEvent('gitCommand/run', {
				command: state.mode === 'pop' ? 'stash-pop' : 'stash-apply',
			});

			try {
				await state.repo.git.stash?.applyStash(
					state.mode === 'pop' ? `stash@{${state.reference.stashNumber}}` : state.reference.ref,
					{ deleteAfter: state.mode === 'pop' },
				);

				if (state.reference.message) {
					const scmRepo = await state.repo.git.getScmRepository();
					if (scmRepo != null && !scmRepo.inputBox.value) {
						scmRepo.inputBox.value = state.reference.message;
					}
				}
			} catch (ex) {
				Logger.error(ex, context.title);

				if (StashApplyError.is(ex, 'uncommittedChanges')) {
					void window.showWarningMessage('无法应用存储。你的本地更改会被覆盖。请先提交或存储更改后再试。');
				} else {
					void showGitErrorMessage(ex, StashApplyError.is(ex) ? undefined : '无法应用存储');
				}
			}
		}

		return steps.isComplete ? undefined : StepResultBreak;
	}

	private *confirmStep(state: StepState<State<Repository>>, context: Context): StepResultGenerator<Mode> {
		const step = this.createConfirmStep<{ label: string; detail: string; item: Mode }>(
			appendReposToTitle(`确认${context.title}`, state, context),
			[
				{
					label: context.title,
					detail:
						this.mode === 'pop'
							? `将删除 ${getReferenceLabel(state.reference)}，并将更改应用到工作树`
							: `将把 ${getReferenceLabel(state.reference)} 的更改应用到工作树`,
					item: this.mode,
				},
				{
					label: this.mode === 'pop' ? '应用存储' : '弹出存储',
					detail:
						this.mode === 'pop'
							? `将把 ${getReferenceLabel(state.reference)} 的更改应用到工作树`
							: `将删除 ${getReferenceLabel(state.reference)}，并将更改应用到工作树`,
					item: this.mode === 'pop' ? 'apply' : 'pop',
				},
			],
			undefined,
			{
				placeholder: `确认${context.title}`,
				additionalButtons: [ShowDetailsViewQuickInputButton, RevealInSideBarQuickInputButton],
				onDidClickButton: (_quickpick, button) => {
					if (button === ShowDetailsViewQuickInputButton) {
						void showStashInDetailsView(state.reference, { pin: false, preserveFocus: true });
					} else if (button === RevealInSideBarQuickInputButton) {
						void revealStash(state.reference, { select: true, expand: true });
					}
				},
			},
		);
		const selection: StepSelection<typeof step> = yield step;
		return canPickStepContinue(step, state, selection) ? selection[0].item : StepResultBreak;
	}
}
