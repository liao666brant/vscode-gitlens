import type { AgentSessionPhase, PendingPermission } from '../provider.js';

export type AgentSessionState = {
	id: string;
	provider: string;
	phase: AgentSessionPhase;
	status?: string;
	repositoryPath?: string;
	worktreePath?: string;
	branchName?: string;
	startedAt?: number;
	updatedAt?: number;
	pendingPermission?: PendingPermission;
};
