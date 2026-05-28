import type { ConflictDetectionErrorReason, ConflictDetectionResult } from '../models/mergeConflicts.js';

export function createConflictDetectionError(reason: ConflictDetectionErrorReason): ConflictDetectionResult {
	return { status: 'error', reason: reason, message: getConflictDetectionErrorMessage(reason) };
}

function getConflictDetectionErrorMessage(reason: ConflictDetectionErrorReason): string {
	switch (reason) {
		case 'unsupported':
			return '无法检测冲突，因为需要 Git 2.38 或更高版本';
		case 'noParent':
			return '无法检测冲突，因为所选范围包含初始提交';
		case 'noMergeBase':
			return '无法检测冲突，因为这些分支没有共同历史';
		case 'refNotFound':
			return '无法检测冲突，因为分支或提交不存在';
		case 'other':
		default:
			return '无法检测冲突';
	}
}
