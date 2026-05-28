import type { GitBranchReference } from '@gitlens/git/models/reference.js';
import { getReferenceLabel, isBranchReference } from '@gitlens/git/utils/reference.utils.js';
import { isStringArray } from '@gitlens/utils/array.js';
import { fromNow } from '@gitlens/utils/date.js';
import { pad } from '@gitlens/utils/string.js';
import { GlyphChars } from '../../constants.js';
import type { Container } from '../../container.js';
import type { GlRepository } from '../../git/models/repository.js';
import type { FlagsQuickPickItem } from '../../quickpicks/items/flags.js';
import { createFlagsQuickPickItem } from '../../quickpicks/items/flags.js';
import type { ViewsWithRepositoryFolders } from '../../views/viewBase.js';
import type {
	AsyncStepResultGenerator,
	PartialStepState,
	StepGenerator,
	StepsContext,
	StepSelection,
	StepState,
} from '../quick-wizard/models/steps.js';
import { StepResultBreak } from '../quick-wizard/models/steps.js';
import type { QuickPickStep } from '../quick-wizard/models/steps.quickpick.js';
import { QuickCommand } from '../quick-wizard/quickCommand.js';
import { pickRepositoriesStep } from '../quick-wizard/steps/repositories.js';
import { StepsController } from '../quick-wizard/stepsController.js';
import {
	appendReposToTitle,
	assertStepState,
	canPickStepContinue,
	createConfirmStep,
} from '../quick-wizard/utils/steps.utils.js';

const Steps = {
	PickRepos: 'fetch-pick-repos',
	Confirm: 'fetch-confirm',
} as const;
type StepNames = (typeof Steps)[keyof typeof Steps];

interface Context extends StepsContext<StepNames> {
	repos: GlRepository[];
	associatedView: ViewsWithRepositoryFolders;
	title: string;
}

type Flags = '--all' | '--prune';
interface State<Repos = string | string[] | GlRepository | GlRepository[]> {
	repos: Repos;
	reference?: GitBranchReference;
	flags: Flags[];
}

export interface FetchGitCommandArgs {
	readonly command: 'fetch';
	confirm?: boolean;
	state?: Partial<State>;
}

export class FetchGitCommand extends QuickCommand<State> {
	constructor(container: Container, args?: FetchGitCommandArgs) {
		super(container, 'fetch', 'fetch', '抓取', { description: '从一个或多个远程抓取更改' });

		this.initialState = { confirm: args?.confirm, ...args?.state };
	}

	private execute(state: StepState<State<GlRepository[]>>) {
		if (isBranchReference(state.reference)) {
			return state.repos[0].git.fetch({ branch: state.reference });
		}

		return this.container.git.fetchAll(state.repos, {
			all: state.flags.includes('--all'),
			prune: state.flags.includes('--prune'),
		});
	}

	protected createContext(context?: StepsContext<any>): Context {
		return {
			...context,
			container: this.container,
			repos: this.container.git.openRepositories,
			associatedView: this.container.views.commits,
			title: this.title,
		};
	}

	protected async *steps(state: PartialStepState<State>, context?: Context): StepGenerator {
		context ??= this.createContext();
		using steps = new StepsController<StepNames>(context, this);

		state.flags ??= [];

		if (state.repos != null && !Array.isArray(state.repos)) {
			state.repos = typeof state.repos === 'string' ? [state.repos] : [state.repos];
		}

		assertStepState<State<GlRepository[] | string[]>>(state);

		while (!steps.isComplete) {
			context.title = this.title;

			if (steps.isAtStep(Steps.PickRepos) || !state.repos?.length || isStringArray(state.repos)) {
				// Only show the picker if there are multiple repositories
				if (context.repos.length === 1) {
					state.repos = context.repos;
				} else {
					using step = steps.enterStep(Steps.PickRepos);

					const result = yield* pickRepositoriesStep(state, context, step, {
						excludeWorktrees: true,
						skipIfPossible: true,
					});
					if (result === StepResultBreak) {
						state.repos = undefined!;
						if (step.goBack() == null) break;
						continue;
					}

					state.repos = result;
				}
			}

			assertStepState<State<GlRepository[]>>(state);

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
		state: StepState<State<GlRepository[]>>,
		context: Context,
	): AsyncStepResultGenerator<Flags[]> {
		let lastFetchedOn = '';
		if (state.repos.length === 1) {
			const lastFetched = await state.repos[0].getLastFetched();
			if (lastFetched !== 0) {
				lastFetchedOn = `${pad(GlyphChars.Dot, 2, 2)}上次抓取于 ${fromNow(new Date(lastFetched))}`;
			}
		}

		let step: QuickPickStep<FlagsQuickPickItem<Flags>>;

		if (state.repos.length === 1 && isBranchReference(state.reference)) {
			step = this.createConfirmStep(appendReposToTitle(`确认${context.title}`, state, context, lastFetchedOn), [
				createFlagsQuickPickItem<Flags>(state.flags, [], {
					label: this.title,
					detail: `将抓取 ${getReferenceLabel(state.reference)}`,
				}),
			]);
		} else {
			const reposToFetch =
				state.repos.length === 1 ? `$(repo) ${state.repos[0].name}` : `${state.repos.length} repos`;

			step = createConfirmStep(
				appendReposToTitle(`确认${this.title}`, state, context, lastFetchedOn),
				[
					createFlagsQuickPickItem<Flags>(state.flags, [], {
						label: this.title,
						detail: `将抓取 ${reposToFetch}`,
					}),
					createFlagsQuickPickItem<Flags>(state.flags, ['--prune'], {
						label: `${this.title}并清理`,
						description: '--prune',
						detail: `将抓取并清理 ${reposToFetch}`,
					}),
					createFlagsQuickPickItem<Flags>(state.flags, ['--all'], {
						label: `${this.title}全部远程`,
						description: '--all',
						detail: `将抓取 ${reposToFetch} 的全部远程`,
					}),
					createFlagsQuickPickItem<Flags>(state.flags, ['--all', '--prune'], {
						label: `${this.title}全部远程并清理`,
						description: '--all --prune',
						detail: `将抓取并清理 ${reposToFetch} 的全部远程`,
					}),
				],
				context,
			);
		}

		const selection: StepSelection<typeof step> = yield step;
		return canPickStepContinue(step, state, selection) ? selection[0].item : StepResultBreak;
	}
}
