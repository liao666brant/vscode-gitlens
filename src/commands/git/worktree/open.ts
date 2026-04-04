import type { Container } from '../../../container.js';
import { convertOpenFlagsToLocation } from '../../../git/actions/worktree.js';
import type { Repository } from '../../../git/models/repository.js';
import type { GitWorktree } from '../../../git/models/worktree.js';
import { createQuickPickSeparator } from '../../../quickpicks/items/common.js';
import type { FlagsQuickPickItem } from '../../../quickpicks/items/flags.js';
import { createFlagsQuickPickItem } from '../../../quickpicks/items/flags.js';
import { getWorkspaceFriendlyPath, openWorkspace } from '../../../system/-webview/vscode/workspaces.js';
import { revealInFileExplorer } from '../../../system/-webview/vscode.js';
import { truncateLeft } from '../../../system/string.js';
import type {
	PartialStepState,
	StepGenerator,
	StepResultGenerator,
	StepsContext,
	StepSelection,
	StepState,
} from '../../quick-wizard/models/steps.js';
import { StepResultBreak } from '../../quick-wizard/models/steps.js';
import { QuickCommand } from '../../quick-wizard/quickCommand.js';
import { ensureAccessStep } from '../../quick-wizard/steps/access.js';
import { pickRepositoryStep } from '../../quick-wizard/steps/repositories.js';
import { pickWorktreeStep } from '../../quick-wizard/steps/worktrees.js';
import { StepsController } from '../../quick-wizard/stepsController.js';
import {
	appendReposToTitle,
	assertStepState,
	canPickStepContinue,
	createConfirmStep,
} from '../../quick-wizard/utils/steps.utils.js';
import type { WorktreeContext } from '../worktree.js';

const Steps = {
	PickRepo: 'worktree-open-pick-repo',
	EnsureAccess: 'worktree-open-ensure-access',
	PickWorktree: 'worktree-open-pick-worktree',
	Confirm: 'worktree-open-confirm',
} as const;
type StepNames = (typeof Steps)[keyof typeof Steps];
export type WorktreeOpenStepNames = StepNames;

type Context = WorktreeContext<StepNames>;

type Flags = '--add-to-workspace' | '--new-window' | '--reveal-explorer';
interface State<Repo = string | Repository> {
	repo: Repo;
	worktree: GitWorktree;
	flags: Flags[];

	openOnly?: boolean;
	overrides?: {
		canGoBack?: boolean;
		title?: string;

		confirmation?: {
			title?: string;
			placeholder?: string;
		};
	};

	onWorkspaceChanging?: ((isNewWorktree?: boolean) => Promise<void>) | ((isNewWorktree?: boolean) => void);
	isNewWorktree?: boolean;
	worktreeDefaultOpen?: 'new' | 'current';
}
export type WorktreeOpenState = State;

export interface WorktreeOpenGitCommandArgs {
	readonly command: 'worktree-open';
	confirm?: boolean;
	state?: Partial<State>;
}

export class WorktreeOpenGitCommand extends QuickCommand<State> {
	constructor(container: Container, args?: WorktreeOpenGitCommandArgs) {
		super(container, 'worktree-open', 'open', '打开工作树', {
			description: '打开现有工作树',
		});

		this.initialState = { confirm: args?.confirm, flags: [], ...args?.state };
	}

	override get canSkipConfirm(): boolean {
		// Allow skipping the confirm step
		return true;
	}

	protected createContext(context?: StepsContext<any>): Context {
		return {
			...context,
			container: this.container,
			repos: this.container.git.openRepositories,
			associatedView: this.container.views.worktrees,
			showTags: false,
			title: this.title,
		};
	}

	protected async *steps(state: PartialStepState<State>, context?: Context): StepGenerator {
		context ??= this.createContext();
		using steps = new StepsController<StepNames>(context, this);

		state.flags ??= [];

		while (!steps.isComplete) {
			context.title = state.worktree?.name ? `${this.title} \u2022 ${state.worktree.name}` : this.title;

			if (steps.isAtStep(Steps.PickRepo) || state.repo == null || typeof state.repo === 'string') {
				// Only show the picker if there are multiple repositories
				if (context.repos.length === 1) {
					[state.repo] = context.repos;
				} else {
					using step = steps.enterStep(Steps.PickRepo);

					const result = yield* pickRepositoryStep(state, context, step, { excludeWorktrees: true });
					if (result === StepResultBreak) {
						state.repo = undefined!;
						if (step.goBack() == null) break;
						continue;
					}

					state.repo = result;
				}
			}

			assertStepState<State<Repository>>(state);

			if (steps.isAtStepOrUnset(Steps.EnsureAccess)) {
				using step = steps.enterStep(Steps.EnsureAccess);

				const result = yield* ensureAccessStep(this.container, 'worktrees', state, context, step);
				if (result === StepResultBreak) {
					if (step.goBack() == null) break;
					continue;
				}
			}

			if (steps.isAtStep(Steps.PickWorktree) || state.worktree == null) {
				using step = steps.enterStep(Steps.PickWorktree);

				context.worktrees ??= (await state.repo.git.worktrees?.getWorktrees()) ?? [];

				const result = yield* pickWorktreeStep(state, context, {
					excludeOpened: true,
					includeStatus: true,
					picked: state.worktree?.uri?.toString(),
					placeholder: '选择要打开的工作树',
				});
				if (result === StepResultBreak) {
					state.worktree = undefined!;
					if (step.goBack() == null) break;
					continue;
				}

				state.worktree = result;
			}

			context.title = `${this.title} \u2022 ${state.worktree.name}`;

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

			await this.executeOpen(state);
		}

		return steps.isComplete ? undefined : StepResultBreak;
	}

	async executeOpen(state: StepState<State<Repository>>): Promise<void> {
		if (state.flags.includes('--reveal-explorer')) {
			void revealInFileExplorer(state.worktree.uri);
		} else {
			let name;

			const repo = (await state.repo.getOrOpenCommonRepository()) ?? state.repo;
			if (repo.name !== state.worktree.name) {
				name = `${repo.name}: ${state.worktree.name}`;
			} else {
				name = state.worktree.name;
			}

			const location = convertOpenFlagsToLocation(state.flags);
			if (location === 'currentWindow' || location === 'newWindow') {
				await state.onWorkspaceChanging?.(state.isNewWorktree);
			}

			openWorkspace(state.worktree.uri, { location: convertOpenFlagsToLocation(state.flags), name: name });
		}
	}

	private *confirmStep(state: StepState<State<Repository>>, context: Context): StepResultGenerator<Flags[]> {
		type StepType = FlagsQuickPickItem<Flags>;

		const newWindowItem = createFlagsQuickPickItem<Flags>(state.flags, ['--new-window'], {
			label: '在新窗口中打开工作树',
			detail: '将在新窗口中打开该工作树',
		});

		const currentWindowItem = createFlagsQuickPickItem<Flags>(state.flags, [], {
			label: '打开工作树',
			detail: '将在当前窗口中打开该工作树',
		});

		if (state.worktreeDefaultOpen === 'new') {
			return newWindowItem.item;
		}

		if (state.worktreeDefaultOpen === 'current') {
			return currentWindowItem.item;
		}

		const confirmations: StepType[] = [
			currentWindowItem,
			newWindowItem,
			createFlagsQuickPickItem<Flags>(state.flags, ['--add-to-workspace'], {
				label: '将工作树添加到工作区',
				detail: '将把该工作树添加到当前工作区',
			}),
		];

		if (!state.openOnly) {
			confirmations.push(
				createQuickPickSeparator(),
				createFlagsQuickPickItem<Flags>(state.flags, ['--reveal-explorer'], {
					label: '在文件资源管理器中显示',
					description: `$(folder) ${truncateLeft(getWorkspaceFriendlyPath(state.worktree.uri), 40)}`,
					detail: '将在文件资源管理器中打开该工作树',
				}),
			);
		}

		const step = createConfirmStep(
			appendReposToTitle(state.overrides?.confirmation?.title ?? `确认 ${context.title}`, state, context),
			confirmations,
			context,
			undefined,
			{
				canGoBack: state.overrides?.canGoBack,
				placeholder: state.overrides?.confirmation?.placeholder ?? '确认打开工作树',
			},
		);

		const selection: StepSelection<typeof step> = yield step;
		return canPickStepContinue(step, state, selection) ? selection[0].item : StepResultBreak;
	}
}
