export type WalkthroughContextKeys =
	| 'gettingStarted'
	| 'homeView'
	| 'visualizeCodeHistory'
	| 'gitBlame'
	| 'prReviews'
	| 'mcpFeatures'
	| 'aiFeatures';

export const walkthroughProgressSteps: Record<WalkthroughContextKeys, string> = {
	gettingStarted: 'Getting Started',
	homeView: 'Home View',
	visualizeCodeHistory: 'Visualize Code History',
	aiFeatures: 'AI Features',
	gitBlame: 'File Blame',
	prReviews: 'Pull Request Reviews',
	mcpFeatures: 'MCP Features',
};

export type GraphWalkthroughContextKeys =
	| 'graphAgentMonitoring'
	| 'graphParallelWork'
	| 'graphAiReview'
	| 'graphCompose'
	| 'graphCompare'
	| 'graphNextSteps';
