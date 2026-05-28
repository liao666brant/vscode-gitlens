import type { GitBranchReference, GitReference } from '@gitlens/git/models/reference.js';
import { getRemoteNameFromBranchName } from '@gitlens/git/utils/branch.utils.js';
import { getReferenceLabel, isBranchReference } from '@gitlens/git/utils/reference.utils.js';
import { isStringArray } from '@gitlens/utils/array.js';
import { fromNow } from '@gitlens/utils/date.js';
import { pad, pluralize } from '@gitlens/utils/string.js';
import { GlyphChars } from '../../constants.js';
import type { Container } from '../../container.js';
import type { GlRepository } from '../../git/models/repository.js';
import { createDirectiveQuickPickItem, Directive } from '../../quickpicks/items/directive.js';
import type { FlagsQuickPickItem } from '../../quickpicks/items/flags.js';
import { createFlagsQuickPickItem } from '../../quickpicks/items/flags.js';
import { configuration } from '../../system/-webview/configuration.js';
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
import { FetchQuickInputButton } from '../quick-wizard/quickButtons.js';
import { QuickCommand } from '../quick-wizard/quickCommand.js';
import { pickRepositoriesStep, pickRepositoryStep } from '../quick-wizard/steps/repositories.js';
import { StepsController } from '../quick-wizard/stepsController.js';
import { appendReposToTitle, assertStepState, canPickStepContinue } from '../quick-wizard/utils/steps.utils.js';

const Steps = {
	PickRepos: 'push-pick-repos',
	Confirm: 'push-confirm',
} as const;
type StepNames = (typeof Steps)[keyof typeof Steps];

interface Context extends StepsContext<StepNames> {
	repos: GlRepository[];
	associatedView: ViewsWithRepositoryFolders;
	title: string;
}

type Flags = '--force' | '--set-upstream' | string;
interface State<Repos = string | string[] | GlRepository | GlRepository[]> {
	repos: Repos;
	reference?: GitReference;
	flags: Flags[];
}

export interface PushGitCommandArgs {
	readonly command: 'push';
	confirm?: boolean;
	state?: Partial<State>;
}

function formatCommitCount(count: number | undefined) {
	return `${count ?? 0} 个提交`;
}

export class PushGitCommand extends QuickCommand<State> {
	constructor(container: Container, args?: PushGitCommandArgs) {
		super(container, 'push', 'push', '推送', {
			description: '将当前分支的更改推送到远程',
		});

		this.initialState = { confirm: args?.confirm, ...args?.state };
	}

	private execute(state: StepState<State<GlRepository[]>>) {
		const index = state.flags.indexOf('--set-upstream');
		if (index !== -1) {
			return this.container.git.pushAll(state.repos, {
				force: false,
				publish: { remote: state.flags[index + 1] },
				reference: state.reference,
			});
		}

		return this.container.git.pushAll(state.repos, {
			force: state.flags.includes('--force'),
			reference: state.reference,
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
				} else if (state.reference != null) {
					// If a reference is specified, only allow picking the repository that contains it
					using step = steps.enterStep(Steps.PickRepos);

					const result = yield* pickRepositoryStep(
						{ ...state, repos: undefined, repo: state.reference.repoPath },
						context,
						step,
					);
					if (result === StepResultBreak) {
						state.repos = undefined!;
						if (step.goBack() == null) break;
						continue;
					}

					state.repos = [result];
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
		const useForceWithLease = configuration.getCore('git.useForcePushWithLease') ?? true;
		const useForceIfIncludes =
			useForceWithLease &&
			(configuration.getCore('git.useForcePushIfIncludes') ?? true) &&
			(await state.repos[0].git.supports('git:push:force-if-includes'));
		const forcePushLabelSuffix = useForceIfIncludes
			? '（with-lease 且 force-if-includes）'
			: useForceWithLease
				? '（with-lease）'
				: '';
		const forcePushDescription = `--force${
			useForceWithLease ? `-with-lease${useForceIfIncludes ? ' --force-if-includes' : ''}` : ''
		}`;

		let step: QuickPickStep<FlagsQuickPickItem<Flags>>;

		if (state.repos.length > 1) {
			step = this.createConfirmStep(appendReposToTitle(`确认${context.title}`, state, context), [
				createFlagsQuickPickItem<Flags>(state.flags, [], {
					label: this.title,
					detail: `将推送 ${state.repos.length} 个仓库`,
				}),
				createFlagsQuickPickItem<Flags>(state.flags, ['--force'], {
					label: `强制${this.title}${forcePushLabelSuffix}`,
					description: forcePushDescription,
					detail: `将强制推送 ${state.repos.length} 个仓库${forcePushLabelSuffix}`,
				}),
			]);
		} else {
			const [repo] = state.repos;

			const items: FlagsQuickPickItem<Flags>[] = [];

			if (isBranchReference(state.reference)) {
				if (state.reference.remote) {
					step = this.createConfirmStep(
						appendReposToTitle(context.title, state, context),
						[],
						createDirectiveQuickPickItem(Directive.Cancel, true, {
							label: '确定',
							detail: '无法推送远程分支',
						}),
						{ placeholder: '无法推送远程分支' },
					);
				} else {
					const branch = await repo.git.branches.getBranch(state.reference.name);

					if (branch != null && branch?.upstream == null) {
						for (const remote of await repo.git.remotes.getRemotes()) {
							items.push(
								createFlagsQuickPickItem<Flags>(
									state.flags,
									['--set-upstream', remote.name, branch.name],
									{
										label: `发布 ${branch.name} 到 ${remote.name}`,
										detail: `将把 ${getReferenceLabel(branch)} 发布到 ${remote.name}`,
									},
								),
							);
						}

						if (items.length) {
							step = this.createConfirmStep(
								appendReposToTitle('确认发布', state, context),
								items,
								undefined,
								{ placeholder: '确认发布' },
							);
						} else {
							step = this.createConfirmStep(
								appendReposToTitle('发布', state, context),
								[],
								createDirectiveQuickPickItem(Directive.Cancel, true, {
									label: '确定',
									detail: '未找到远程仓库',
								}),
								{ placeholder: '无法发布；未找到远程仓库' },
							);
						}
					} else if (branch?.upstream?.state.behind) {
						step = this.createConfirmStep(
							appendReposToTitle(`确认${context.title}`, state, context),
							[
								createFlagsQuickPickItem<Flags>(state.flags, ['--force'], {
									label: `强制${this.title}${forcePushLabelSuffix}`,
									description: forcePushDescription,
									detail: `将强制推送${
										branch?.upstream.state.ahead
											? ` ${formatCommitCount(branch.upstream.state.ahead)}`
											: ''
									}${branch.remoteName ? ` 到 ${branch.remoteName}` : ''}${
										branch != null && branch.upstream.state.behind > 0
											? `，覆盖 ${branch?.remoteName ? `${branch.remoteName} 上的 ` : ''}${formatCommitCount(
													branch.upstream.state.behind,
												)}`
											: ''
									}${forcePushLabelSuffix}`,
								}),
							],
							createDirectiveQuickPickItem(Directive.Cancel, true, {
								label: `取消${this.title}`,
								detail: `无法推送；${getReferenceLabel(branch)} 落后于 ${branch.remoteName} ${formatCommitCount(
									branch.upstream.state.behind,
								)}`,
							}),
						);
					} else if (branch?.upstream?.state.ahead) {
						step = this.createConfirmStep(appendReposToTitle(`确认${context.title}`, state, context), [
							createFlagsQuickPickItem<Flags>(state.flags, [branch.remoteName!], {
								label: this.title,
								detail: `将把 ${formatCommitCount(branch.upstream.state.ahead)} 从 ${getReferenceLabel(
									branch,
								)} 推送到 ${branch.remoteName}`,
							}),
						]);
					} else {
						step = this.createConfirmStep(
							appendReposToTitle(context.title, state, context),
							[],
							createDirectiveQuickPickItem(Directive.Cancel, true, {
								label: '确定',
								detail: '没有可推送的提交',
							}),
							{ placeholder: '无可推送内容；没有可推送的提交' },
						);
					}
				}
			} else {
				const status = await repo.git.status.getStatus();

				const branch: GitBranchReference = {
					refType: 'branch',
					name: status?.branch ?? 'HEAD',
					ref: status?.branch ?? 'HEAD',
					remote: false,
					repoPath: repo.path,
				};

				if (status?.upstream?.state.ahead === 0) {
					if (!isBranchReference(state.reference) && status.upstream == null) {
						let pushDetails;

						if (state.reference != null) {
							pushDetails = ` 截至并包括 ${getReferenceLabel(state.reference, {
								label: false,
							})} 的提交`;
						} else {
							state.reference = branch;
							pushDetails = '';
						}

						for (const remote of await repo.git.remotes.getRemotes()) {
							items.push(
								createFlagsQuickPickItem<Flags>(
									state.flags,
									['--set-upstream', remote.name, status.branch],
									{
										label: `发布 ${branch.name} 到 ${remote.name}`,
										detail: `将把 ${getReferenceLabel(branch)}${pushDetails} 发布到 ${remote.name}`,
									},
								),
							);
						}
					}

					if (items.length) {
						step = this.createConfirmStep(
							appendReposToTitle('确认发布', state, context),
							items,
							undefined,
							{ placeholder: '确认发布' },
						);
					} else if (status.upstream == null) {
						step = this.createConfirmStep(
							appendReposToTitle('发布', state, context),
							[],
							createDirectiveQuickPickItem(Directive.Cancel, true, {
								label: '确定',
								detail: '未找到远程仓库',
							}),
							{ placeholder: '无法发布；未找到远程仓库' },
						);
					} else {
						step = this.createConfirmStep(
							appendReposToTitle(context.title, state, context),
							[],
							createDirectiveQuickPickItem(Directive.Cancel, true, {
								label: '确定',
								detail: `没有领先于 ${getRemoteNameFromBranchName(status.upstream?.name)} 的提交`,
							}),
							{
								placeholder: `无可推送内容；没有领先于 ${getRemoteNameFromBranchName(
									status.upstream?.name,
								)} 的提交`,
							},
						);
					}
				} else {
					let lastFetchedOn = '';

					const lastFetched = await repo.getLastFetched();
					if (lastFetched !== 0) {
						lastFetchedOn = `${pad(GlyphChars.Dot, 2, 2)}上次抓取于 ${fromNow(new Date(lastFetched))}`;
					}

					const upstreamRemoteName = status?.upstream
						? getRemoteNameFromBranchName(status.upstream?.name)
						: undefined;
					let pushDetails;
					if (state.reference != null) {
						pushDetails = `截至并包括 ${getReferenceLabel(state.reference, {
							label: false,
						})} 的提交${upstreamRemoteName ? ` 到 ${upstreamRemoteName}` : ''}`;
					} else {
						pushDetails = `${
							status?.upstream?.state.ahead
								? formatCommitCount(status.upstream.state.ahead)
								: '当前分支的提交'
						}${upstreamRemoteName ? ` 到 ${upstreamRemoteName}` : ''}`;
					}

					step = this.createConfirmStep(
						appendReposToTitle(`确认${context.title}`, state, context, lastFetchedOn),
						[
							...(status?.upstream?.state.behind
								? []
								: [
										createFlagsQuickPickItem<Flags>(state.flags, [], {
											label: this.title,
											detail: `将推送 ${pushDetails}`,
										}),
									]),
							createFlagsQuickPickItem<Flags>(state.flags, ['--force'], {
								label: `强制${this.title}${forcePushLabelSuffix}`,
								description: forcePushDescription,
								detail: `将强制推送 ${pushDetails}${
									status?.upstream?.state.behind
										? `，覆盖 ${status?.upstream ? `${getRemoteNameFromBranchName(status.upstream?.name)} 上的 ` : ''}${formatCommitCount(
												status.upstream.state.behind,
											)}`
										: ''
								}${forcePushLabelSuffix}`,
							}),
						],
						status?.upstream?.state.behind
							? createDirectiveQuickPickItem(Directive.Cancel, true, {
									label: `取消${this.title}`,
									detail: `无法推送；${getReferenceLabel(branch)} 落后于${
										status?.upstream ? ` ${getRemoteNameFromBranchName(status.upstream?.name)}` : ''
									} ${formatCommitCount(status.upstream.state.behind)}`,
								})
							: undefined,
					);

					step.additionalButtons = [FetchQuickInputButton];
					step.onDidClickButton = async (quickpick, button) => {
						if (button !== FetchQuickInputButton || quickpick.busy) return false;

						quickpick.title = `确认${context.title}${pad(GlyphChars.Dot, 2, 2)}正在抓取${
							GlyphChars.Ellipsis
						}`;

						quickpick.busy = true;
						try {
							await repo.git.fetch({ progress: true });
							// Signal that the step should be retried
							return true;
						} finally {
							quickpick.busy = false;
						}
					};
				}
			}
		}

		const selection: StepSelection<typeof step> = yield step;
		return canPickStepContinue(step, state, selection) ? selection[0].item : StepResultBreak;
	}
}
