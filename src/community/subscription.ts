// Community build: subscription is fixed to the Community plan (no paid/trial/account flows).

export type RequiredSubscriptionPlanIds = string;

export type CommunityPlan = {
	id: 'community';
	actual: { id: 'community' };
	effective: { id: 'community' };
};

export type SubscriptionAccount = {
	id?: string;
	email?: string;
	name?: string;
	verified?: boolean;
};

export type Subscription = {
	account?: SubscriptionAccount;
	plan: CommunityPlan;
	state: 0;
};

export const communitySubscription: Subscription = {
	plan: { id: 'community', actual: { id: 'community' }, effective: { id: 'community' } },
	state: 0,
};
