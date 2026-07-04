export type AgentSessionPhase = 'idle' | 'running' | 'waiting' | 'complete' | 'error';

export type PendingPermission = {
	id: string;
	tool: string;
	description?: string;
	toolInputDescription?: string;
};
