import type { QuickPickItem } from 'vscode';
import { window } from 'vscode';
import { map } from '@gitlens/utils/iterable.js';
import type { AIFeedbackEvent, AIFeedbackUnhelpfulReasons, Source } from '../../constants.telemetry.js';
import type { Container } from '../../container.js';
import type { AIResultContext } from './aiProviderService.js';

export interface UnhelpfulResult {
	reasons?: AIFeedbackUnhelpfulReasons[];
	custom?: string;
}

interface QuickPickItemOfT<T> extends QuickPickItem {
	item: T;
}

const negativeReasonsMap = new Map<AIFeedbackUnhelpfulReasons, string>([
	['suggestionInaccurate', '不准确或不正确'],
	['notRelevant', '不相关'],
	['missedImportantContext', '遗漏重要上下文'],
	['unclearOrPoorlyFormatted', '不清晰或格式不佳'],
	['genericOrRepetitive', '过于笼统或不够详细'],
	['other', '其他'],
]);

export async function showUnhelpfulFeedbackPicker(): Promise<UnhelpfulResult | undefined> {
	const items: QuickPickItemOfT<AIFeedbackUnhelpfulReasons>[] = [
		...map(negativeReasonsMap, ([type, reason]) => ({ label: reason, picked: false, item: type })),
	];

	// Show quick pick for preset reasons
	const selectedReasons = await window.showQuickPick(items, {
		title: '哪些方面可以改进？',
		canPickMany: true,
		placeHolder: '选择所有适用项（可选）',
	});

	if (selectedReasons == null) return undefined;

	let otherCustom: string | undefined;
	if (selectedReasons?.find(r => r.item === 'other')) {
		otherCustom = await window.showInputBox({
			title: '其他反馈',
			placeHolder: '描述你的体验...',
			prompt: '输入你的反馈，帮助我们改进 AI 功能（可选）。',
		});
	}

	return { reasons: selectedReasons?.map(r => r.item), custom: otherCustom };
}

export function sendFeedbackEvent(
	container: Container,
	source: Source,
	context: AIResultContext,
	sentiment: AIFeedbackEvent['sentiment'],
	unhelpful?: { reasons?: AIFeedbackUnhelpfulReasons[]; custom?: string },
): void {
	const eventData: AIFeedbackEvent = {
		type: context.type,
		feature: context.feature,
		sentiment: sentiment,
		'unhelpful.reasons': unhelpful?.reasons?.length ? unhelpful.reasons.join(',') : undefined,
		'unhelpful.custom': unhelpful?.custom?.trim() ?? undefined,

		id: context.id,
		'model.id': context.model.id,
		'model.provider.id': context.model.provider.id,
		'model.provider.name': context.model.provider.name,
		'usage.promptTokens': context.usage?.promptTokens,
		'usage.completionTokens': context.usage?.completionTokens,
		'usage.totalTokens': context.usage?.totalTokens,
		'usage.limits.used': context.usage?.limits?.used,
		'usage.limits.limit': context.usage?.limits?.limit,
		'usage.limits.resetsOn': context.usage?.limits?.resetsOn,
	};
	container.telemetry.sendEvent('ai/feedback', eventData, source);
}
