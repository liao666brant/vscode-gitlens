import type { GitFeatures } from '@gitlens/git/features.js';
import type { RepositoryVisibility } from '@gitlens/git/providers/types.js';
import type { RequiredSubscriptionPlanIds, Subscription } from './community/stubs/pro.js';

// Re-export Git feature types and constants from @gitlens/git
export type { FilteredGitFeatures, GitFeatureOrPrefix, GitFeatures } from '@gitlens/git/features.js';
export { gitFeaturesByVersion, gitMinimumVersion } from '@gitlens/git/features.js';

export type Features = 'stashes' | 'timeline' | GitFeatures;

export type FeatureAccess =
	| {
			allowed: true;
			subscription: { current: Subscription; required?: undefined };
			visibility?: RepositoryVisibility;
	  }
	| {
			allowed: false | 'mixed';
			subscription: { current: Subscription; required?: RequiredSubscriptionPlanIds };
			visibility?: RepositoryVisibility;
	  };

export type RepoFeatureAccess =
	| {
			allowed: true;
			subscription: { current: Subscription; required?: undefined };
			visibility?: RepositoryVisibility;
	  }
	| {
			allowed: false;
			subscription: { current: Subscription; required?: RequiredSubscriptionPlanIds };
			visibility?: RepositoryVisibility;
	  };

export type PlusFeatures = ProFeatures | AdvancedFeatures;

export type ProFeatures = 'timeline' | 'worktrees' | 'graph' | 'startReview' | 'startWork' | 'associateIssueWithBranch';

export type AdvancedFeatures = never;

export function isAdvancedFeature(_feature: PlusFeatures): _feature is AdvancedFeatures {
	return false;
}

export function isProFeatureOnAllRepos(feature: PlusFeatures): feature is ProFeatures {
	switch (feature) {
		case 'startReview':
		case 'startWork':
		case 'associateIssueWithBranch':
			return true;
		default:
			return false;
	}
}

export type FeaturePreviews = 'graph';

export type FeaturePreviewStatus = 'eligible' | 'active' | 'expired';
