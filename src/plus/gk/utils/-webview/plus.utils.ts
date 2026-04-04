import type { MessageItem } from 'vscode';
import { window } from 'vscode';
import { proTrialLengthInDays } from '../../../../constants.subscription.js';
import type { Source } from '../../../../constants.telemetry.js';
import type { Container } from '../../../../container.js';
import { configuration } from '../../../../system/-webview/configuration.js';
import { getContext } from '../../../../system/-webview/context.js';
import { isSubscriptionPaidPlan } from '../subscription.utils.js';

export function arePlusFeaturesEnabled(): boolean {
	const enabled = configuration.get('plusFeatures.enabled', undefined, true);
	return enabled ? true : !getContext('gitlens:plus:disabled');
}

export async function ensurePlusFeaturesEnabled(): Promise<boolean> {
	if (arePlusFeaturesEnabled()) return true;

	const confirm: MessageItem = { title: '启用' };
	const cancel: MessageItem = { title: '取消', isCloseAffordance: true };
	const result = await window.showInformationMessage(
		'Pro 功能当前已禁用。是否启用？',
		{ modal: true },
		confirm,
		cancel,
	);

	if (result !== confirm) return false;

	await configuration.updateEffective('plusFeatures.enabled', true);
	return true;
}

export async function ensurePaidPlan(container: Container, title: string, source: Source): Promise<boolean> {
	while (true) {
		const subscription = await container.subscription.getSubscription();
		if (subscription.account?.verified === false) {
			const resend = { title: '重新发送邮件' };
			const cancel = { title: '取消', isCloseAffordance: true };
			const result = await window.showWarningMessage(
				`${title}\n\n继续之前，您必须先验证邮箱。`,
				{ modal: true },
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

		const plan = subscription.plan.effective.id;
		if (isSubscriptionPaidPlan(plan)) break;

		if (subscription.account == null) {
			const signUp = { title: '试用 GitLens Pro' };
			const signIn = { title: '登录' };
			const cancel = { title: '取消', isCloseAffordance: true };
			const result = await window.showWarningMessage(
				`${title}\n\n是否开始 ${proTrialLengthInDays} 天免费 Pro 试用，以完整访问所有 GitLens Pro 功能？`,
				{ modal: true },
				signUp,
				signIn,
				cancel,
			);

			if (result === signUp || result === signIn) {
				if (await container.subscription.loginOrSignUp(result === signUp, source)) {
					continue;
				}
			}
		} else {
			const upgrade = { title: '升级到 Pro' };
			const cancel = { title: '取消', isCloseAffordance: true };
			const result = await window.showWarningMessage(
				`${title}\n\n是否升级以完整访问所有 GitLens Pro 功能？`,
				{ modal: true },
				upgrade,
				cancel,
			);

			if (result === upgrade) {
				void container.subscription.upgrade('pro', source);
			}
		}

		return false;
	}

	return true;
}
