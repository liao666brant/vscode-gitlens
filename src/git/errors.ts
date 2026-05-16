import type { GitPausedOperationStatus } from './models/pausedOperationStatus.js';

function formatCommitCount(count: number) {
	return `${count} 个提交`;
}

function getPausedOperationTypeLabel(type: GitPausedOperationStatus['type']) {
	switch (type) {
		case 'merge':
			return '合并';
		case 'rebase':
			return '变基';
		case 'revert':
			return '撤销';
		case 'cherry-pick':
			return '拣选提交';
		default:
			return type;
	}
}

export interface GitCommandContext {
	readonly repoPath: string;
	readonly args: readonly (string | undefined)[];
}

export abstract class GitCommandError<Details extends { gitCommand?: GitCommandContext }> extends Error {
	static is(ex: unknown): ex is GitCommandError<any> {
		return ex instanceof GitCommandError;
	}

	private _details!: Details;
	get details(): Details {
		return this._details;
	}
	private set details(details: Details) {
		this._details = details;
		this.message = this.buildErrorMessage(details);
	}

	readonly original?: Error;

	constructor(message: string, details: Details, original: Error | undefined) {
		super(message);
		this.original = original;
		this.details = details;
		Error.captureStackTrace?.(this, new.target);
	}

	protected abstract buildErrorMessage(details: Details): string;

	update(changes: Details): this {
		this.details = { ...this.details, ...changes };
		return this;
	}
}

export class GitSearchError extends Error {
	constructor(public readonly original: Error) {
		super(original.message);

		Error.captureStackTrace?.(this, new.target);
	}
}

export type ApplyPatchCommitErrorReason =
	| 'appliedWithConflicts'
	| 'applyFailed'
	| 'checkoutFailed'
	| 'createWorktreeFailed'
	| 'stashFailed'
	| 'wouldOverwriteChanges';
interface ApplyPatchCommitErrorDetails {
	reason?: ApplyPatchCommitErrorReason;
	branch?: string;
	gitCommand?: GitCommandContext;
}

export class ApplyPatchCommitError extends GitCommandError<ApplyPatchCommitErrorDetails> {
	static override is(ex: unknown, reason?: ApplyPatchCommitErrorReason): ex is ApplyPatchCommitError {
		return ex instanceof ApplyPatchCommitError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: ApplyPatchCommitErrorDetails, original?: Error) {
		super('无法应用补丁', details, original);
	}

	override buildErrorMessage(details: ApplyPatchCommitErrorDetails): string {
		const baseMessage = '无法应用补丁';
		switch (details.reason) {
			case 'applyFailed':
				return `${baseMessage}${this.original instanceof CherryPickError ? `. ${this.original.message}` : ''}`;
			case 'appliedWithConflicts':
				return '补丁已应用，但存在冲突';
			case 'checkoutFailed':
				return `${baseMessage}，因为无法检出分支“${details.branch}”${
					this.original instanceof CheckoutError ? `. ${this.original.message}` : ''
				}`;
			case 'createWorktreeFailed':
				return `${baseMessage}，因为无法创建工作树${
					this.original instanceof WorktreeCreateError ? `. ${this.original.message}` : ''
				}`;
			case 'stashFailed':
				return `${baseMessage}，因为无法存储你的工作区更改${
					this.original instanceof StashPushError ? `. ${this.original.message}` : ''
				}`;
			case 'wouldOverwriteChanges':
				return `${baseMessage}，因为会覆盖部分本地更改`;
			default:
				return baseMessage;
		}
	}
}

export class BlameIgnoreRevsFileError extends Error {
	static is(ex: unknown): ex is BlameIgnoreRevsFileError {
		return ex instanceof BlameIgnoreRevsFileError;
	}

	constructor(
		public readonly fileName: string,
		public readonly original?: Error,
	) {
		super(`无效的 blame.ignoreRevsFile：'${fileName}'`);

		Error.captureStackTrace?.(this, new.target);
	}
}

export class BlameIgnoreRevsFileBadRevisionError extends Error {
	static is(ex: unknown): ex is BlameIgnoreRevsFileBadRevisionError {
		return ex instanceof BlameIgnoreRevsFileBadRevisionError;
	}

	constructor(
		public readonly revision: string,
		public readonly original?: Error,
	) {
		super(`blame.ignoreRevsFile 中存在无效的修订版本：'${revision}'`);

		Error.captureStackTrace?.(this, new.target);
	}
}

export type BranchErrorReason = 'alreadyExists' | 'notFullyMerged' | 'invalidName' | 'noRemoteReference' | 'other';
interface BranchErrorDetails {
	reason?: BranchErrorReason;
	action?: string;
	branch?: string;
	gitCommand?: GitCommandContext;
}

export class BranchError extends GitCommandError<BranchErrorDetails> {
	static override is(ex: unknown, reason?: BranchErrorReason): ex is BranchError {
		return ex instanceof BranchError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: BranchErrorDetails, original?: Error) {
		super('无法对分支执行操作', details, original);
	}

	protected override buildErrorMessage(details: BranchErrorDetails): string {
		let baseMessage: string;
		if (details.action != null) {
			baseMessage = `无法${details.action}分支${details.branch ? `“${details.branch}”` : ''}`;
		} else {
			baseMessage = `无法执行分支操作${details.branch ? `，分支为“${details.branch}”` : ''}`;
		}
		switch (details.reason) {
			case 'alreadyExists':
				return `${baseMessage}，因为它已存在`;
			case 'notFullyMerged':
				return `${baseMessage}，因为它尚未完全合并`;
			case 'invalidName':
				return `${baseMessage}，因为分支名称无效`;
			case 'noRemoteReference':
				return `${baseMessage}，因为远程引用不存在`;
			default:
				return baseMessage;
		}
	}
}

export type CheckoutErrorReason = 'invalidRef' | 'pathspecNotFound' | 'wouldOverwriteChanges' | 'other';
interface CheckoutErrorDetails {
	reason?: CheckoutErrorReason;
	ref?: string;
	gitCommand?: GitCommandContext;
}

export class CheckoutError extends GitCommandError<CheckoutErrorDetails> {
	static override is(ex: unknown, reason?: CheckoutErrorReason): ex is CheckoutError {
		return ex instanceof CheckoutError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: CheckoutErrorDetails, original?: Error) {
		super('无法检出', details, original);
	}

	protected override buildErrorMessage(details: CheckoutErrorDetails): string {
		const baseMessage = `无法检出${details.ref ? `“${details.ref}”` : ''}`;
		switch (details.reason) {
			case 'invalidRef':
				return `${baseMessage}，因为引用无效`;
			case 'pathspecNotFound':
				return `${baseMessage}，因为路径或引用不存在`;
			case 'wouldOverwriteChanges':
				return `${baseMessage}。你的本地更改会被覆盖。请在切换分支前先提交或存储更改。`;
			default:
				return baseMessage;
		}
	}
}

export type CherryPickErrorReason =
	| 'aborted'
	| 'alreadyInProgress'
	| 'conflicts'
	| 'emptyCommit'
	| 'wouldOverwriteChanges'
	| 'other';
interface CherryPickErrorDetails {
	reason?: CherryPickErrorReason;
	revs?: string[];
	gitCommand?: GitCommandContext;
}

export class CherryPickError extends GitCommandError<CherryPickErrorDetails> {
	static override is(ex: unknown, reason?: CherryPickErrorReason): ex is CherryPickError {
		return ex instanceof CherryPickError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: CherryPickErrorDetails, original?: Error) {
		super('无法拣选提交', details, original);
	}

	protected override buildErrorMessage(details: CherryPickErrorDetails): string {
		const baseMessage = `无法拣选提交${
			details.revs?.length
				? details.revs.length === 1
					? `“${details.revs[0]}”`
					: ` ${formatCommitCount(details.revs.length)}`
				: ''
		}`;

		switch (details.reason) {
			case 'aborted':
				return `${baseMessage}，因为该操作已中止。`;
			case 'alreadyInProgress':
				return `${baseMessage}，因为当前已有拣选提交正在进行。`;
			case 'conflicts':
				return `${baseMessage}，因为存在冲突。`;
			case 'emptyCommit':
				return `${baseMessage}，因为这是一个空提交。`;
			case 'wouldOverwriteChanges':
				return `${baseMessage}，因为会覆盖部分本地更改。`;
			default:
				return baseMessage;
		}
	}
}

export type FetchErrorReason = 'noFastForward' | 'noRemote' | 'remoteConnectionFailed' | 'other';
interface FetchErrorDetails {
	reason?: FetchErrorReason;
	branch?: string;
	remote?: string;
	gitCommand?: GitCommandContext;
}

export class FetchError extends GitCommandError<FetchErrorDetails> {
	static override is(ex: unknown, reason?: FetchErrorReason): ex is FetchError {
		return ex instanceof FetchError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: FetchErrorDetails, original?: Error) {
		super('无法抓取', details, original);
	}

	protected override buildErrorMessage(details: FetchErrorDetails): string {
		const baseMessage = `无法抓取${details.branch ? `分支“${details.branch}”` : ''}${
			details.remote ? `（来自 ${details.remote}）` : ''
		}`;
		switch (details.reason) {
			case 'noFastForward':
				return `${baseMessage}，因为无法快进`;
			case 'noRemote':
				return `${baseMessage}，因为未指定远程仓库。`;
			case 'remoteConnectionFailed':
				return `${baseMessage}。无法连接到远程仓库。`;
			default:
				return baseMessage;
		}
	}
}

export type MergeErrorReason =
	| 'aborted'
	| 'alreadyInProgress'
	| 'conflicts'
	| 'uncommittedChanges'
	| 'wouldOverwriteChanges'
	| 'other';
interface MergeErrorDetails {
	reason?: MergeErrorReason;
	ref?: string;
	gitCommand?: GitCommandContext;
}
export class MergeError extends GitCommandError<MergeErrorDetails> {
	static override is(ex: unknown, reason?: MergeErrorReason): ex is MergeError {
		return ex instanceof MergeError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: MergeErrorDetails, original?: Error) {
		super('无法合并', details, original);
	}

	protected override buildErrorMessage(details: MergeErrorDetails): string {
		const baseMessage = `无法合并${details.ref ? `“${details.ref}”` : ''}`;

		switch (details.reason) {
			case 'aborted':
				return `合并${details.ref ? `“${details.ref}”` : ''}已中止`;
			case 'alreadyInProgress':
				return `${baseMessage}，因为当前已有合并正在进行`;
			case 'conflicts':
				return `${baseMessage}，因为存在冲突。请先解决冲突再继续合并`;
			case 'uncommittedChanges':
				return `${baseMessage}，因为存在未提交更改`;
			case 'wouldOverwriteChanges':
				return `${baseMessage}，因为会覆盖部分本地更改`;
			default:
				return baseMessage;
		}
	}
}

export type PausedOperationAbortErrorReason = 'nothingToAbort';
interface PausedOperationAbortErrorDetails {
	reason?: PausedOperationAbortErrorReason;
	operation: GitPausedOperationStatus;
	gitCommand?: GitCommandContext;
}

export class PausedOperationAbortError extends GitCommandError<PausedOperationAbortErrorDetails> {
	static override is(ex: unknown, reason?: PausedOperationAbortErrorReason): ex is PausedOperationAbortError {
		return ex instanceof PausedOperationAbortError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: PausedOperationAbortErrorDetails, original?: Error) {
		super('无法中止操作', details, original);
	}

	protected override buildErrorMessage(details: PausedOperationAbortErrorDetails): string {
		switch (details.reason) {
			case 'nothingToAbort':
				return `无法中止，因为当前没有正在进行的${getPausedOperationTypeLabel(details.operation.type)}操作`;
			default:
				return `无法中止${getPausedOperationTypeLabel(details.operation.type)}操作${
					this.original ? `：${this.original.message}` : ''
				}`;
		}
	}
}

export type PausedOperationContinueErrorReason =
	| 'conflicts'
	| 'emptyCommit'
	| 'nothingToContinue'
	| 'uncommittedChanges'
	| 'unmergedFiles'
	| 'unstagedChanges'
	| 'wouldOverwriteChanges';
interface PausedOperationContinueErrorDetails {
	reason?: PausedOperationContinueErrorReason;
	operation: GitPausedOperationStatus;
	skip?: boolean;
	gitCommand?: GitCommandContext;
}

export class PausedOperationContinueError extends GitCommandError<PausedOperationContinueErrorDetails> {
	static override is(ex: unknown, reason?: PausedOperationContinueErrorReason): ex is PausedOperationContinueError {
		return ex instanceof PausedOperationContinueError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: PausedOperationContinueErrorDetails, original?: Error) {
		super('无法继续操作', details, original);
	}

	protected override buildErrorMessage(details: PausedOperationContinueErrorDetails): string {
		const action = details.skip ? '跳过' : '继续';
		const operation = getPausedOperationTypeLabel(details.operation.type);
		switch (details.reason) {
			case 'conflicts':
				return `无法${action}${operation}操作，因为仍有未解决的冲突`;
			case 'emptyCommit':
				return `无法${action}${operation}操作，因为上一个提交为空`;
			case 'nothingToContinue':
				return `无法${action}${operation}操作，因为当前没有正在进行的${operation}`;
			case 'uncommittedChanges':
				return `无法${action}${operation}操作，因为存在未提交更改`;
			case 'unmergedFiles':
				return `无法${action}${operation}操作，因为存在未合并文件`;
			case 'unstagedChanges':
				return `无法${action}${operation}操作，因为存在未暂存更改`;
			case 'wouldOverwriteChanges':
				return `无法${action}${operation}操作，因为会覆盖部分本地更改`;
			default:
				return `无法${action}${operation}操作${this.original ? `：${this.original.message}` : ''}`;
		}
	}
}

export type PullErrorReason =
	| 'conflict'
	| 'gitIdentity'
	| 'rebaseMultipleBranches'
	| 'refLocked'
	| 'remoteConnectionFailed'
	| 'tagConflict'
	| 'uncommittedChanges'
	| 'unmergedFiles'
	| 'unstagedChanges'
	| 'wouldOverwriteChanges'
	| 'other';
interface PullErrorDetails {
	reason?: PullErrorReason;
	gitCommand?: GitCommandContext;
}

export class PullError extends GitCommandError<PullErrorDetails> {
	static override is(ex: unknown, reason?: PullErrorReason): ex is PullError {
		return ex instanceof PullError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: PullErrorDetails, original?: Error) {
		super('无法拉取', details, original);
	}

	protected override buildErrorMessage(details: PullErrorDetails): string {
		const baseMessage = '无法拉取';
		switch (details.reason) {
			case 'conflict':
				return '由于存在必须解决的冲突，无法完成拉取。';
			case 'gitIdentity':
				return `${baseMessage}，因为你尚未配置 Git 身份。`;
			case 'rebaseMultipleBranches':
				return `${baseMessage}，因为你正尝试变基到多个分支。`;
			case 'refLocked':
				return `${baseMessage}，因为本地引用无法更新。`;
			case 'remoteConnectionFailed':
				return `${baseMessage}，因为无法连接到远程仓库。`;
			case 'tagConflict':
				return `${baseMessage}，因为本地标签将被覆盖。`;
			case 'uncommittedChanges':
				return `${baseMessage}，因为你有未提交更改。`;
			case 'unmergedFiles':
				return `${baseMessage}，因为你有未合并文件。`;
			case 'unstagedChanges':
				return `${baseMessage}，因为你有未暂存更改。`;
			case 'wouldOverwriteChanges':
				return `${baseMessage}，因为部分文件的本地更改会被覆盖。`;
			default:
				return baseMessage;
		}
	}
}

export type PushErrorReason =
	| 'noUpstream'
	| 'permissionDenied'
	| 'rejected'
	| 'rejectedRefDoesNotExist'
	| 'rejectedWithLease'
	| 'rejectedWithLeaseIfIncludes'
	| 'remoteAhead'
	| 'remoteConnectionFailed'
	| 'tipBehind'
	| 'other';
interface PushErrorDetails {
	reason?: PushErrorReason;
	branch?: string;
	remote?: string;
	gitCommand?: GitCommandContext;
}

export class PushError extends GitCommandError<PushErrorDetails> {
	static override is(ex: unknown, reason?: PushErrorReason): ex is PushError {
		return ex instanceof PushError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: PushErrorDetails, original?: Error) {
		super('无法推送', details, original);
	}

	protected override buildErrorMessage(details: PushErrorDetails): string {
		const baseMessage = `无法推送${details.branch ? `分支“${details.branch}”` : ''}${
			details.remote ? ` 到 ${details.remote}` : ''
		}`;
		switch (details.reason) {
			case 'noUpstream':
				return `${baseMessage}，因为它没有上游分支。`;
			case 'permissionDenied':
				return `${baseMessage}，因为你没有权限向此远程仓库推送。`;
			case 'rejected':
				return `${baseMessage}，因为部分引用推送失败或推送被拒绝。请先尝试拉取。`;
			case 'rejectedRefDoesNotExist':
				return `无法删除远程分支${details.branch ? `“${details.branch}”` : ''}${
					details.remote ? `（来自 ${details.remote}）` : ''
				}，因为远程引用不存在`;
			case 'rejectedWithLease':
			case 'rejectedWithLeaseIfIncludes':
				return `无法强制推送${details.branch ? `分支“${details.branch}”` : ''}${
					details.remote ? ` 到 ${details.remote}` : ''
				}，因为部分引用推送失败或推送被拒绝。自上次检出以来，远程跟踪分支的最新提交已更新。请先尝试拉取。`;
			case 'remoteAhead':
				return `${baseMessage}，因为远程包含你本地没有的更改。请先尝试抓取。`;
			case 'remoteConnectionFailed':
				return `${baseMessage}，因为无法连接到远程仓库。`;
			case 'tipBehind':
				return `${baseMessage}，因为它落后于远程对应分支。请先尝试拉取。`;
			default:
				return baseMessage;
		}
	}
}

export type RebaseErrorReason =
	| 'aborted'
	| 'alreadyInProgress'
	| 'conflicts'
	| 'uncommittedChanges'
	| 'wouldOverwriteChanges'
	| 'other';
interface RebaseErrorDetails {
	reason?: RebaseErrorReason;
	upstream?: string;
	gitCommand?: GitCommandContext;
}

export class RebaseError extends GitCommandError<RebaseErrorDetails> {
	static override is(ex: unknown, reason?: RebaseErrorReason): ex is RebaseError {
		return ex instanceof RebaseError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: RebaseErrorDetails, original?: Error) {
		super('无法变基', details, original);
	}

	protected override buildErrorMessage(details: RebaseErrorDetails): string {
		const baseMessage = `无法变基${details.upstream ? `到“${details.upstream}”` : ''}`;

		switch (details.reason) {
			case 'aborted':
				return `变基${details.upstream ? `到“${details.upstream}”` : ''}已中止`;
			case 'alreadyInProgress':
				return `${baseMessage}，因为当前已有变基正在进行`;
			case 'conflicts':
				return `${baseMessage}，因为存在冲突。请先解决冲突再继续变基`;
			case 'uncommittedChanges':
				return `${baseMessage}，因为存在未提交更改`;
			case 'wouldOverwriteChanges':
				return `${baseMessage}，因为会覆盖部分本地更改`;
			default:
				return baseMessage;
		}
	}
}

export type ResetErrorReason =
	| 'ambiguousArgument'
	| 'notUpToDate'
	| 'detachedHead'
	| 'permissionDenied'
	| 'refLocked'
	| 'unmergedChanges'
	| 'wouldOverwriteChanges'
	| 'other';
interface ResetErrorDetails {
	reason?: ResetErrorReason;
	gitCommand?: GitCommandContext;
}

export class ResetError extends GitCommandError<ResetErrorDetails> {
	static override is(ex: unknown, reason?: ResetErrorReason): ex is ResetError {
		return ex instanceof ResetError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: ResetErrorDetails, original?: Error) {
		super('无法重置', details, original);
	}

	protected override buildErrorMessage(details: ResetErrorDetails): string {
		const baseMessage = '无法重置';
		switch (details.reason) {
			case 'ambiguousArgument':
				return `${baseMessage}，因为参数存在歧义`;
			case 'detachedHead':
				return `${baseMessage}，因为你当前处于分离 HEAD 状态`;
			case 'notUpToDate':
				return `${baseMessage}，因为索引不是最新状态（你可能仍有未解决的合并冲突）`;
			case 'permissionDenied':
				return `${baseMessage}，因为你没有权限修改受影响的文件`;
			case 'refLocked':
				return `${baseMessage}，因为引用已锁定`;
			case 'unmergedChanges':
				return `${baseMessage}，因为存在未合并的更改`;
			case 'wouldOverwriteChanges':
				return `${baseMessage}，因为你的本地更改会被覆盖`;
			default:
				return baseMessage;
		}
	}
}

export type RevertErrorReason =
	| 'aborted'
	| 'alreadyInProgress'
	| 'conflicts'
	| 'uncommittedChanges'
	| 'wouldOverwriteChanges'
	| 'other';
interface RevertErrorDetails {
	reason?: RevertErrorReason;
	refs?: string[];
	gitCommand?: GitCommandContext;
}

export class RevertError extends GitCommandError<RevertErrorDetails> {
	static override is(ex: unknown, reason?: RevertErrorReason): ex is RevertError {
		return ex instanceof RevertError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: RevertErrorDetails, original?: Error) {
		super('无法撤销', details, original);
	}

	protected override buildErrorMessage(details: RevertErrorDetails): string {
		const baseMessage = `无法撤销${details.refs?.length ? ` ${details.refs.join(', ')}` : ''}`;

		switch (details.reason) {
			case 'aborted':
				return `撤销${details.refs?.length ? ` ${details.refs.join(', ')}` : ''}已中止`;
			case 'alreadyInProgress':
				return `${baseMessage}，因为当前已有撤销操作正在进行`;
			case 'conflicts':
				return `${baseMessage}，因为存在冲突。请先解决冲突再继续撤销`;
			case 'uncommittedChanges':
				return `${baseMessage}，因为存在未提交更改`;
			case 'wouldOverwriteChanges':
				return `${baseMessage}，因为会覆盖部分本地更改`;
			default:
				return baseMessage;
		}
	}
}

export type StashApplyErrorReason = 'uncommittedChanges' | 'other';
interface StashApplyErrorDetails {
	reason?: StashApplyErrorReason;
	gitCommand?: GitCommandContext;
}

export class StashApplyError extends GitCommandError<StashApplyErrorDetails> {
	static override is(ex: unknown, reason?: StashApplyErrorReason): ex is StashApplyError {
		return ex instanceof StashApplyError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: StashApplyErrorDetails, original?: Error) {
		super('无法应用存储', details, original);
	}

	protected override buildErrorMessage(details: StashApplyErrorDetails): string {
		switch (details.reason) {
			case 'uncommittedChanges':
				return '无法应用存储。你的工作树更改会被覆盖。请先提交或存储更改后再试';
			default:
				return '无法应用存储';
		}
	}
}

export type StashPushErrorReason = 'conflictingStagedAndUnstagedLines' | 'nothingToSave' | 'other';
interface StashPushErrorDetails {
	reason?: StashPushErrorReason;
	gitCommand?: GitCommandContext;
}

export class StashPushError extends GitCommandError<StashPushErrorDetails> {
	static override is(ex: unknown, reason?: StashPushErrorReason): ex is StashPushError {
		return ex instanceof StashPushError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: StashPushErrorDetails, original?: Error) {
		super('无法存储', details, original);
	}

	protected override buildErrorMessage(details: StashPushErrorDetails): string {
		switch (details.reason) {
			case 'conflictingStagedAndUnstagedLines':
				return '更改已存储，但由于至少有一个文件在同一行同时包含已暂存和未暂存更改，工作树无法更新';
			case 'nothingToSave':
				return '没有可存储的文件';
			default:
				return '无法存储';
		}
	}
}

export type ShowErrorReason = 'invalidObject' | 'invalidRevision' | 'notFound' | 'notInRevision' | 'other';
interface ShowErrorDetails {
	reason?: ShowErrorReason;
	rev?: string;
	path?: string;
	gitCommand?: GitCommandContext;
}

export class ShowError extends GitCommandError<ShowErrorDetails> {
	static override is(ex: unknown, reason?: ShowErrorReason): ex is ShowError {
		return ex instanceof ShowError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: ShowErrorDetails, original?: Error) {
		super('无法显示文件', details, original);
	}

	protected override buildErrorMessage(details: ShowErrorDetails): string {
		const baseMessage = `无法显示${details.path ? `“${details.path}”` : '文件'}${
			details.rev ? `（修订版本“${details.rev}”）` : ''
		}`;
		switch (details.reason) {
			case 'invalidObject':
				return `${baseMessage}，因为该路径不是文件`;
			case 'invalidRevision':
				return `${baseMessage}，因为指定的修订版本无效`;
			case 'notFound':
				return `${baseMessage}，因为文件不存在`;
			case 'notInRevision':
				return `${baseMessage}，因为该文件不在指定修订版本中`;
			default:
				return baseMessage;
		}
	}
}

export type TagErrorReason =
	| 'alreadyExists'
	| 'invalidName'
	| 'notFound'
	| 'permissionDenied'
	| 'remoteRejected'
	| 'other';
interface TagErrorDetails {
	reason?: TagErrorReason;
	action?: string;
	tag?: string;
	gitCommand?: GitCommandContext;
}

export class TagError extends GitCommandError<TagErrorDetails> {
	static override is(ex: unknown, reason?: TagErrorReason): ex is TagError {
		return ex instanceof TagError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: TagErrorDetails, original?: Error) {
		super('无法对标签执行操作', details, original);
	}

	protected override buildErrorMessage(details: TagErrorDetails): string {
		let baseMessage: string;
		if (details.action != null) {
			baseMessage = `无法${details.action}标签${details.tag ? `“${details.tag}”` : ''}`;
		} else {
			baseMessage = `无法对标签执行操作${details.tag ? `“${details.tag}”` : ''}`;
		}

		switch (details.reason) {
			case 'alreadyExists':
				return `${baseMessage}，因为它已存在`;
			case 'invalidName':
				return `${baseMessage}，因为标签名称无效`;
			case 'notFound':
				return `${baseMessage}，因为它不存在`;
			case 'permissionDenied':
				return `${baseMessage}，因为你没有权限向此远程仓库推送。`;
			case 'remoteRejected':
				return `${baseMessage}，因为远程仓库拒绝了推送。`;
			default:
				return baseMessage;
		}
	}
}

export class WorkspaceUntrustedError extends Error {
	constructor() {
		super('由于当前工作区不受信任，无法执行 Git 操作');

		Error.captureStackTrace?.(this, new.target);
	}
}

export type WorktreeCreateErrorReason = 'alreadyCheckedOut' | 'alreadyExists';
interface WorktreeCreateErrorDetails {
	reason?: WorktreeCreateErrorReason;
	gitCommand?: GitCommandContext;
}

export class WorktreeCreateError extends GitCommandError<WorktreeCreateErrorDetails> {
	static override is(ex: unknown, reason?: WorktreeCreateErrorReason): ex is WorktreeCreateError {
		return ex instanceof WorktreeCreateError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: WorktreeCreateErrorDetails, original?: Error) {
		super('无法创建工作树', details, original);
	}

	protected override buildErrorMessage(details: WorktreeCreateErrorDetails): string {
		switch (details.reason) {
			case 'alreadyCheckedOut':
				return '无法创建工作树，因为它已被检出';
			case 'alreadyExists':
				return '无法创建工作树，因为它已存在';
			default:
				return '无法创建工作树';
		}
	}
}

export type WorktreeDeleteErrorReason = 'defaultWorkingTree' | 'directoryNotEmpty' | 'uncommittedChanges';
interface WorktreeDeleteErrorDetails {
	reason?: WorktreeDeleteErrorReason;
	gitCommand?: GitCommandContext;
}

export class WorktreeDeleteError extends GitCommandError<WorktreeDeleteErrorDetails> {
	static override is(ex: unknown, reason?: WorktreeDeleteErrorReason): ex is WorktreeDeleteError {
		return ex instanceof WorktreeDeleteError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: WorktreeDeleteErrorDetails, original?: Error) {
		super('无法删除工作树', details, original);
	}

	protected override buildErrorMessage(details: WorktreeDeleteErrorDetails): string {
		switch (details.reason) {
			case 'defaultWorkingTree':
				return '无法删除工作树，因为它是默认工作树';
			case 'directoryNotEmpty':
				return '无法删除工作树，因为目录非空';
			case 'uncommittedChanges':
				return '无法删除工作树，因为存在未提交更改';
			default:
				return '无法删除工作树';
		}
	}
}

export type SigningErrorReason = 'noKey' | 'gpgNotFound' | 'sshNotFound' | 'passphraseFailed' | 'unknown';
interface SigningErrorDetails {
	reason?: SigningErrorReason;
	gitCommand?: GitCommandContext;
}

export class SigningError extends GitCommandError<SigningErrorDetails> {
	static override is(ex: unknown, reason?: SigningErrorReason): ex is SigningError {
		return ex instanceof SigningError && (reason == null || ex.details.reason === reason);
	}

	constructor(details: SigningErrorDetails, original?: Error) {
		super('无法为提交签名', details, original);
	}

	protected override buildErrorMessage(details: SigningErrorDetails): string {
		const baseMessage = '无法为提交签名';
		switch (details.reason) {
			case 'noKey':
				return `${baseMessage}，因为未配置签名密钥`;
			case 'gpgNotFound':
				return `${baseMessage}，因为未找到 GPG 程序`;
			case 'sshNotFound':
				return `${baseMessage}，因为未找到 SSH 程序`;
			case 'passphraseFailed':
				return `${baseMessage}，因为 GPG 密码短语失败或已取消`;
			default:
				return baseMessage;
		}
	}
}
