import type { GitFileConflictStatus, GitFileStatus } from '../models/fileStatus.js';

const statusIconsMap = {
	'.': undefined,
	'!': 'icon-status-ignored.svg',
	'?': 'icon-status-untracked.svg',
	A: 'icon-status-added.svg',
	D: 'icon-status-deleted.svg',
	M: 'icon-status-modified.svg',
	R: 'icon-status-renamed.svg',
	C: 'icon-status-copied.svg',
	AA: 'icon-status-conflict.svg',
	AU: 'icon-status-conflict.svg',
	UA: 'icon-status-conflict.svg',
	DD: 'icon-status-conflict.svg',
	DU: 'icon-status-conflict.svg',
	UD: 'icon-status-conflict.svg',
	UU: 'icon-status-conflict.svg',
	T: 'icon-status-modified.svg',
	U: 'icon-status-modified.svg',
};

export function getGitFileStatusIcon(status: GitFileStatus): string {
	return statusIconsMap[status] ?? 'icon-status-unknown.svg';
}

const statusTextMap = {
	'.': '未更改',
	'!': '已忽略',
	'?': '未跟踪',
	A: '已添加',
	D: '已删除',
	M: '已修改',
	R: '已重命名',
	C: '已复制',
	AA: '双方添加',
	AU: '当前添加',
	UA: '传入添加',
	DD: '双方删除',
	DU: '当前删除',
	UD: '传入删除',
	UU: '双方修改',
	T: '已修改',
	U: '已更新但未合并',
};

export function getGitFileStatusText(status: GitFileStatus | keyof typeof statusTextMap): string {
	return statusTextMap[status] ?? '未知';
}

const conflictStatuses = new Set<string>(['U', 'AA', 'AU', 'UA', 'DD', 'DU', 'UD', 'UU']);

export function isConflictStatus(status: string | undefined): status is 'U' | GitFileConflictStatus {
	return status != null && conflictStatuses.has(status);
}
