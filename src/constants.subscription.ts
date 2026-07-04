export const proFeaturePreviewUsages = 3;
export const proFeaturePreviewUsageDurationInDays = 1;

// NOTE: Pay attention to gitlens:plus:state in the `package.json` when modifying this enum
// NOTE: This is reported in telemetry so we should NOT change the values
export const enum SubscriptionState {
	/** Indicates a user who hasn't verified their email address yet */
	VerificationRequired = -1,
	/** Indicates an account-less Community (free) user */
	Community = 0,
	/** @deprecated DO NOT USE */
	DeprecatedPreview = 1,
	/** @deprecated DO NOT USE */
	DeprecatedPreviewExpired = 2,
	/** @deprecated DO NOT USE */
	Trial = 3,
	/** @deprecated DO NOT USE */
	TrialExpired = 4,
	/** @deprecated DO NOT USE */
	TrialReactivationEligible = 5,
	/** Indicates a paid user */
	Paid = 6,
}
