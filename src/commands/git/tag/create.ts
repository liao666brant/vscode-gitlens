import { window } from 'vscode';
import { TagError } from '@gitlens/git/errors.js';
import type { GitReference } from '@gitlens/git/models/reference.js';
import {
	getReferenceLabel,
	getReferenceNameWithoutRemote,
	isRevisionReference,
	isTagReference,
} from '@gitlens/git/utils/reference.utils.js';
import { Logger } from '@gitlens/utils/logger.js';
import type { Container } from '../../../container.js';
import type { GlRepository } from '../../../git/models/repository.js';
import { showGitErrorMessage } from '../../../messages.js';
import type { FlagsQuickPickItem } from '../../../quickpicks/items/flags.js';
import { createFlagsQuickPickItem } from '../../../quickpicks/items/flags.js';
import type {
	AsyncStepResultGenerator,
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
import { pickBranchOrTagStep } from '../../quick-wizard/steps/references.js';
import { canSkipRepositoryPick, pickRepositoryStep } from '../../quick-wizard/steps/repositories.js';
import { inputTagNameStep } from '../../quick-wizard/steps/tags.js';
import { StepsController } from '../../quick-wizard/stepsController.js';
import {
	appendReposToTitle,
	assertStepState,
	canInputStepContinue,
	canPickStepContinue,
	canStepContinue,
	createConfirmStep,
	createInputStep,
} from '../../quick-wizard/utils/steps.utils.js';
import type { TagContext } from '../tag.js';

const Steps = {
	PickRepo: 'tag-create-pick-repo',
	PickRef: 'tag-create-pick-ref',
	InputName: 'tag-create-input-name',
	InputMessage: 'tag-create-input-message',
	Confirm: 'tag-create-confirm',
} as const;
type StepNames = (typeof Steps)[keyof typeof Steps];
export type TagCreateStepNames = StepNames;

type Context = TagContext<StepNames>;

type Flags = '--force' | '-m';
interface State<Repo = string | GlRepository> {
	repo: Repo;
	reference: GitReference;
	name: string;
	message: string;
	flags: Flags[];
}
export type TagCreateState = State;

export interface TagCreateGitCommandArgs {
	readonly command: 'tag-create';
	confirm?: boolean;
	state?: Partial<State>;
}

export class TagCreateGitCommand extends QuickCommand<State> {
	constructor(container: Container, args?: TagCreateGitCommandArgs) {
		super(container, 'tag-create', 'create', '创建标签', {
			description: '创建新标签',
		});

		this.initialState = { confirm: args?.confirm, ...args?.state };
	}

	protected createContext(context?: StepsContext<any>): Context {
		return {
			...context,
			container: this.container,
			repos: this.container.git.openRepositories,
			associatedView: this.container.views.tags,
			showTags: false,
			title: this.title,
		};
	}

	protected async *steps(state: PartialStepState<State>, context?: Context): StepGenerator {
		context ??= this.createContext();
		using steps = new StepsController<StepNames>(context);

		state.flags ??= [];

		while (!steps.isComplete) {
			context.title = this.title;

			if (steps.isAtStep(Steps.PickRepo) || state.repo == null || typeof state.repo === 'string') {
				// Skip the picker only when the sole available repo is the one requested
				if (canSkipRepositoryPick(context.repos, state.repo)) {
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

			assertStepState<State<GlRepository>>(state);

			if (steps.isAtStep(Steps.PickRef) || state.reference == null) {
				using step = steps.enterStep(Steps.PickRef);

				const result = yield* pickBranchOrTagStep(state, context, {
					placeholder: ctx => `选择一个${ctx.showTags ? '分支或标签' : '分支'}作为新标签的来源`,
					picked: state.reference?.ref ?? (await state.repo.git.branches.getBranch())?.ref,
					title: `${context.title}，来源`,
					value: isRevisionReference(state.reference) ? state.reference.ref : undefined,
				});
				if (result === StepResultBreak) {
					state.reference = undefined!;
					if (step.goBack() == null) break;
					continue;
				}

				state.reference = result;
			}

			if (steps.isAtStep(Steps.InputName) || state.name == null) {
				using step = steps.enterStep(Steps.InputName);

				const result = yield* inputTagNameStep(state, context, {
					prompt: '请为新标签输入名称',
					title: `${context.title} 于 ${getReferenceLabel(state.reference, {
						capitalize: true,
						icon: false,
					})}`,
					value:
						state.name ?? // if it's not a tag, pre-fill the name
						(!isTagReference(state.reference) ? getReferenceNameWithoutRemote(state.reference) : undefined),
				});
				if (result === StepResultBreak) {
					state.name = undefined!;
					if (step.goBack() == null) break;
					continue;
				}

				state.name = result;
			}

			if (steps.isAtStep(Steps.InputMessage) || state.message == null) {
				using step = steps.enterStep(Steps.InputMessage);

				const result = yield* this.inputMessageStep(state, context);
				if (result === StepResultBreak) {
					state.message = undefined!;
					if (step.goBack() == null) break;
					continue;
				}

				state.message = result;
			}

			if (state.message.length && !state.flags.includes('-m')) {
				state.flags.push('-m');
			}

			if (!steps.isAtStepOrUnset(Steps.Confirm)) continue;

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

			try {
				await state.repo.git.tags.createTag?.(state.name, state.reference.ref, state.message);
			} catch (ex) {
				Logger.error(ex, context.title);

				if (TagError.is(ex, 'alreadyExists')) {
					void window.showWarningMessage(`无法创建标签“${state.name}”。同名标签已存在。`);
					return;
				}

				if (TagError.is(ex, 'invalidName')) {
					void window.showWarningMessage(`无法创建标签“${state.name}”。标签名称无效。`);
					return;
				}

				void showGitErrorMessage(ex, TagError.is(ex) ? undefined : '无法创建标签');
			}
		}

		return steps.isComplete ? undefined : StepResultBreak;
	}

	private async *inputMessageStep(
		state: StepState<State<GlRepository>>,
		context: TagContext,
	): AsyncStepResultGenerator<string> {
		const step = createInputStep({
			title: appendReposToTitle(
				`${context.title} 于 ${getReferenceLabel(state.reference, { capitalize: true, icon: false })}`,
				state,
				context,
			),
			placeholder: '可选：输入用于注解标签的消息',
			value: state.message,
			prompt: '输入可选消息',
		});

		const value: StepSelection<typeof step> = yield step;

		if (!canStepContinue(step, state, value) || !(await canInputStepContinue(step, state, value))) {
			return StepResultBreak;
		}

		return value;
	}

	private *confirmStep(state: StepState<State<GlRepository>>, context: TagContext): StepResultGenerator<Flags[]> {
		const step: QuickPickStep<FlagsQuickPickItem<Flags>> = createConfirmStep(
			appendReposToTitle(`确认${context.title}`, state, context),
			[
				createFlagsQuickPickItem<Flags>(state.flags, state.message.length !== 0 ? ['-m'] : [], {
					label: context.title,
					description: state.message.length !== 0 ? '-m' : '',
					detail: `将在 ${getReferenceLabel(state.reference)} 创建名为 ${state.name} 的新标签`,
				}),
				createFlagsQuickPickItem<Flags>(
					state.flags,
					state.message.length !== 0 ? ['--force', '-m'] : ['--force'],
					{
						label: `强制${context.title}`,
						description: `--force${state.message.length !== 0 ? ' -m' : ''}`,
						detail: `将强制在 ${getReferenceLabel(state.reference)} 创建名为 ${state.name} 的新标签`,
					},
				),
			],
			context,
		);
		const selection: StepSelection<typeof step> = yield step;
		return canPickStepContinue(step, state, selection) ? selection[0].item : StepResultBreak;
	}
}
