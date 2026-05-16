import type { GitFileStatus } from '../models/fileStatus.js';

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
	AA: '冲突',
	AU: '冲突',
	UA: '冲突',
	DD: '冲突',
	DU: '冲突',
	UD: '冲突',
	UU: '冲突',
	T: '已修改',
	U: '已更新但未合并',
};

export function getGitFileStatusText(status: GitFileStatus | keyof typeof statusTextMap): string {
	return statusTextMap[status] ?? '未知';
}
