export type RunningOperationExecState = 'generating' | 'complete' | 'backed' | 'error' | 'orphaned';

/** Codicon name for a status-overlay icon driven by a {@link RunningOperationExecState}.
 *  Returned name maps to the code-icon font.
 *
 *  - `'generating'` → `'loading'` (spinner; pair with `modifier="spin"`)
 *  - `'complete'` → `'pass'`
 *  - `'backed'` + `hasResult` → `'pass'`
 *  - `'backed'` + no result → `null`
 *  - `'error'` → `'error'`
 *  - `'orphaned'` → `'warning'`
 *
 *  `hasResult` defaults to `true` for backward compatibility. */
export function statusIconFor(execState: RunningOperationExecState, hasResult: boolean = true): string | null {
	switch (execState) {
		case 'generating':
			return 'loading';
		case 'complete':
			return 'pass';
		case 'backed':
			return hasResult ? 'pass' : null;
		case 'error':
			return 'error';
		case 'orphaned':
			return 'warning';
		default:
			return null;
	}
}

/** Tooltip suffix appended to a details-header chip's label when an operation is engaged at
 *  this anchor. `hasResult` suppresses the "(Completed)" suffix for a `'backed'`-no-result entry. */
export function chipStateSuffix(execState: RunningOperationExecState | undefined, hasResult: boolean = true): string {
	switch (execState) {
		case 'generating':
			return ' (Running)';
		case 'complete':
			return ' (Completed)';
		case 'backed':
			return hasResult ? ' (Completed)' : '';
		case 'error':
			return ' (Failed)';
		case 'orphaned':
			return ' (Orphaned)';
		default:
			return '';
	}
}
