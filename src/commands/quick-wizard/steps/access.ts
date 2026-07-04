import { ThemeIcon } from 'vscode';
import { Container } from '../../../container.js';
import type { FeatureAccess, PlusFeatures, RepoFeatureAccess } from '../../../features.js';
import type { GlRepository } from '../../../git/models/repository.js';
import { createQuickPickSeparator } from '../../../quickpicks/items/common.js';
import type { DirectiveQuickPickItem } from '../../../quickpicks/items/directive.js';
import { createDirectiveQuickPickItem, Directive } from '../../../quickpicks/items/directive.js';
import { getIconPathUris } from '../../../system/-webview/vscode.js';
import type { AsyncStepResultGenerator, PartialStepState, StepSelection } from '../models/steps.js';
import { StepResultBreak } from '../models/steps.js';
import type { StepController } from '../stepsController.js';
import { canPickStepContinue, createPickStep } from '../utils/steps.utils.js';

export async function* ensureAccessStep<
	State extends PartialStepState & { repo?: GlRepository },
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

		switch (feature) {
			case 'graph':
			case 'timeline':
			case 'worktrees':
				placeholder = '此功能在当前社区构建中不可用';
				break;
			default:
				placeholder = '此功能在当前社区构建中不可用';
				break;
		}

		directives.push(
			createDirectiveQuickPickItem(Directive.Noop, undefined, {
				label: '此功能已从社区构建中移除',
				iconPath: new ThemeIcon('circle-slash'),
			}),
			createQuickPickSeparator(),
			createDirectiveQuickPickItem(Directive.Cancel),
		);
	}

	switch (feature) {
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
