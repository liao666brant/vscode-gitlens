import type { Container } from '../../container.js';
import { formatDate, fromNow } from '../../system/date.js';
import { loggable } from '../../system/decorators/log.js';
import { memoize } from '../../system/decorators/memoize.js';
import { getTagId, parseRefName } from '../utils/tag.utils.js';
import type { GitTagReference } from './reference.js';

export function isTag(tag: unknown): tag is GitTag {
	return tag instanceof GitTag;
}

@loggable(i => i.id)
export class GitTag implements GitTagReference {
	readonly refType = 'tag';
	readonly id: string;

	private readonly _name: string;
	get name(): string {
		return this._name;
	}

	constructor(
		private readonly container: Container,
		public readonly repoPath: string,
		public readonly refName: string,
		public readonly sha: string,
		public readonly message: string,
		public readonly date: Date | undefined,
		public readonly commitDate: Date | undefined,
	) {
		({ name: this._name } = parseRefName(refName));

		this.id = getTagId(repoPath, this._name);
	}

	get formattedDate(): string {
		return this.container.TagDateFormatting.dateStyle === 'absolute'
			? this.formatDate(this.container.TagDateFormatting.dateFormat)
			: this.formatDateFromNow();
	}

	get ref(): string {
		return this.name;
	}

	@memoize<GitTag['formatCommitDate']>({ resolver: format => format ?? 'YYYY年M月D日 HH:mm' })
	formatCommitDate(format?: string | null): string {
		return this.commitDate != null ? formatDate(this.commitDate, format ?? 'YYYY年M月D日 HH:mm') : '';
	}

	formatCommitDateFromNow(): string {
		return this.commitDate != null ? fromNow(this.commitDate) : '';
	}

	@memoize<GitTag['formatDate']>({ resolver: format => format ?? 'YYYY年M月D日 HH:mm' })
	formatDate(format?: string | null): string {
		return this.date != null ? formatDate(this.date, format ?? 'YYYY年M月D日 HH:mm') : '';
	}

	formatDateFromNow(): string {
		return this.date != null ? fromNow(this.date) : '';
	}

	@memoize()
	getBasename(): string {
		const index = this.name.lastIndexOf('/');
		return index !== -1 ? this.name.substring(index + 1) : this.name;
	}

	/** Creates a copy of this tag with a different repoPath — ONLY used for worktree-aware caching */
	withRepoPath(repoPath: string): GitTag {
		return repoPath === this.repoPath
			? this
			: new GitTag(this.container, repoPath, this.refName, this.sha, this.message, this.date, this.commitDate);
	}
}
