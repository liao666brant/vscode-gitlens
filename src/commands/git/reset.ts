import { window } from 'vscode';
import { ResetError } from '@gitlens/git/errors.js';
import type { GitBranch } from '@gitlens/git/models/branch.js';
import type { GitLog } from '@gitlens/git/models/log.js';
import type { GitRevisionReference, GitTagReference } from '@gitlens/git/models/reference.js';
import { getReferenceLabel } from '@gitlens/git/utils/reference.utils.js';
import { Logger } from '@gitlens/utils/logger.js';
import type { Container } from '../../container.js';
import type { GlRepository } from '../../git/models/repository.js';
import { showGitErrorMessage } from '../../messages.js';
import { createDirectiveQuickPickItem, Directive } from '../../quickpicks/items/directive.js';
import type { FlagsQuickPickItem } from '../../quickpicks/items/flags.js';
import { createFlagsQuickPickItem } from '../../quickpicks/items/flags.js';
import type { ViewsWithRepositoryFolders } from '../../views/viewBase.js';
import type {
	PartialStepState,
	StepGenerator,
	StepResultGenerator,
	StepsContext,
	StepSelection,
	StepState,
} from '../quick-wizard/models/steps.js';
import { StepResultBreak } from '../quick-wizard/models/steps.js';
import type { QuickPickStep } from '../quick-wizard/models/steps.quickpick.js';
import { QuickCommand } from '../quick-wizard/quickCommand.js';
import { pickCommitStep } from '../quick-wizard/steps/commits.js';
import { canSkipRepositoryPick, pickRepositoryStep } from '../quick-wizard/steps/repositories.js';
import { StepsController } from '../quick-wizard/stepsController.js';
import { appendReposToTitle, assertStepState, canPickStepContinue } from '../quick-wizard/utils/steps.utils.js';

const Steps = {
	PickRepo: 'reset-pick-repo',
	PickCommit: 'reset-pick-commit',
	Confirm: 'reset-confirm',
} as const;
type StepNames = (typeof Steps)[keyof typeof Steps];

interface Context extends StepsContext<StepNames> {
	repos: GlRepository[];
	associatedView: ViewsWithRepositoryFolders;
	cache: Map<string, Promise<GitLog | undefined>>;
	destination: GitBranch;
	title: string;
}

type Flags = '--hard' | '--keep' | '--soft';
interface State<Repo = string | GlRepository> {
	repo: Repo;
	reference: GitRevisionReference | GitTagReference;
	flags: Flags[];
}

export interface ResetGitCommandArgs {
	readonly command: 'reset';
	confirm?: boolean;
	state?: Partial<State>;
}

export class ResetGitCommand extends QuickCommand<State> {
	constructor(container: Container, args?: ResetGitCommandArgs) {
		super(container, 'reset', 'reset', '重置', { description: '将当前分支重置到指定提交' });

		this.initialState = { confirm: args?.confirm ?? true, ...args?.state };
		this._canSkipConfirm = !this.initialState.confirm;
	}

	private _canSkipConfirm: boolean = false;
	override get canSkipConfirm(): boolean {
		return this._canSkipConfirm;
	}

	private async execute(state: StepState<State<GlRepository>>) {
		const mode = state.flags.includes('--soft')
			? 'soft'
			: state.flags.includes('--keep')
				? 'keep'
				: state.flags.includes('--hard')
					? 'hard'
					: undefined;

		try {
			await state.repo.git.ops?.reset(state.reference.ref, { mode: mode });
		} catch (ex) {
			Logger.error(ex, this.title);

			if (mode === 'keep' && (ResetError.is(ex, 'notUpToDate') || ResetError.is(ex, 'wouldOverwriteChanges'))) {
				void window.showWarningMessage('无法安全重置。重置操作会覆盖你的本地更改。请先提交或存储更改后再试。');
			} else {
				void showGitErrorMessage(ex);
			}
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

			context.title = `${this.title} ${getReferenceLabel(context.destination, { icon: false })}`;

			if (steps.isAtStep(Steps.PickCommit) || state.reference == null) {
				using step = steps.enterStep(Steps.PickCommit);

				const rev = context.destination.ref;

				let log = context.cache.get(rev);
				if (log == null) {
					log = state.repo.git.commits.getLog(rev, { merges: 'first-parent' });
					context.cache.set(rev, log);
				}

				const result = yield* pickCommitStep(state, context, {
					emptyItems: [
						createDirectiveQuickPickItem(Directive.Cancel, true, {
							label: '确定',
							detail: `${context.destination.name} 没有提交`,
						}),
					],
					log: await log,
					onDidLoadMore: log => context.cache.set(rev, Promise.resolve(log)),
					placeholder: (context, log) =>
						!log?.commits.size
							? `${context.destination.name} 没有提交`
							: `选择要将 ${context.destination.name} 重置到的提交`,
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
					state.flags = [];
					if (step.goBack() == null) break;
					continue;
				}

				state.flags = result;
			}

			steps.markStepsComplete();
			await this.execute(state);
		}

		return steps.isComplete ? undefined : StepResultBreak;
	}

	private *confirmStep(state: StepState<State<GlRepository>>, context: Context): StepResultGenerator<Flags[]> {
		const step: QuickPickStep<FlagsQuickPickItem<Flags>> = this.createConfirmStep(
			appendReposToTitle(`确认${context.title}`, state, context),
			[
				createFlagsQuickPickItem<Flags>(state.flags, [], {
					label: this.title,
					description: '--mixed \u2022 取消暂存更改并重置分支',
					detail: `将取消暂存你的更改，并将 ${getReferenceLabel(context.destination)} 重置到 ${getReferenceLabel(
						state.reference,
					)}`,
				}),
				createFlagsQuickPickItem<Flags>(state.flags, ['--soft'], {
					label: `软${this.title}`,
					description: '--soft \u2022 保留更改并暂存重置后的差异',
					detail: `将保留你的更改，并将 ${getReferenceLabel(context.destination)} 重置到 ${getReferenceLabel(
						state.reference,
					)}`,
				}),
				createFlagsQuickPickItem<Flags>(state.flags, ['--keep'], {
					label: `安全硬${this.title}`,
					description: '--keep \u2022 保留你的更改并丢弃重置差异；如果会覆盖更改则中止',
					detail: `将安全地把 ${getReferenceLabel(context.destination)} 硬重置到 ${getReferenceLabel(
						state.reference,
					)}`,
				}),
				createFlagsQuickPickItem<Flags>(state.flags, ['--hard'], {
					label: `硬${this.title}`,
					description: '$(warning) --hard \u2022 丢弃所有更改',
					detail: `将丢弃所有更改，并将 ${getReferenceLabel(context.destination)} 重置到 ${getReferenceLabel(
						state.reference,
					)}`,
				}),
			],
		);
		const selection: StepSelection<typeof step> = yield step;
		return canPickStepContinue(step, state, selection) ? selection[0].item : StepResultBreak;
	}
}
