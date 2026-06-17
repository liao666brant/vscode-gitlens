import type { MessageItem } from 'vscode';
import { Uri, window, workspace } from 'vscode';
import { WorktreeCreateError } from '@gitlens/git/errors.js';
import type { GitReference } from '@gitlens/git/models/reference.js';
import type { GitWorktree } from '@gitlens/git/models/worktree.js';
import {
	getReferenceLabel,
	getReferenceNameWithoutRemote,
	isBranchReference,
	isRevisionReference,
} from '@gitlens/git/utils/reference.utils.js';
import { basename } from '@gitlens/utils/path.js';
import type { Deferred } from '@gitlens/utils/promise.js';
import { truncateLeft } from '@gitlens/utils/string.js';
import type { Config } from '../../../config.js';
import type { Container } from '../../../container.js';
import { convertLocationToOpenFlags, revealWorktree } from '../../../git/actions/worktree.js';
import type { GlRepository } from '../../../git/models/repository.js';
import { getWorktreeForBranch } from '../../../git/utils/-webview/worktree.utils.js';
import { showGitErrorMessage } from '../../../messages.js';
import type { StartReviewChatAction, StartWorkChatAction } from '../../../plus/chat/chatActions.js';
import { storeChatActionDeepLink } from '../../../plus/chat/chatActions.js';
import { createQuickPickSeparator } from '../../../quickpicks/items/common.js';
import { Directive } from '../../../quickpicks/items/directive.js';
import type { FlagsQuickPickItem } from '../../../quickpicks/items/flags.js';
import { createFlagsQuickPickItem } from '../../../quickpicks/items/flags.js';
import { executeCommand } from '../../../system/-webview/command.js';
import { configuration } from '../../../system/-webview/configuration.js';
import { isDescendant } from '../../../system/-webview/path.js';
import { getWorkspaceFriendlyPath } from '../../../system/-webview/vscode/workspaces.js';
import { revealInFileExplorer } from '../../../system/-webview/vscode.js';
import type { OpenChatActionCommandArgs } from '../../openChatAction.js';
import type { CustomStep } from '../../quick-wizard/models/steps.custom.js';
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
import { inputBranchNameStep } from '../../quick-wizard/steps/branches.js';
import { pickBranchOrTagStep } from '../../quick-wizard/steps/references.js';
import { canSkipRepositoryPick, pickRepositoryStep } from '../../quick-wizard/steps/repositories.js';
import { StepsController } from '../../quick-wizard/stepsController.js';
import { getSteps } from '../../quick-wizard/utils/quickWizard.utils.js';
import {
	appendReposToTitle,
	assertStepState,
	canPickStepContinue,
	canStepContinue,
	createConfirmStep,
	createCustomStep,
} from '../../quick-wizard/utils/steps.utils.js';
import type { WorktreeContext } from '../worktree.js';
import type { WorktreeOpenState } from './open.js';

const Steps = {
	PickRepo: 'worktree-create-pick-repo',
	EnsureAccess: 'worktree-create-ensure-access',
	PickRef: 'worktree-create-pick-ref',
	InputBranchName: 'worktree-create-input-branch-name',
	Confirm: 'worktree-create-confirm',
	ConfirmChoosePath: 'worktree-create-confirm-choose-path',
} as const;
type StepNames = (typeof Steps)[keyof typeof Steps];
export type WorktreeCreateStepNames = StepNames;

type Context = WorktreeContext<StepNames>;

type ConfirmationChoice = Uri | 'changeRoot' | 'chooseFolder';
type Flags = '--force' | '-b' | '--detach' | '--direct';
interface State<Repo = string | GlRepository> {
	repo: Repo;
	worktree?: GitWorktree;
	uri: Uri;
	reference?: GitReference;
	addRemote?: { name: string; url: string };
	createBranch?: string;
	flags: Flags[];

	result?: Deferred<GitWorktree | undefined>;
	reveal?: boolean;

	overrides?: {
		title?: string;
	};

	onWorkspaceChanging?: ((isNewWorktree?: boolean) => Promise<void>) | ((isNewWorktree?: boolean) => void);
	/**
	 * Per-invocation override for the worktree's post-create open behavior:
	 *   - `'new'`     : force-open in a new window (skips the prompt)
	 *   - `'current'` : force-open in the current window (skips the prompt)
	 *   - `'none'`    : skip the open step entirely (caller handles the post-create work itself —
	 *                   e.g., CLI agent dispatch opens a terminal in the current window with `cwd`
	 *                   pointing to the worktree path, so no window switch is needed)
	 *   - undefined   : honor the user's `gitlens.worktrees.openAfterCreate` setting
	 */
	worktreeDefaultOpen?: 'new' | 'current' | 'none';

	// Chat action for deeplink storage
	chatAction?: StartWorkChatAction | StartReviewChatAction;
}
export type WorktreeCreateState = State;

export interface WorktreeCreateGitCommandArgs {
	readonly command: 'worktree-create';
	confirm?: boolean;
	state?: Partial<State>;
}

export class WorktreeCreateGitCommand extends QuickCommand<State> {
	private _canSkipConfirmOverride: boolean | undefined;

	constructor(container: Container, args?: WorktreeCreateGitCommandArgs) {
		super(container, 'worktree-create', 'create', '创建工作树', {
			description: '创建新的工作树',
		});

		this.initialState = { confirm: args?.confirm, flags: [], ...args?.state };
	}

	override get canSkipConfirm(): boolean {
		return this._canSkipConfirmOverride ?? false;
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
		// Don't allow skipping the confirm step
		state.confirm = true;
		this._canSkipConfirmOverride = undefined;

		let setCreateBranchFlag = false;

		try {
			while (!steps.isComplete) {
				context.title = state.overrides?.title ?? this.title;

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

				if (steps.isAtStepOrUnset(Steps.EnsureAccess)) {
					using step = steps.enterStep(Steps.EnsureAccess);

					const result = yield* ensureAccessStep(this.container, 'worktrees', state, context, step);
					if (result === StepResultBreak) {
						if (step.goBack() == null) break;
						continue;
					}
				}

				context.defaultUri ??= state.repo.git.worktrees?.getWorktreesDefaultUri();
				context.pickedRootFolder = undefined;
				context.pickedSpecificFolder = undefined;

				if (steps.isAtStep(Steps.PickRef) || state.reference == null) {
					using step = steps.enterStep(Steps.PickRef);

					const result = yield* pickBranchOrTagStep(state, context, {
						placeholder: ctx => `选择用于创建新工作树的分支${ctx.showTags ? '或标签' : ''}`,
						picked: state.reference?.ref ?? (await state.repo.git.branches.getBranch())?.ref,
						title: '选择用于创建工作树的分支',
						value: isRevisionReference(state.reference) ? state.reference.ref : undefined,
					});
					if (result === StepResultBreak) {
						state.reference = undefined!;
						if (step.goBack() == null) break;
						continue;
					}

					state.reference = result;
					if (setCreateBranchFlag) {
						state.flags = state.flags.filter(f => f !== '-b');
						setCreateBranchFlag = false;
					}
				}

				state.uri ??= context.defaultUri!;

				state.worktree =
					isBranchReference(state.reference) && !state.reference.remote
						? await getWorktreeForBranch(state.repo, state.reference.name, undefined, context.worktrees)
						: undefined;

				const isRemoteBranch = isBranchReference(state.reference) && state.reference?.remote;
				if (
					(isRemoteBranch || isRevisionReference(state.reference) || state.worktree != null) &&
					!state.flags.includes('-b')
				) {
					setCreateBranchFlag = true;
					state.flags.push('-b');
				} else {
					setCreateBranchFlag = false;
				}

				if (isRemoteBranch) {
					state.createBranch = getReferenceNameWithoutRemote(state.reference);
					const branch = await state.repo.git.branches.getBranch(state.createBranch);
					if (branch != null && !branch.remote) {
						state.createBranch = branch.name;
					}
				}

				if (state.flags.includes('-b')) {
					let createBranchOverride: string | undefined;
					if (state.createBranch != null) {
						let valid = await state.repo.git.refs.checkIfCouldBeValidBranchOrTagName(state.createBranch);
						if (valid) {
							const alreadyExists = await state.repo.git.branches.getBranch(state.createBranch);
							valid = alreadyExists == null;
						}

						if (!valid) {
							createBranchOverride = state.createBranch;
							state.createBranch = undefined;
						}
					}

					if (steps.isAtStep(Steps.InputBranchName) || state.createBranch == null) {
						using step = steps.enterStep(Steps.InputBranchName);

						const result = yield* inputBranchNameStep(state, context, {
							prompt: '请输入新分支名称',
							title: `${context.title}，并从 ${getReferenceLabel(state.reference, {
								capitalize: true,
								icon: false,
								label: state.reference.refType !== 'branch',
							})} 创建新分支`,
							value: createBranchOverride,
						});
						if (result === StepResultBreak) {
							state.createBranch = undefined;
							if (step.goBack() == null) break;
							continue;
						}

						state.createBranch = result;
					}
				}

				if (this.confirm(state.confirm)) {
					using step = steps.enterStep(Steps.Confirm);

					const result = yield* this.confirmStep(state, context);
					if (result === StepResultBreak) {
						state.uri = undefined!;
						if (step.goBack() == null) break;
						continue;
					}

					if (typeof result[0] === 'string') {
						switch (result[0]) {
							case 'changeRoot': {
								using pathStep = steps.enterStep(Steps.ConfirmChoosePath);

								const pathResult = yield* this.choosePathStep(state, context, {
									title: '为此工作树选择不同的根文件夹',
									label: '选择根文件夹',
									pickedUri: context.pickedRootFolder,
									defaultUri: context.pickedRootFolder ?? context.defaultUri,
								});
								if (pathResult === StepResultBreak) {
									state.uri = undefined!;
									if (pathStep.goBack() == null) break;
									continue;
								}

								state.uri = pathResult;
								// Keep track of the actual uri they picked, because we will modify it in later steps
								context.pickedRootFolder = state.uri;
								context.pickedSpecificFolder = undefined;
								return;
							}
							case 'chooseFolder': {
								using pathStep = steps.enterStep(Steps.ConfirmChoosePath);

								const pathResult = yield* this.choosePathStep(state, context, {
									title: '为此工作树选择指定文件夹',
									label: '选择工作树文件夹',
									pickedUri: context.pickedRootFolder,
									defaultUri: context.pickedSpecificFolder ?? context.defaultUri,
								});
								if (pathResult === StepResultBreak) {
									state.uri = undefined!;
									if (pathStep.goBack() == null) break;
									continue;
								}

								state.uri = pathResult;
								// Keep track of the actual uri they picked, because we will modify it in later steps
								context.pickedRootFolder = undefined;
								context.pickedSpecificFolder = state.uri;
								return;
							}
						}
					}

					state.uri = result[0] as Uri;
					state.flags = result[1];
				}

				// Reset any confirmation overrides
				state.confirm = true;
				this._canSkipConfirmOverride = undefined;

				const uri = state.flags.includes('--direct')
					? state.uri
					: Uri.joinPath(
							state.uri,
							...(state.createBranch ?? state.reference.name).replace(/\\/g, '/').split('/'),
						);

				let worktree: GitWorktree | undefined;
				try {
					if (state.addRemote != null) {
						await state.repo.git.remotes.addRemote?.(state.addRemote.name, state.addRemote.url, {
							fetch: true,
						});
					}

					worktree = await state.repo.git.worktrees?.createWorktreeWithResult(uri.fsPath, {
						commitish: state.reference?.name,
						createBranch: state.flags.includes('-b') ? state.createBranch : undefined,
						detach: state.flags.includes('--detach'),
						force: state.flags.includes('--force'),
					});
					state.result?.fulfill(worktree);

					// Wire the chatAction to the new worktree. Two paths:
					//   - CLI agent: dispatch inline in the current window — terminal opens here
					//     with `cwd = worktree.uri.fsPath`. No new window, no deep-link bridge.
					//   - Anything else (IDE chat, Claude extension, legacy): store the deep-link
					//     so it resumes in the new worktree window (per `worktreeDefaultOpen` /
					//     `gitlens.worktrees.openAfterCreate`).
					if (state.chatAction && worktree) {
						const chatActionWithPath = { ...state.chatAction, worktreePath: worktree.uri.fsPath };
						if (state.chatAction.agent?.kind === 'cli') {
							void executeCommand('gitlens.openChatAction', {
								chatAction: chatActionWithPath,
							} as OpenChatActionCommandArgs);
						} else {
							await storeChatActionDeepLink(this.container, chatActionWithPath, worktree.uri.fsPath);
						}
					}
				} catch (ex) {
					if (WorktreeCreateError.is(ex, 'alreadyCheckedOut') && !state.flags.includes('--force')) {
						const createBranch: MessageItem = { title: '创建新分支' };
						const force: MessageItem = { title: '仍然创建' };
						const cancel: MessageItem = { title: '取消', isCloseAffordance: true };
						const result = await window.showWarningMessage(
							`无法创建新工作树，因为 ${getReferenceLabel(state.reference, {
								icon: false,
								quoted: true,
							})} 已被检出。\n\n你希望为该工作树创建新分支，还是强制继续创建？`,
							{ modal: true },
							createBranch,
							force,
							cancel,
						);

						if (result === createBranch) {
							state.flags.push('-b');
							this._canSkipConfirmOverride = true;
							state.confirm = false;
							return;
						}

						if (result === force) {
							state.flags.push('--force');
							this._canSkipConfirmOverride = true;
							state.confirm = false;
							return;
						}
					} else if (WorktreeCreateError.is(ex, 'alreadyExists')) {
						const confirm: MessageItem = { title: '确定' };
						const openFolder: MessageItem = { title: '打开文件夹' };
						void window
							.showErrorMessage(
								`无法在 '${getWorkspaceFriendlyPath(uri)}' 创建新工作树，因为该文件夹已存在且不为空。`,
								confirm,
								openFolder,
							)
							.then(result => {
								if (result === openFolder) {
									void revealInFileExplorer(uri);
								}
							});
					} else {
						void showGitErrorMessage(ex, `无法在 '${getWorkspaceFriendlyPath(uri)}' 创建新工作树。`);
					}
				}

				steps.markStepsComplete();

				if (worktree == null) return StepResultBreak;

				if (state.reveal !== false) {
					setTimeout(() => {
						if (this.container.views.worktrees.visible) {
							void revealWorktree(worktree, { select: true, focus: false });
						}
					}, 100);
				}

				type OpenAction = Config['worktrees']['openAfterCreate'];
				const action: OpenAction = configuration.get('worktrees.openAfterCreate');
				if (state.worktreeDefaultOpen !== 'none' && action !== 'never') {
					let flags: WorktreeOpenState['flags'];
					switch (action) {
						case 'always':
							flags = convertLocationToOpenFlags('currentWindow');
							break;
						case 'alwaysNewWindow':
							flags = convertLocationToOpenFlags('newWindow');
							break;
						case 'onlyWhenEmpty':
							flags = convertLocationToOpenFlags(
								workspace.workspaceFolders?.length ? 'newWindow' : 'currentWindow',
							);
							break;
						default:
							flags = [];
							break;
					}

					yield* getSteps(
						this.container,
						{
							command: 'worktree',
							confirm: action === 'prompt',
							state: {
								subcommand: 'open',
								repo: state.repo,
								worktree: worktree,
								flags: flags,
								openOnly: true,
								overrides: { canGoBack: false },
								isNewWorktree: true,
								worktreeDefaultOpen: state.worktreeDefaultOpen,
								onWorkspaceChanging: state.onWorkspaceChanging,
							},
						},
						context,
						this.startedFrom,
					);
					break;
				}
			}
		} finally {
			if (state.result?.pending) {
				state.result.cancel(new Error('Create Worktree cancelled'));
			}
		}

		return steps.isComplete ? undefined : StepResultBreak;
	}

	private *choosePathStep(
		state: StepState<State<GlRepository>>,
		context: Context,
		options: { title: string; label: string; pickedUri: Uri | undefined; defaultUri?: Uri },
	): StepResultGenerator<Uri> {
		const step = createCustomStep<Uri>({
			show: async (_step: CustomStep<Uri>) => {
				const uris = await window.showOpenDialog({
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
					defaultUri: options.pickedUri ?? state.uri ?? context.defaultUri,
					openLabel: options.label,
					title: options.title,
				});

				if (uris == null || uris.length === 0) return Directive.Back;

				return uris[0];
			},
		});

		const value: StepSelection<typeof step> = yield step;
		if (!canStepContinue(step, state, value)) return StepResultBreak;

		return value;
	}

	private *confirmStep(
		state: StepState<State<GlRepository>>,
		context: Context,
	): StepResultGenerator<[ConfirmationChoice, Flags[]]> {
		/**
		 * Here are the rules for creating the recommended path for the new worktree:
		 *
		 * If the user picks a folder outside the repo, it will be `<chosen-path>/<repo>.worktrees/<?branch>`
		 * If the user picks the repo folder, it will be `<repo>/../<repo>.worktrees/<?branch>`
		 * If the user picks a folder inside the repo, it will be `<repo>/../<repo>.worktrees/<?branch>`
		 */

		let createDirectlyInFolder = false;
		if (context.pickedSpecificFolder != null) {
			createDirectlyInFolder = true;
		}

		let pickedUri = context.pickedSpecificFolder ?? context.pickedRootFolder ?? state.uri;

		let recommendedRootUri;

		const repoUri = state.repo.commonUri ?? state.repo.uri;
		const trailer = `${basename(repoUri.path)}.worktrees`;

		if (context.pickedRootFolder != null) {
			recommendedRootUri = context.pickedRootFolder;
		} else if (repoUri.toString() !== pickedUri.toString()) {
			if (isDescendant(pickedUri, repoUri)) {
				recommendedRootUri = Uri.joinPath(repoUri, '..', trailer);
			} else if (basename(pickedUri.path) === trailer) {
				pickedUri = Uri.joinPath(pickedUri, '..');
				recommendedRootUri = pickedUri;
			} else {
				recommendedRootUri = Uri.joinPath(pickedUri, trailer);
			}
		} else {
			recommendedRootUri = Uri.joinPath(repoUri, '..', trailer);
			// Don't allow creating directly into the main worktree folder
			createDirectlyInFolder = false;
		}

		const pickedFriendlyPath = truncateLeft(getWorkspaceFriendlyPath(pickedUri), 60);
		const branchName = state.reference != null ? getReferenceNameWithoutRemote(state.reference) : undefined;

		const recommendedFriendlyPath = `<root>/${truncateLeft(branchName?.replace(/\\/g, '/') ?? '', 65)}`;
		const recommendedNewBranchFriendlyPath = `<root>/${state.createBranch || '<新分支名称>'}`;

		const isBranch = isBranchReference(state.reference);
		const isRemoteBranch = isBranchReference(state.reference) && state.reference?.remote;

		type StepType = FlagsQuickPickItem<Flags, ConfirmationChoice>;
		const defaultOption = createFlagsQuickPickItem<Flags, Uri>(
			state.flags,
			state.createBranch ? ['-b'] : [],
			{
				label: isRemoteBranch
					? '从新的本地分支创建工作树'
					: isBranch
						? state.createBranch
							? '从新分支创建工作树'
							: '从分支创建工作树'
						: context.title,
				description: state.createBranch
					? state.createBranch
					: getReferenceLabel(state.reference, { icon: false, label: false }),
				detail: `将在 $(folder) ${
					state.createBranch ? recommendedNewBranchFriendlyPath : recommendedFriendlyPath
				} 创建工作树`,
			},
			recommendedRootUri,
		);

		const confirmations: StepType[] = [];
		if (!createDirectlyInFolder) {
			if (state.worktreeDefaultOpen) {
				return [defaultOption.context, defaultOption.item];
			}

			confirmations.push(defaultOption);
		} else {
			if (!state.createBranch) {
				confirmations.push(
					createFlagsQuickPickItem<Flags, Uri>(
						state.flags,
						['--direct'],
						{
							label: isRemoteBranch
								? '从本地分支创建工作树'
								: isBranch
									? '从分支创建工作树'
									: context.title,
							description: isBranch
								? getReferenceLabel(state.reference, { icon: false, label: false })
								: '',
							detail: `将在 $(folder) ${truncateLeft(pickedFriendlyPath, 60)} 直接创建工作树`,
						},
						pickedUri,
					),
				);
			}

			confirmations.push(
				createFlagsQuickPickItem<Flags, Uri>(
					state.flags,
					['-b', '--direct'],
					{
						label: isRemoteBranch ? '从新的本地分支创建工作树' : '从新分支创建工作树',
						description: state.createBranch,
						detail: `将在 $(folder) ${truncateLeft(pickedFriendlyPath, 60)} 直接创建工作树`,
					},
					pickedUri,
				),
			);
		}

		if (!createDirectlyInFolder) {
			confirmations.push(
				createQuickPickSeparator('更改位置'),
				createFlagsQuickPickItem<Flags, ConfirmationChoice>(
					[],
					[],
					{
						label: '更改根文件夹...',
						description: `$(folder) ${truncateLeft(
							context.pickedRootFolder ? pickedFriendlyPath : `${pickedFriendlyPath}/${trailer}`,
							65,
						)}`,
						picked: false,
					},
					'changeRoot',
				),
			);
		}

		confirmations.push(
			createFlagsQuickPickItem<Flags, ConfirmationChoice>(
				[],
				[],
				{
					label: '选择指定文件夹...',
					description: '在你选择的文件夹中直接创建',
					picked: false,
				},
				'chooseFolder',
			),
		);

		const step = createConfirmStep(
			appendReposToTitle(
				`确认 ${context.title} \u2022 ${
					state.createBranch ||
					getReferenceLabel(state.reference, {
						icon: false,
						label: false,
					})
				}`,
				state,
				context,
			),
			confirmations,
			context,
		);
		const selection: StepSelection<typeof step> = yield step;
		return canPickStepContinue(step, state, selection)
			? [selection[0].context, selection[0].item]
			: StepResultBreak;
	}
}
