import { ThemeIcon } from 'vscode';
import { Container } from '../../../container.js';
import type { FeatureAccess, PlusFeatures, RepoFeatureAccess } from '../../../features.js';
import type { Repository } from '../../../git/models/repository.js';
import { getSubscriptionNextPaidPlanId, isSubscriptionPaidPlan } from '../../../plus/gk/utils/subscription.utils.js';
import { createQuickPickSeparator } from '../../../quickpicks/items/common.js';
import type { DirectiveQuickPickItem } from '../../../quickpicks/items/directive.js';
import { createDirectiveQuickPickItem, Directive } from '../../../quickpicks/items/directive.js';
import { executeCommand } from '../../../system/-webview/command.js';
import { getIconPathUris } from '../../../system/-webview/vscode.js';
import type { OpenWalkthroughCommandArgs } from '../../walkthroughs.js';
import type { AsyncStepResultGenerator, PartialStepState, StepSelection } from '../models/steps.js';
import { StepResultBreak } from '../models/steps.js';
import type { StepController } from '../stepsController.js';
import { canPickStepContinue, createPickStep } from '../utils/steps.utils.js';

export async function* ensureAccessStep<
	State extends PartialStepState & { repo?: Repository },
	Context extends { title: string },
>(
	container: Container,
	feature: PlusFeatures,
	state: State,
	context: Context,
	parentStep: StepController<any>,
): AsyncStepResultGenerator<FeatureAccess | RepoFeatureAccess> {
	const access = await container.git.access(feature, state.repo?.path);
	if (access.allowed) {
		parentStep.skip();
		return access;
	}

	const directives: DirectiveQuickPickItem[] = [];
	let placeholder: string;
	if (access.subscription.current.account?.verified === false) {
		directives.push(
			createDirectiveQuickPickItem(Directive.RequiresVerification, true),
			createQuickPickSeparator(),
			createDirectiveQuickPickItem(Directive.Cancel),
		);
		placeholder = '您必须先验证邮箱才能继续';
	} else {
		if (access.subscription.required == null) {
			parentStep.skip();
			return access;
		}

		const promo = await container.productConfig.getApplicablePromo(
			access.subscription.current.state,
			getSubscriptionNextPaidPlanId(access.subscription.current),
			'gate',
		);
		const detail = promo?.content?.quickpick.detail;

		switch (feature) {
			case 'graph':
			case 'timeline':
			case 'worktrees':
				placeholder =
					isSubscriptionPaidPlan(access.subscription.required) && access.subscription.current.account != null
						? '使用 GitLens Pro 解锁私有仓库的此功能'
						: '试用 GitLens Pro 以解锁私有仓库的此功能';
				break;
			default:
				placeholder =
					isSubscriptionPaidPlan(access.subscription.required) && access.subscription.current.account != null
						? '使用 GitLens Pro 解锁此功能'
						: '试用 GitLens Pro 以解锁此功能';
				break;
		}

		if (isSubscriptionPaidPlan(access.subscription.required) && access.subscription.current.account != null) {
			directives.push(
				createDirectiveQuickPickItem(Directive.RequiresPaidSubscription, true, { detail: detail }),
				createQuickPickSeparator(),
				createDirectiveQuickPickItem(Directive.Cancel),
			);
		} else {
			directives.push(
				createDirectiveQuickPickItem(Directive.StartProTrial, true),
				createDirectiveQuickPickItem(Directive.SignIn),
				createQuickPickSeparator(),
				createDirectiveQuickPickItem(Directive.Cancel),
			);
		}
	}

	switch (feature) {
		case 'launchpad':
			directives.splice(
				0,
				0,
				createDirectiveQuickPickItem(Directive.Cancel, undefined, {
					label: 'Launchpad 优先处理您的 Pull Request，帮助您保持专注并让团队不受阻碍',
					detail: 'Click to learn more about Launchpad',
					iconPath: new ThemeIcon('rocket'),
					onDidSelect: () =>
						void executeCommand<OpenWalkthroughCommandArgs>('gitlens.openWalkthrough', {
							step: 'accelerate-pr-reviews',
							source: { source: 'launchpad', detail: 'info' },
						}),
				}),
				createQuickPickSeparator(),
			);
			break;
		case 'startReview':
			directives.splice(
				0,
				0,
				createDirectiveQuickPickItem(Directive.Noop, undefined, {
					label: '从已连接的集成中开始审查 Pull Request',
					iconPath: new ThemeIcon('git-pull-request'),
				}),
				createQuickPickSeparator(),
			);
			break;
		case 'startWork':
			directives.splice(
				0,
				0,
				createDirectiveQuickPickItem(Directive.Noop, undefined, {
					label: '从已连接的集成中开始处理 Issue',
					iconPath: new ThemeIcon('issues'),
				}),
				createQuickPickSeparator(),
			);
			break;
		case 'associateIssueWithBranch':
			directives.splice(
				0,
				0,
				createDirectiveQuickPickItem(Directive.Noop, undefined, {
					label: '在主页视图中将分支与关联的 Issue 连接',
					iconPath: new ThemeIcon('issues'),
				}),
				createQuickPickSeparator(),
			);
			break;
		case 'worktrees':
			directives.splice(
				0,
				0,
				createDirectiveQuickPickItem(Directive.Noop, undefined, {
					label: 'Worktrees 允许同时在多个分支上工作，最大限度减少上下文切换',
					iconPath: getIconPathUris(Container.instance, 'icon-repo.svg'),
				}),
			);
			break;
	}

	const step = createPickStep<DirectiveQuickPickItem>({
		title: context.title,
		placeholder: placeholder,
		items: directives,
		buttons: [],
		isConfirmationStep: true,
	});

	const selection: StepSelection<typeof step> = yield step;
	return canPickStepContinue(step, state, selection) ? access : StepResultBreak;
}
