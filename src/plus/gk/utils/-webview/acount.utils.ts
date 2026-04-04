import type { MessageItem, Uri } from 'vscode';
import { window } from 'vscode';
import { proTrialLengthInDays } from '../../../../constants.subscription.js';
import type { Source } from '../../../../constants.telemetry.js';
import type { Container } from '../../../../container.js';
import type { PlusFeatures } from '../../../../features.js';
import { isAdvancedFeature } from '../../../../features.js';
import { createQuickPickSeparator } from '../../../../quickpicks/items/common.js';
import type { DirectiveQuickPickItem } from '../../../../quickpicks/items/directive.js';
import { createDirectiveQuickPickItem, Directive } from '../../../../quickpicks/items/directive.js';

export async function ensureAccount(container: Container, title: string, source: Source): Promise<boolean> {
	while (true) {
		const subscription = await container.subscription.getSubscription();
		if (subscription.account?.verified === false) {
			const resend = { title: '重新发送邮件' };
			const cancel = { title: '取消', isCloseAffordance: true };
			const result = await window.showWarningMessage(
				title,
				{ modal: true, detail: '继续之前，您必须先验证邮箱。' },
				resend,
				cancel,
			);

			if (result === resend) {
				if (await container.subscription.resendVerification(source)) {
					continue;
				}
			}

			return false;
		}

		if (subscription.account != null) break;

		const signUp = { title: '试用 GitLens Pro' };
		const signIn = { title: '登录' };
		const cancel = { title: '取消', isCloseAffordance: true };
		const result = await window.showWarningMessage(
			title,
			{
				modal: true,
				detail: `立即开启 ${proTrialLengthInDays} 天免费 Pro 试用，完整访问所有 GitLens Pro 功能，或直接登录。`,
			},
			signUp,
			signIn,
			cancel,
		);

		if (result === signIn) {
			if (await container.subscription.loginOrSignUp(false, source)) {
				continue;
			}
		} else if (result === signUp) {
			if (await container.subscription.loginOrSignUp(true, source)) {
				continue;
			}
		}

		return false;
	}

	return true;
}

export async function ensureAccountQuickPick(
	container: Container,
	descriptionItem: DirectiveQuickPickItem,
	source: Source,
	silent?: boolean,
): Promise<boolean> {
	while (true) {
		const account = (await container.subscription.getSubscription()).account;
		if (account?.verified === true) break;

		if (silent) return false;

		const directives: DirectiveQuickPickItem[] = [descriptionItem];

		let placeholder = '继续需要账号';
		if (account?.verified === false) {
			directives.push(
				createDirectiveQuickPickItem(Directive.RequiresVerification, true),
				createQuickPickSeparator(),
				createDirectiveQuickPickItem(Directive.Cancel),
			);
			placeholder = '继续之前，您必须先验证邮箱';
		} else {
			directives.push(
				createDirectiveQuickPickItem(Directive.StartProTrial, true),
				createDirectiveQuickPickItem(Directive.SignIn),
				createQuickPickSeparator(),
				createDirectiveQuickPickItem(Directive.Cancel),
			);
		}

		const result = await window.showQuickPick(directives, {
			placeHolder: placeholder,
			ignoreFocusOut: true,
		});

		if (result == null) return false;
		if (result.directive === Directive.Noop) continue;

		if (result.directive === Directive.RequiresVerification) {
			if (await container.subscription.resendVerification(source)) {
				continue;
			}
		}
		if (result.directive === Directive.StartProTrial) {
			if (await container.subscription.loginOrSignUp(true, source)) {
				continue;
			}
		}
		if (result.directive === Directive.SignIn) {
			if (await container.subscription.loginOrSignUp(false, source)) {
				continue;
			}
		}

		return false;
	}

	return true;
}

export async function ensureFeatureAccess(
	container: Container,
	title: string,
	feature: PlusFeatures,
	source: Source,
	repoPath?: string | Uri,
): Promise<boolean> {
	if (!(await ensureAccount(container, title, source))) return false;

	while (true) {
		const access = await container.git.access(feature, repoPath);
		if (access.allowed) break;

		const isAdvanced = isAdvancedFeature(feature);
		const plan = isAdvanced ? 'advanced' : 'pro';

		const promo = await container.productConfig.getApplicablePromo(access.subscription.current.state, plan, 'gate');
		const promoDetail = promo?.content?.modal?.detail;

		const cancel = { title: '取消', isCloseAffordance: true };
		let upgrade: MessageItem;
		let result: MessageItem | undefined;

		if (isAdvanced) {
			upgrade = { title: '升级到 Advanced' };
			result = await window.showWarningMessage(
				title,
				{
					modal: true,
					detail: `请升级到 GitLens Advanced 以继续。${promoDetail ? `\n${promoDetail}` : ''}`,
				},
				upgrade,
				cancel,
			);
		} else {
			upgrade = { title: '升级到 Pro' };
			result = await window.showWarningMessage(
				title,
				{
					modal: true,
					detail: `请升级到 GitLens Pro 以继续。${promoDetail ? `\n${promoDetail}` : ''}`,
				},
				upgrade,
				cancel,
			);
		}

		if (result === upgrade) {
			if (await container.subscription.upgrade(plan, source)) {
				continue;
			}
		}

		return false;
	}

	return true;
}
