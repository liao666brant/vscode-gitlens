import type { MessageItem, Uri } from 'vscode';
import { window } from 'vscode';
import { WorktreeDeleteError } from '@gitlens/git/errors.js';
import type { GitBranchReference } from '@gitlens/git/models/reference.js';
import { GitWorktree } from '@gitlens/git/models/worktree.js';
import type { Container } from '../../../container.js';
import { executeGitCommand } from '../../../git/actions.js';
import type { GlRepository } from '../../../git/models/repository.js';
import { getReferenceFromBranch } from '../../../git/utils/-webview/reference.utils.js';
import { showGitErrorMessage } from '../../../messages.js';
import { createQuickPickSeparator } from '../../../quickpicks/items/common.js';
import type { FlagsQuickPickItem } from '../../../quickpicks/items/flags.js';
import { createFlagsQuickPickItem } from '../../../quickpicks/items/flags.js';
import { getWorkspaceFriendlyPath } from '../../../system/-webview/vscode/workspaces.js';
import { revealInFileExplorer } from '../../../system/-webview/vscode.js';
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
import { ensureAccessStep } from '../../quick-wizard/steps/access.js';
import { pickRepositoryStep } from '../../quick-wizard/steps/repositories.js';
import { pickWorktreesStep } from '../../quick-wizard/steps/worktrees.js';
import { StepsController } from '../../quick-wizard/stepsController.js';
import {
	appendReposToTitle,
	assertStepState,
	canPickStepContinue,
	createConfirmStep,
} from '../../quick-wizard/utils/steps.utils.js';
import type { WorktreeContext } from '../worktree.js';

const Steps = {
	PickRepo: 'worktree-delete-pick-repo',
	EnsureAccess: 'worktree-delete-ensure-access',
	PickWorktrees: 'worktree-delete-pick-worktrees',
	Confirm: 'worktree-delete-confirm',
} as const;
type StepNames = (typeof Steps)[keyof typeof Steps];
export type WorktreeDeleteStepNames = StepNames;

type Context = WorktreeContext<StepNames>;

type Flags = '--force' | '--delete-branches';
interface State<Repo = string | GlRepository> {
	repo: Repo;
	uris: Uri[];
	flags: Flags[];

	startingFromBranchDelete?: boolean;
	overrides?: {
		title?: string;
	};
}
export type WorktreeDeleteState = State;

export interface WorktreeDeleteGitCommandArgs {
	readonly command: 'worktree-delete';
	confirm?: boolean;
	state?: Partial<State>;
}

export class WorktreeDeleteGitCommand extends QuickCommand<State> {
	constructor(container: Container, args?: WorktreeDeleteGitCommandArgs) {
		super(container, 'worktree-delete', 'delete', '删除工作树', {
			description: '删除指定的工作树',
		});

		this.initialState = { confirm: args?.confirm, flags: [], ...args?.state };
	}

	override get canSkipConfirm(): boolean {
		return false;
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
			context.title = state.overrides?.title ?? this.title;

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

			assertStepState<State<GlRepository>>(state);

			if (steps.isAtStepOrUnset(Steps.EnsureAccess)) {
				using step = steps.enterStep(Steps.EnsureAccess);

				const result = yield* ensureAccessStep(this.container, 'worktrees', state, context, step);
				if (result === StepResultBreak) {
					if (step.goBack() == null) break;
					continue;
				}
			}

			context.worktrees = (await state.repo.git.worktrees?.getWorktrees()) ?? [];

			if (steps.isAtStep(Steps.PickWorktrees) || !state.uris?.length) {
				using step = steps.enterStep(Steps.PickWorktrees);

				context.title = this.title;

				const result = yield* pickWorktreesStep(state, context, {
					// Can't delete the main or opened worktree
					excludeOpened: true,
					filter: wt => !wt.isDefault,
					includeStatus: true,
					picked: state.uris?.map(uri => uri.toString()),
					placeholder: '选择要删除的工作树',
				});
				if (result === StepResultBreak) {
					state.uris = undefined!;
					if (step.goBack() == null) break;
					continue;
				}

				state.uris = result.map(w => w.uri);
			}

			context.title = this.title;

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

			const branchesToDelete: GitBranchReference[] = [];

			for (const uri of state.uris) {
				let skipHasChangesPrompt = false;
				let succeeded: boolean;

				const deleteBranches = state.flags.includes('--delete-branches');
				let force = state.flags.includes('--force');
				const worktree = context.worktrees?.find(wt => wt.uri.toString() === uri.toString());

				while (true) {
					succeeded = false;

					try {
						if (force) {
							let hasChanges;
							try {
								hasChanges =
									worktree != null ? await GitWorktree.hasWorkingChanges(worktree) : undefined;
							} catch {}

							if ((hasChanges ?? false) && !skipHasChangesPrompt) {
								const confirm: MessageItem = { title: '强制删除' };
								const cancel: MessageItem = { title: '取消', isCloseAffordance: true };
								const result = await window.showWarningMessage(
									`工作树 '${uri.fsPath}' 中有未提交更改。\n\n删除后这些更改将永久丢失。\n此操作不可恢复！\n\n你确定仍要删除吗？`,
									{ modal: true },
									confirm,
									cancel,
								);

								if (result !== confirm) return;
							}
						}

						await state.repo.git.worktrees?.deleteWorktree(uri, { force: force });
						succeeded = true;
					} catch (ex) {
						if (WorktreeDeleteError.is(ex)) {
							if (ex.details.reason === 'defaultWorkingTree') {
								void window.showErrorMessage('无法删除默认工作树。');
								break;
							}

							if (ex.details.reason === 'directoryNotEmpty') {
								const openFolder: MessageItem = { title: '打开文件夹' };
								const confirm: MessageItem = { title: '确定', isCloseAffordance: true };
								const result = await window.showErrorMessage(
									`无法完全清理要删除的工作树 '${uri.fsPath}'，因为该文件夹不为空。`,
									{ modal: true },
									openFolder,
									confirm,
								);

								if (result === openFolder) {
									void revealInFileExplorer(uri);
								}

								succeeded = true;
								break;
							}

							if (!force) {
								const confirm: MessageItem = { title: '强制删除' };
								const cancel: MessageItem = { title: '取消', isCloseAffordance: true };
								const result = await window.showErrorMessage(
									ex.details.reason === 'uncommittedChanges'
										? `无法删除工作树，因为 '${uri.fsPath}' 中存在未提交更改。\n\n强制删除会导致这些更改永久丢失。\n此操作不可恢复！\n\n是否要强制删除？`
										: `无法删除工作树 '${uri.fsPath}'。\n\n是否要尝试强制删除？`,
									{ modal: true },
									confirm,
									cancel,
								);

								if (result === confirm) {
									force = true;
									skipHasChangesPrompt = ex.details.reason === 'uncommittedChanges';
									continue;
								}

								break;
							}
						}

						void showGitErrorMessage(ex, `无法删除工作树 '${uri.fsPath}'。ex=${String(ex)}`);
					}

					break;
				}

				if (succeeded && deleteBranches && worktree?.branch) {
					branchesToDelete.push(getReferenceFromBranch(worktree?.branch));
				}
			}

			steps.markStepsComplete();

			if (branchesToDelete.length) {
				// Don't use `getSteps` here because this is a whole new flow, a
				// and because of the modals above it won't even work (since the modals will trigger the quick pick to hide)
				void executeGitCommand({
					command: 'branch',
					state: { subcommand: 'delete', repo: state.repo, references: branchesToDelete },
				});
			}
		}

		return steps.isComplete ? undefined : StepResultBreak;
	}

	private *confirmStep(state: StepState<State<GlRepository>>, context: Context): StepResultGenerator<Flags[]> {
		context.title = state.uris.length === 1 ? '删除工作树' : '删除工作树';

		const label = state.uris.length === 1 ? '删除工作树' : '删除工作树';
		const branchesLabel = state.uris.length === 1 ? '分支' : '分支';
		let selectedBranchesLabelSuffix = '';
		if (state.startingFromBranchDelete) {
			selectedBranchesLabelSuffix = `（${branchesLabel}）`;
			context.title = `${context.title}${selectedBranchesLabelSuffix}`;
		}

		const description =
			state.uris.length === 1
				? `删除位于 $(folder) ${getWorkspaceFriendlyPath(state.uris[0])} 的工作树`
				: `删除 ${state.uris.length} 个工作树`;
		const descriptionWithBranchDelete =
			state.uris.length === 1
				? '删除工作树后再提示删除关联分支'
				: `删除 ${state.uris.length} 个工作树后再提示删除关联分支`;

		const step: QuickPickStep<FlagsQuickPickItem<Flags>> = createConfirmStep(
			appendReposToTitle(`确认 ${context.title}`, state, context),
			[
				createFlagsQuickPickItem<Flags>(state.flags, [], {
					label: `${label}${selectedBranchesLabelSuffix}`,
					detail: `将${description}`,
				}),
				createFlagsQuickPickItem<Flags>(state.flags, ['--force'], {
					label: `强制${label}${selectedBranchesLabelSuffix}`,
					description: '包含所有未提交更改',
					detail: `将强制${description}`,
				}),
				...(state.startingFromBranchDelete
					? []
					: [
							createQuickPickSeparator<FlagsQuickPickItem<Flags>>(),
							createFlagsQuickPickItem<Flags>(state.flags, ['--delete-branches'], {
								label: `${label}与${branchesLabel}`,
								detail: `将${descriptionWithBranchDelete}`,
							}),
							createFlagsQuickPickItem<Flags>(state.flags, ['--force', '--delete-branches'], {
								label: `强制${label}与${branchesLabel}`,
								description: '包含所有未提交更改',
								detail: `将强制${descriptionWithBranchDelete}`,
							}),
						]),
			],
			context,
		);

		const selection: StepSelection<typeof step> = yield step;
		return canPickStepContinue(step, state, selection) ? selection[0].item : StepResultBreak;
	}
}
