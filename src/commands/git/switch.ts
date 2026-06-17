import { ProgressLocation, window } from 'vscode';
import { MergeError } from '@gitlens/git/errors.js';
import type { GitReference } from '@gitlens/git/models/reference.js';
import {
	getReferenceLabel,
	getReferenceNameWithoutRemote,
	getReferenceTypeLabel,
	isBranchReference,
} from '@gitlens/git/utils/reference.utils.js';
import { isStringArray } from '@gitlens/utils/array.js';
import { Logger } from '@gitlens/utils/logger.js';
import type { Container } from '../../container.js';
import type { GlRepository } from '../../git/models/repository.js';
import { showGitErrorMessage } from '../../messages.js';
import type { QuickPickItemOfT } from '../../quickpicks/items/common.js';
import { createQuickPickSeparator } from '../../quickpicks/items/common.js';
import { executeCommand } from '../../system/-webview/command.js';
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
import { QuickCommand } from '../quick-wizard/quickCommand.js';
import { inputBranchNameStep } from '../quick-wizard/steps/branches.js';
import { pickBranchOrTagStepMultiRepo } from '../quick-wizard/steps/references.js';
import { canSkipRepositoriesPick, pickRepositoriesStep } from '../quick-wizard/steps/repositories.js';
import { StepsController } from '../quick-wizard/stepsController.js';
import { getSteps } from '../quick-wizard/utils/quickWizard.utils.js';
import { appendReposToTitle, assertStepState, canPickStepContinue } from '../quick-wizard/utils/steps.utils.js';

const Steps = {
	PickRepos: 'switch-pick-repos',
	PickBranchOrTag: 'switch-pick-branch-or-tag',
	CreateBranch: 'switch-create-branch',
	OpenWorktree: 'switch-open-worktree',
	CreateWorktree: 'switch-create-worktree',
	InputBranchName: 'switch-input-branch-name',
	Confirm: 'switch-confirm',
} as const;
type StepNames = (typeof Steps)[keyof typeof Steps];

interface Context extends StepsContext<StepNames> {
	repos: GlRepository[];
	associatedView: ViewsWithRepositoryFolders;
	canSwitchToLocalBranch: GitReference | undefined;
	promptToCreateBranch: boolean;
	showTags: boolean;
	title: string;
}

interface State<Repos = string | string[] | GlRepository | GlRepository[]> {
	repos: Repos;
	onWorkspaceChanging?: ((isNewWorktree?: boolean) => Promise<void>) | ((isNewWorktree?: boolean) => void);
	reference: GitReference;
	createBranch?: string;
	fastForwardTo?: GitReference;
	worktreeDefaultOpen?: 'new' | 'current';
}

type ConfirmationChoice =
	| 'switch'
	| 'switchViaWorktree'
	| 'switchToLocalBranch'
	| 'switchToLocalBranchAndFastForward'
	| 'switchToLocalBranchViaWorktree'
	| 'switchToNewBranch'
	| 'switchToNewBranchViaWorktree';

export interface SwitchGitCommandArgs {
	readonly command: 'switch' | 'checkout';
	confirm?: boolean;
	state?: Partial<State>;
}

export class SwitchGitCommand extends QuickCommand<State> {
	constructor(container: Container, args?: SwitchGitCommandArgs) {
		super(container, 'switch', 'switch', '切换到...', {
			description: '即 checkout，切换到指定分支',
		});

		this.initialState = { confirm: args?.confirm, ...args?.state };
	}

	private _canConfirmOverride: boolean | undefined;
	override get canConfirm(): boolean {
		return this._canConfirmOverride ?? true;
	}

	private async execute(state: StepState<State<GlRepository[]>>) {
		await window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: `${
					isBranchReference(state.reference) || state.createBranch ? '正在切换到' : '正在检出'
				} ${getReferenceLabel(state.reference, { icon: false, label: false })} 到 ${
					state.repos.length === 1 ? state.repos[0].name : `${state.repos.length} 个仓库`
				}`,
			},
			() =>
				Promise.all(
					state.repos.map(r =>
						r.git.switch(state.reference.ref, { createBranch: state.createBranch, progress: false }),
					),
				),
		);

		if (state.fastForwardTo != null) {
			try {
				await state.repos[0].git.ops?.merge(state.fastForwardTo.ref, { fastForward: 'only' });
			} catch (ex) {
				// Don't show an error message if the user intentionally aborted the merge
				if (MergeError.is(ex, 'aborted')) {
					Logger.debug(ex.message, this.title);
					return;
				}

				Logger.error(ex, this.title);
				void showGitErrorMessage(
					ex,
					`无法快进 ${getReferenceLabel(state.reference, {
						icon: false,
						label: true,
					})}`,
				);
			}
		}
	}

	override isMatch(key: string): boolean {
		return super.isMatch(key) || key === 'checkout';
	}

	override isFuzzyMatch(name: string): boolean {
		return super.isFuzzyMatch(name) || name === 'checkout';
	}

	protected createContext(context?: StepsContext<any>): Context {
		return {
			...context,
			container: this.container,
			repos: this.container.git.openRepositories,
			associatedView: this.container.views.commits,
			canSwitchToLocalBranch: undefined,
			promptToCreateBranch: false,
			showTags: false,
			title: this.title,
		};
	}

	protected async *steps(state: PartialStepState<State>, context?: Context): StepGenerator {
		context ??= this.createContext();
		using steps = new StepsController<StepNames>(context, this);

		if (state.repos != null && !Array.isArray(state.repos)) {
			state.repos = typeof state.repos === 'string' ? [state.repos] : [state.repos];
		}

		assertStepState<State<GlRepository[] | string[]>>(state);

		outer: while (!steps.isComplete) {
			context.title = this.title;

			if (steps.isAtStep(Steps.PickRepos) || !state.repos?.length || isStringArray(state.repos)) {
				// Skip the picker only when the sole available repo is the one requested
				if (canSkipRepositoriesPick(context.repos, state.repos)) {
					state.repos = context.repos;
				} else {
					using step = steps.enterStep(Steps.PickRepos);

					const result = yield* pickRepositoriesStep(state, context, step, {
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

			if (steps.isAtStep(Steps.PickBranchOrTag) || state.reference == null) {
				using step = steps.enterStep(Steps.PickBranchOrTag);

				const result = yield* pickBranchOrTagStepMultiRepo(state, context, {
					placeholder: context => `选择要切换到的分支${context.showTags ? '或标签' : ''}`,
					allowCreate: state.repos.length === 1,
				});
				if (result === StepResultBreak) {
					state.reference = undefined!;
					if (step.goBack() == null) break;
					continue;
				}

				if (result.type === 'action') {
					switch (result.action) {
						case 'create-branch': {
							using createStep = steps.enterStep(Steps.CreateBranch);

							const createResult = yield* getSteps(
								this.container,
								{
									command: 'branch',
									state: {
										subcommand: 'create',
										repo: state.repos[0],
										suggestedName: result.name,
										flags: ['--switch'],
									},
								},
								context,
								this.startedFrom,
							);
							if (createResult === StepResultBreak) {
								if (createStep.goBack() == null) break;
								continue;
							}

							steps.markStepsComplete();
							return;
						}
						case 'cross-command':
							void executeCommand(result.command, result.args);
							steps.markStepsComplete();
							return;
					}
					continue;
				}

				state.reference = result.value;
			}

			context.canSwitchToLocalBranch = undefined;

			const svc = this.container.git.getRepositoryService(state.reference.repoPath);

			if (isBranchReference(state.reference) && !state.reference.remote) {
				state.createBranch = undefined;

				const worktree = await svc.worktrees?.getWorktree(w => w.branch?.name === state.reference.name);
				if (worktree != null) {
					if (state.fastForwardTo != null) {
						try {
							await state.repos[0].git.ops?.merge(state.fastForwardTo.ref, { fastForward: 'only' });
						} catch (ex) {
							// Don't show an error message if the user intentionally aborted the merge
							if (MergeError.is(ex, 'aborted')) {
								Logger.debug(ex.message, this.title);
							} else {
								Logger.error(ex, this.title);
								void showGitErrorMessage(
									ex,
									`无法快进 ${getReferenceLabel(state.reference, {
										icon: false,
										label: true,
									})}`,
								);
							}
						}
					}

					using step = steps.enterStep(Steps.OpenWorktree);

					const result = yield* getSteps(
						this.container,
						{
							command: 'worktree',
							state: {
								subcommand: 'open',
								worktree: worktree,
								openOnly: true,
								overrides: {
									canGoBack: false,
									confirmation: state.worktreeDefaultOpen
										? undefined
										: {
												title: `确认切换到工作树 \u2022 ${getReferenceLabel(state.reference, {
													icon: false,
													label: false,
												})}`,
												placeholder: `${getReferenceLabel(state.reference, {
													capitalize: true,
													icon: false,
												})} 已关联到工作树`,
											},
								},
								onWorkspaceChanging: state.onWorkspaceChanging,
								repo: state.repos[0],
								worktreeDefaultOpen: state.worktreeDefaultOpen,
							},
						},
						context,
						this.startedFrom,
					);
					if (result === StepResultBreak) {
						if (!state.worktreeDefaultOpen) {
							if (step.goBack() == null) break;
							continue;
						}
					}

					steps.markStepsComplete();
					return;
				}
			} else if (isBranchReference(state.reference) && state.reference.remote) {
				// See if there is a local branch that tracks the remote branch
				const { values: branches } = await svc.branches.getBranches({
					filter: b => b.upstream?.name === state.reference.name,
					sort: { orderBy: 'date:desc' },
				});

				if (branches.length) {
					context.canSwitchToLocalBranch = branches[0];

					state.createBranch = undefined;
					context.promptToCreateBranch = false;
					if (state.worktreeDefaultOpen) {
						state.reference = context.canSwitchToLocalBranch;
						continue outer;
					}
				} else {
					context.promptToCreateBranch = true;
				}
			}

			if (
				state.worktreeDefaultOpen ||
				this.confirm(context.promptToCreateBranch || context.canSwitchToLocalBranch ? true : state.confirm)
			) {
				using step = steps.enterStep(Steps.Confirm);

				const confirmResult = yield* this.confirmStep(state, context);
				if (confirmResult === StepResultBreak) {
					if (step.goBack() == null) break;
					continue;
				}

				switch (confirmResult) {
					case 'switchToLocalBranch':
						state.reference = context.canSwitchToLocalBranch!;
						continue outer;

					case 'switchToLocalBranchAndFastForward':
						state.fastForwardTo = state.reference;
						state.reference = context.canSwitchToLocalBranch!;
						continue outer;

					case 'switchToNewBranch': {
						using step = steps.enterStep(Steps.InputBranchName);

						context.title = `切换到新分支`;
						this._canConfirmOverride = false;

						const result = yield* inputBranchNameStep(state, context, {
							prompt: '请输入新分支名称',
							title: `${context.title}，来源 ${getReferenceLabel(state.reference, {
								capitalize: true,
								icon: false,
								label: state.reference.refType !== 'branch',
							})}`,
							value:
								state.createBranch ?? // if it's a remote branch, pre-fill the name
								(isBranchReference(state.reference) && state.reference.remote
									? getReferenceNameWithoutRemote(state.reference)
									: undefined),
						});

						this._canConfirmOverride = undefined;

						if (result === StepResultBreak) {
							state.createBranch = undefined;
							if (step.goBack() == null) break;
							continue outer;
						}

						state.createBranch = result;
						break;
					}
					case 'switchViaWorktree':
					case 'switchToLocalBranchViaWorktree':
					case 'switchToNewBranchViaWorktree': {
						using step = steps.enterStep(Steps.CreateWorktree);

						const result = yield* getSteps(
							this.container,
							{
								command: 'worktree',
								state: {
									subcommand: 'create',
									reference:
										confirmResult === 'switchToLocalBranchViaWorktree'
											? context.canSwitchToLocalBranch
											: state.reference,
									createBranch:
										confirmResult === 'switchToNewBranchViaWorktree'
											? state.createBranch
											: undefined,
									repo: state.repos[0],
									onWorkspaceChanging: state.onWorkspaceChanging,
									worktreeDefaultOpen: state.worktreeDefaultOpen,
								},
							},
							context,
							this.startedFrom,
						);
						if (result === StepResultBreak) {
							if (!state.worktreeDefaultOpen) {
								if (step.goBack() == null) break;
								continue outer;
							}
						}

						steps.markStepsComplete();
						return;
					}
				}
			}

			steps.markStepsComplete();
			void this.execute(state);
		}

		return steps.isComplete ? undefined : StepResultBreak;
	}

	private *confirmStep(
		state: StepState<State<GlRepository[]>>,
		context: Context,
	): StepResultGenerator<ConfirmationChoice> {
		const isLocalBranch = isBranchReference(state.reference) && !state.reference.remote;
		const isRemoteBranch = isBranchReference(state.reference) && state.reference.remote;

		type StepType = QuickPickItemOfT<ConfirmationChoice>;
		if (state.worktreeDefaultOpen && state.repos.length === 1) {
			if (isLocalBranch) {
				return 'switchViaWorktree';
			} else if (!state.createBranch && context.canSwitchToLocalBranch != null) {
				return 'switchToLocalBranchViaWorktree';
			}

			return 'switchToNewBranchViaWorktree';
		}

		const confirmations: StepType[] = [];

		if (!isBranchReference(state.reference)) {
			confirmations.push({
				label: `检出到${getReferenceTypeLabel(state.reference)}`,
				description: '（分离 HEAD）',
				detail: `将检出到 ${getReferenceLabel(state.reference)}${
					state.repos.length > 1 ? `（共 ${state.repos.length} 个仓库）` : ''
				}`,
				item: 'switch',
			});
		}

		if (!state.createBranch) {
			if (context.canSwitchToLocalBranch != null) {
				confirmations.push(createQuickPickSeparator('本地'));
				confirmations.push({
					label: `切换到本地分支`,
					description: '',
					detail: `将切换到本地分支 ${getReferenceLabel(
						context.canSwitchToLocalBranch,
					)}，用于跟踪 ${getReferenceLabel(state.reference)}`,
					item: 'switchToLocalBranch',
				});

				if (state.repos.length === 1) {
					confirmations.push({
						label: `切换到本地分支并快进`,
						description: '',
						detail: `将切换到本地分支并快进 ${getReferenceLabel(context.canSwitchToLocalBranch)}`,
						item: 'switchToLocalBranchAndFastForward',
					});
				}
			} else if (isLocalBranch) {
				confirmations.push({
					label: '切换到分支',
					description: '',
					detail: `将切换到 ${getReferenceLabel(state.reference)}${
						state.repos.length > 1 ? `（共 ${state.repos.length} 个仓库）` : ''
					}`,
					item: 'switch',
				});
			}
		}

		if (!isLocalBranch || state.createBranch || context.promptToCreateBranch) {
			if (isRemoteBranch) {
				if (confirmations.length) {
					confirmations.push(createQuickPickSeparator('远程'));
				}
				confirmations.push({
					label: '创建并切换到新的本地分支',
					description: '',
					detail: `将从 ${getReferenceLabel(state.reference)} 创建并切换到新的本地分支${
						state.createBranch ? `“${state.createBranch}”` : ''
					}${state.repos.length > 1 ? `（共 ${state.repos.length} 个仓库）` : ''}
					}`,
					item: 'switchToNewBranch',
				});
			} else {
				if (confirmations.length) {
					confirmations.push(createQuickPickSeparator('分支'));
				}
				confirmations.push({
					label: `从 ${getReferenceTypeLabel(state.reference)} 创建并切换到新分支`,
					description: '',
					detail: `将从 ${getReferenceLabel(state.reference)} 创建并切换到新分支${
						state.createBranch ? `“${state.createBranch}”` : ''
					}${state.repos.length > 1 ? `（共 ${state.repos.length} 个仓库）` : ''}
					}`,
					item: 'switchToNewBranch',
				});
			}
		}

		if (state.repos.length === 1) {
			if (confirmations.length) {
				confirmations.push(createQuickPickSeparator('工作树'));
			}
			if (isLocalBranch) {
				confirmations.push({
					label: `为分支创建工作树...`,
					description: '避免修改当前工作树',
					detail: `将为 ${getReferenceLabel(state.reference)} 创建新的工作树`,
					item: 'switchViaWorktree',
				});
			} else if (!state.createBranch && context.canSwitchToLocalBranch != null) {
				confirmations.push({
					label: `为本地分支创建工作树...`,
					description: '避免修改当前工作树',
					detail: `将为本地分支 ${getReferenceLabel(context.canSwitchToLocalBranch)} 创建新的工作树`,
					item: 'switchToLocalBranchViaWorktree',
				});
			} else if (isRemoteBranch) {
				confirmations.push({
					label: `为新的本地分支创建工作树...`,
					description: '避免修改当前工作树',
					detail: `将从 ${getReferenceLabel(state.reference)} 为新的本地分支创建工作树${
						state.createBranch ? `“${state.createBranch}”` : ''
					}${state.repos.length > 1 ? `（共 ${state.repos.length} 个仓库）` : ''}
					}`,
					item: 'switchToNewBranchViaWorktree',
				});
			} else {
				confirmations.push({
					label: `从 ${getReferenceTypeLabel(state.reference)} 为新分支创建工作树...`,
					description: '避免修改当前工作树',
					detail: `将从 ${getReferenceLabel(state.reference)} 为新分支创建工作树${
						state.createBranch ? `“${state.createBranch}”` : ''
					}${state.repos.length > 1 ? `（共 ${state.repos.length} 个仓库）` : ''}
					}`,
					item: 'switchToNewBranchViaWorktree',
				});
			}
		}

		if (isRemoteBranch && !state.createBranch) {
			if (confirmations.length) {
				confirmations.push(createQuickPickSeparator('检出'));
			}
			confirmations.push({
				label: `检出到远程分支`,
				description: '（分离 HEAD）',
				detail: `将检出到 ${getReferenceLabel(state.reference)}`,
				item: 'switch',
			});
		}

		const step = this.createConfirmStep(
			appendReposToTitle(
				`确认切换到 ${getReferenceLabel(state.reference, { icon: false, capitalize: true })}`,
				state,
				context,
			),
			confirmations,
			undefined,
			{
				placeholder: `确认${context.title}`,
			},
		);
		const selection: StepSelection<typeof step> = yield step;
		return canPickStepContinue(step, state, selection) ? selection[0].item : StepResultBreak;
	}
}
