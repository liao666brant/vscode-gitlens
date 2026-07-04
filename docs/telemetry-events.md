# WeGit Telemetry

> This is a generated file. Do not edit.

## Global Attributes

> Global attributes are sent (if available) with every telemetry event

```typescript
{
  'env': string,
  'extensionId': string,
  'extensionMode': string,
  'extensionVersion': string,
  'language': string,
  'machineId': string,
  'platform': string,
  'sessionId': string,
  'vscodeEdition': string,
  'vscodeHost': string,
  'vscodeRemoteName': string,
  'vscodeShell': string,
  'vscodeUIKind': string,
  'vscodeVersion': string

  [`global.account.${string}`]: string,
  'global.cloudIntegrations.connected.count': number,
  'global.cloudIntegrations.connected.ids': string,
  'global.debugging': boolean,
  // Cohort number between 1 and 100 to use for percentage-based rollouts
  'global.device.cohort': number,
  'global.enabled': boolean,
  'global.folders.count': number,
  'global.folders.schemes': string,
  'global.install': boolean,
  'global.prerelease': boolean,
  'global.providers.count': number,
  'global.providers.ids': string,
  'global.repositories.count': number,
  'global.repositories.hasConnectedRemotes': boolean,
  'global.repositories.hasRemotes': boolean,
  'global.repositories.hasRichRemotes': boolean,
  'global.repositories.remoteProviders': string,
  'global.repositories.schemes': string,
  'global.repositories.visibility': 'private' | 'public' | 'local' | 'mixed',
  'global.repositories.withHostingIntegrations': number,
  'global.repositories.withHostingIntegrationsConnected': number,
  'global.repositories.withRemotes': number,
  'global.subscription.actual.id': 'community',
  'global.subscription.effective.id': 'community',
  'global.subscription.featurePreviews.graph.day': number,
  [`global.subscription.featurePreviews.graph.day.${number}.startedOn`]: string,
  'global.subscription.featurePreviews.graph.startedOn': string,
  'global.subscription.featurePreviews.graph.status': 'eligible' | 'active' | 'expired',
  'global.subscription.id': 'community',
  // Promo discount code associated with the upgrade
  'global.subscription.promo.code': string,
  // Promo key (identifier) associated with the upgrade
  'global.subscription.promo.key': string,
  'global.subscription.state': -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6,
  'global.subscription.stateString': string,
  'global.upgrade': boolean,
  'global.upgradedFrom': string,
  'global.workspace.isTrusted': boolean
}
```

## Events

### account/validation/failed

> Sent when account validation fails

```typescript
{
  'account.id': string,
  'code': string,
  'exception': string,
  'statusCode': number
}
```

### activate

> Sent when WeGit is activated

```typescript
{
  'activation.elapsed': number,
  'activation.mode': string,
  [`config.${string}`]: string | number | boolean
}
```

### agents/hookInstalled

> Sent when an agent hook is installed

```typescript
{
  'agent.provider': string
}
```

### agents/hookUninstalled

> Sent when an agent hook is uninstalled

```typescript
{
  'agent.provider': string
}
```

### agents/permission/resolved

> Sent when a permission request is resolved

```typescript
{
  'agent.provider': string,
  'permission.decision': string,
  'permission.tool': string
}
```

### agents/session/ended

> Sent when an agent session ends

```typescript
{
  'agent.provider': string
}
```

### agents/session/started

> Sent when an agent session starts

```typescript
{
  'agent.provider': string
}
```

### agents/session/syncDiscrepancy

> Sent when a reconciliation poll (`list-sessions`) finds the polled session set differs from
what the live IPC hook path had already tracked. In a single window this should be rare and
usually means a hook event was dropped; a nonzero `sync.discovered` is expected in multi-window
setups, where the machine-wide poll can surface a session owned by another window that never
routed its hook events here — so don't treat every event as a dropped IPC signal

```typescript
{
  'agent.provider': string,
  // Sessions the poll reported alive that the live IPC path had not tracked.
  'sync.discovered': number,
  // Tracked sessions the poll no longer reports alive (teardown the live path missed).
  'sync.missing': number,
  // Total alive sessions reported by the poll.
  'sync.polled': number,
  // Total sessions tracked (from the live path) before the poll reconciled.
  'sync.tracked': number
}
```

### ai/credits/addOnClicked

> Sent when the user clicks "Get More Credits" on the weekly AI usage-limit notification

```typescript
{
  'organization.role': string
}
```

### ai/credits/addOnDismissed

> Sent when the user dismisses the weekly AI usage-limit notification

```typescript
{
  'organization.role': string
}
```

### ai/enabled

> Sent when AI is enabled

```typescript
void
```

### ai/explain

> Sent when explaining changes from wip, commits, stashes, patches, etc.

```typescript
{
  'changeType': 'wip' | 'stash' | 'commit' | 'branch' | 'compare' | 'draft-stash' | 'draft-patch' | 'draft-suggested_pr_change',
  'config.largePromptThreshold': number,
  'config.usedCustomInstructions': boolean,
  'correlationId': string,
  'customInstructions.commitMessage.setting.length': number,
  'customInstructions.commitMessage.setting.used': boolean,
  'customInstructions.length': number,
  'customInstructions.setting.length': number,
  'customInstructions.setting.used': boolean,
  'customInstructions.used': boolean,
  'diff.files.count': number,
  'diff.hash': string,
  'diff.hunks.count': number,
  'diff.lines.count': number,
  'duration': number,
  'failed': boolean,
  'failed.cancelled.reason': 'large-prompt',
  'failed.error': string,
  'failed.error.detail': string,
  'failed.reason': 'user-declined' | 'user-cancelled' | 'error',
  'id': string,
  'input.length': number,
  'model.id': string,
  'model.provider.id': string,
  'model.provider.name': string,
  'output.length': number,
  'retry.count': number,
  'type': 'change',
  'usage.completionTokens': number,
  'usage.limits.limit': number,
  'usage.limits.resetsOn': string,
  'usage.limits.used': number,
  'usage.promptTokens': number,
  'usage.totalTokens': number,
  'warning.exceededLargePromptThreshold': boolean,
  'warning.promptTruncated': boolean
}
```

### ai/feedback

> Sent when a user provides feedback (rating and optional details) for an AI feature

```typescript
{
  'feature': string,
  'id': string,
  'model.id': string,
  'model.provider.id': string,
  'model.provider.name': string,
  'sentiment': 'helpful' | 'unhelpful',
  // The AI feature that feedback was submitted for
  'type': string,
  // Custom feedback provided (if any)
  'unhelpful.custom': string,
  // Unhelpful reasons selected (if any) - comma-separated list of AIFeedbackUnhelpfulReasons values
  'unhelpful.reasons': string,
  'usage.completionTokens': number,
  'usage.limits.limit': number,
  'usage.limits.resetsOn': string,
  'usage.limits.used': number,
  'usage.promptTokens': number,
  'usage.totalTokens': number
}
```

### ai/generate

> Sent when generating summaries from commits, stashes, patches, etc.

```typescript
{
  'config.largePromptThreshold': number,
  'config.usedCustomInstructions': boolean,
  'correlationId': string,
  'customInstructions.commitMessage.setting.length': number,
  'customInstructions.commitMessage.setting.used': boolean,
  'customInstructions.length': number,
  'customInstructions.setting.length': number,
  'customInstructions.setting.used': boolean,
  'customInstructions.used': boolean,
  'diff.files.count': number,
  'diff.hash': string,
  'diff.hunks.count': number,
  'diff.lines.count': number,
  'duration': number,
  'failed': boolean,
  'failed.cancelled.reason': 'large-prompt',
  'failed.error': string,
  'failed.error.detail': string,
  'failed.reason': 'user-declined' | 'user-cancelled' | 'error',
  'id': string,
  'input.length': number,
  'model.id': string,
  'model.provider.id': string,
  'model.provider.name': string,
  'output.length': number,
  'retry.count': number,
  'type': 'changelog',
  'usage.completionTokens': number,
  'usage.limits.limit': number,
  'usage.limits.resetsOn': string,
  'usage.limits.used': number,
  'usage.promptTokens': number,
  'usage.totalTokens': number,
  'warning.exceededLargePromptThreshold': boolean,
  'warning.promptTruncated': boolean
}
```

or

```typescript
{
  'config.largePromptThreshold': number,
  'config.usedCustomInstructions': boolean,
  'correlationId': string,
  'customInstructions.commitMessage.setting.length': number,
  'customInstructions.commitMessage.setting.used': boolean,
  'customInstructions.length': number,
  'customInstructions.setting.length': number,
  'customInstructions.setting.used': boolean,
  'customInstructions.used': boolean,
  'diff.files.count': number,
  'diff.hash': string,
  'diff.hunks.count': number,
  'diff.lines.count': number,
  'duration': number,
  'failed': boolean,
  'failed.cancelled.reason': 'large-prompt',
  'failed.error': string,
  'failed.error.detail': string,
  'failed.reason': 'user-declined' | 'user-cancelled' | 'error',
  'id': string,
  'input.length': number,
  'model.id': string,
  'model.provider.id': string,
  'model.provider.name': string,
  'output.length': number,
  'retry.count': number,
  'type': 'commitMessage',
  'usage.completionTokens': number,
  'usage.limits.limit': number,
  'usage.limits.resetsOn': string,
  'usage.limits.used': number,
  'usage.promptTokens': number,
  'usage.totalTokens': number,
  'warning.exceededLargePromptThreshold': boolean,
  'warning.promptTruncated': boolean
}
```

or

```typescript
{
  'config.largePromptThreshold': number,
  'config.usedCustomInstructions': boolean,
  'correlationId': string,
  'customInstructions.commitMessage.setting.length': number,
  'customInstructions.commitMessage.setting.used': boolean,
  'customInstructions.length': number,
  'customInstructions.setting.length': number,
  'customInstructions.setting.used': boolean,
  'customInstructions.used': boolean,
  'diff.files.count': number,
  'diff.hash': string,
  'diff.hunks.count': number,
  'diff.lines.count': number,
  'draftType': 'stash' | 'patch' | 'suggested_pr_change',
  'duration': number,
  'failed': boolean,
  'failed.cancelled.reason': 'large-prompt',
  'failed.error': string,
  'failed.error.detail': string,
  'failed.reason': 'user-declined' | 'user-cancelled' | 'error',
  'id': string,
  'input.length': number,
  'model.id': string,
  'model.provider.id': string,
  'model.provider.name': string,
  'output.length': number,
  'retry.count': number,
  'type': 'draftMessage',
  'usage.completionTokens': number,
  'usage.limits.limit': number,
  'usage.limits.resetsOn': string,
  'usage.limits.used': number,
  'usage.promptTokens': number,
  'usage.totalTokens': number,
  'warning.exceededLargePromptThreshold': boolean,
  'warning.promptTruncated': boolean
}
```

or

```typescript
{
  'config.largePromptThreshold': number,
  'config.usedCustomInstructions': boolean,
  'correlationId': string,
  'customInstructions.commitMessage.setting.length': number,
  'customInstructions.commitMessage.setting.used': boolean,
  'customInstructions.length': number,
  'customInstructions.setting.length': number,
  'customInstructions.setting.used': boolean,
  'customInstructions.used': boolean,
  'diff.files.count': number,
  'diff.hash': string,
  'diff.hunks.count': number,
  'diff.lines.count': number,
  'duration': number,
  'failed': boolean,
  'failed.cancelled.reason': 'large-prompt',
  'failed.error': string,
  'failed.error.detail': string,
  'failed.reason': 'user-declined' | 'user-cancelled' | 'error',
  'id': string,
  'input.length': number,
  'model.id': string,
  'model.provider.id': string,
  'model.provider.name': string,
  'output.length': number,
  'retry.count': number,
  'type': 'createPullRequest',
  'usage.completionTokens': number,
  'usage.limits.limit': number,
  'usage.limits.resetsOn': string,
  'usage.limits.used': number,
  'usage.promptTokens': number,
  'usage.totalTokens': number,
  'warning.exceededLargePromptThreshold': boolean,
  'warning.promptTruncated': boolean
}
```

or

```typescript
{
  'config.largePromptThreshold': number,
  'config.usedCustomInstructions': boolean,
  'correlationId': string,
  'customInstructions.commitMessage.setting.length': number,
  'customInstructions.commitMessage.setting.used': boolean,
  'customInstructions.length': number,
  'customInstructions.setting.length': number,
  'customInstructions.setting.used': boolean,
  'customInstructions.used': boolean,
  'diff.files.count': number,
  'diff.hash': string,
  'diff.hunks.count': number,
  'diff.lines.count': number,
  'duration': number,
  'failed': boolean,
  'failed.cancelled.reason': 'large-prompt',
  'failed.error': string,
  'failed.error.detail': string,
  'failed.reason': 'user-declined' | 'user-cancelled' | 'error',
  'id': string,
  'input.length': number,
  'model.id': string,
  'model.provider.id': string,
  'model.provider.name': string,
  'output.length': number,
  'retry.count': number,
  'type': 'commits',
  'usage.completionTokens': number,
  'usage.limits.limit': number,
  'usage.limits.resetsOn': string,
  'usage.limits.used': number,
  'usage.promptTokens': number,
  'usage.totalTokens': number,
  'warning.exceededLargePromptThreshold': boolean,
  'warning.promptTruncated': boolean
}
```

or

```typescript
{
  'config.largePromptThreshold': number,
  'config.usedCustomInstructions': boolean,
  'correlationId': string,
  'customInstructions.commitMessage.setting.length': number,
  'customInstructions.commitMessage.setting.used': boolean,
  'customInstructions.length': number,
  'customInstructions.setting.length': number,
  'customInstructions.setting.used': boolean,
  'customInstructions.used': boolean,
  'diff.files.count': number,
  'diff.hash': string,
  'diff.hunks.count': number,
  'diff.lines.count': number,
  'duration': number,
  'failed': boolean,
  'failed.cancelled.reason': 'large-prompt',
  'failed.error': string,
  'failed.error.detail': string,
  'failed.reason': 'user-declined' | 'user-cancelled' | 'error',
  'id': string,
  'input.length': number,
  'model.id': string,
  'model.provider.id': string,
  'model.provider.name': string,
  'output.length': number,
  'retry.count': number,
  'type': 'resolveConflicts',
  'usage.completionTokens': number,
  'usage.limits.limit': number,
  'usage.limits.resetsOn': string,
  'usage.limits.used': number,
  'usage.promptTokens': number,
  'usage.totalTokens': number,
  'warning.exceededLargePromptThreshold': boolean,
  'warning.promptTruncated': boolean
}
```

or

```typescript
{
  'config.largePromptThreshold': number,
  'config.usedCustomInstructions': boolean,
  'correlationId': string,
  'customInstructions.commitMessage.setting.length': number,
  'customInstructions.commitMessage.setting.used': boolean,
  'customInstructions.length': number,
  'customInstructions.setting.length': number,
  'customInstructions.setting.used': boolean,
  'customInstructions.used': boolean,
  'diff.files.count': number,
  'diff.hash': string,
  'diff.hunks.count': number,
  'diff.lines.count': number,
  'duration': number,
  'failed': boolean,
  'failed.cancelled.reason': 'large-prompt',
  'failed.error': string,
  'failed.error.detail': string,
  'failed.reason': 'user-declined' | 'user-cancelled' | 'error',
  'id': string,
  'input.length': number,
  'model.id': string,
  'model.provider.id': string,
  'model.provider.name': string,
  'output.length': number,
  'retry.count': number,
  'type': 'searchQuery',
  'usage.completionTokens': number,
  'usage.limits.limit': number,
  'usage.limits.resetsOn': string,
  'usage.limits.used': number,
  'usage.promptTokens': number,
  'usage.totalTokens': number,
  'warning.exceededLargePromptThreshold': boolean,
  'warning.promptTruncated': boolean
}
```

or

```typescript
{
  'config.largePromptThreshold': number,
  'config.usedCustomInstructions': boolean,
  'correlationId': string,
  'customInstructions.commitMessage.setting.length': number,
  'customInstructions.commitMessage.setting.used': boolean,
  'customInstructions.length': number,
  'customInstructions.setting.length': number,
  'customInstructions.setting.used': boolean,
  'customInstructions.used': boolean,
  'diff.files.count': number,
  'diff.hash': string,
  'diff.hunks.count': number,
  'diff.lines.count': number,
  'duration': number,
  'failed': boolean,
  'failed.cancelled.reason': 'large-prompt',
  'failed.error': string,
  'failed.error.detail': string,
  'failed.reason': 'user-declined' | 'user-cancelled' | 'error',
  'id': string,
  'input.length': number,
  'model.id': string,
  'model.provider.id': string,
  'model.provider.name': string,
  'output.length': number,
  'retry.count': number,
  'type': 'stashMessage',
  'usage.completionTokens': number,
  'usage.limits.limit': number,
  'usage.limits.resetsOn': string,
  'usage.limits.used': number,
  'usage.promptTokens': number,
  'usage.totalTokens': number,
  'warning.exceededLargePromptThreshold': boolean,
  'warning.promptTruncated': boolean
}
```

### ai/review

> Sent when reviewing changes from wip, commits, or commit ranges

```typescript
{
  'config.largePromptThreshold': number,
  'config.usedCustomInstructions': boolean,
  'correlationId': string,
  'customInstructions.commitMessage.setting.length': number,
  'customInstructions.commitMessage.setting.used': boolean,
  'customInstructions.length': number,
  'customInstructions.setting.length': number,
  'customInstructions.setting.used': boolean,
  'customInstructions.used': boolean,
  'diff.files.count': number,
  'diff.hash': string,
  'diff.hunks.count': number,
  'diff.lines.count': number,
  'duration': number,
  'failed': boolean,
  'failed.cancelled.reason': 'large-prompt',
  'failed.error': string,
  'failed.error.detail': string,
  'failed.reason': 'user-declined' | 'user-cancelled' | 'error',
  'id': string,
  'input.length': number,
  'model.id': string,
  'model.provider.id': string,
  'model.provider.name': string,
  'output.length': number,
  'retry.count': number,
  'reviewMode': 'single-pass' | 'two-pass',
  'reviewType': 'wip' | 'commit' | 'compare',
  'type': 'review',
  'usage.completionTokens': number,
  'usage.limits.limit': number,
  'usage.limits.resetsOn': string,
  'usage.limits.used': number,
  'usage.promptTokens': number,
  'usage.totalTokens': number,
  'warning.exceededLargePromptThreshold': boolean,
  'warning.promptTruncated': boolean
}
```

### ai/switchModel

> Sent when switching ai models

```typescript
{
  'model.id': string,
  'model.provider.id': string,
  'model.provider.name': string
}
```

or

```typescript
{
  'failed': true
}
```

### aiAllAccess/bannerDismissed

> Sent when user dismisses the AI All Access banner

```typescript
void
```

### aiAllAccess/opened

> Sent when user opens the AI All Access page

```typescript
void
```

### aiAllAccess/optedIn

> Sent when user opts in to AI All Access

```typescript
void
```

### associateIssueWithBranch/action

> Sent when the user chooses to manage integrations

```typescript
{
  'instance': number,
  'action': 'manage' | 'connect',
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### associateIssueWithBranch/issue/action

> Sent when the user takes an action on an issue

```typescript
{
  'instance': number,
  'action': 'soft-open',
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  [`item.${string}`]: string | number | boolean,
  'items.count': number
}
```

### associateIssueWithBranch/issue/chosen

> Sent when the user chooses an issue to associate with the branch in the second step

```typescript
{
  'instance': number,
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  [`item.${string}`]: string | number | boolean,
  'items.count': number
}
```

### associateIssueWithBranch/open

> Sent when the user opens Start Work; use `instance` to correlate an Associate Issue with Branch "session"

```typescript
{
  'instance': number,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string
}
```

### associateIssueWithBranch/opened

> Sent when Associate Issue with Branch is opened; use `instance` to correlate an Associate Issue with Branch "session"

```typescript
{
  'instance': number,
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### associateIssueWithBranch/steps/connect

> Sent when the user reaches the "connect an integration" step of Associate Issue with Branch

```typescript
{
  'instance': number,
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### associateIssueWithBranch/steps/issue

> Sent when the user reaches the "choose an issue" step of Associate Issue with Branch

```typescript
{
  'instance': number,
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### associateIssueWithBranch/title/action

> Sent when the user chooses to connect an integration

```typescript
{
  'instance': number,
  'action': 'connect',
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### cli/discoveryFile/failed

> Sent when the CLI integration discovery file fails to be created

```typescript
{
  'error.message': string
}
```

### cli/install/failed

> Sent when a CLI install attempt fails

```typescript
{
  'attempts': number,
  'autoInstall': boolean,
  'error.message': string,
  'insiders': boolean,
  'source': 'account' | 'subscription' | 'graph' | 'settings' | 'rebaseEditor' | 'ai' | 'ai:markdown-preview' | 'ai:markdown-editor' | 'ai:picker' | 'associateIssueWithBranch' | 'commandPalette' | 'deeplink' | 'editor:hover' | 'feature-badge' | 'feature-gate' | 'graph-details' | 'graph-header' | 'graph-kanban' | 'graph-sidebar' | 'graph-treemap' | 'inspect' | 'inspect-overview' | 'integrations' | 'merge-target' | 'notification' | 'prompt' | 'quick-wizard' | 'remoteProvider' | 'scm' | 'scm-input' | 'startReview' | 'startWork' | 'statusbar:hover' | 'view' | 'view:hover' | 'walkthrough' | 'whatsnew'
}
```

### cli/install/started

> Sent when a CLI install attempt is started

```typescript
{
  'attempts': number,
  'autoInstall': boolean,
  'insiders': boolean,
  'source': 'account' | 'subscription' | 'graph' | 'settings' | 'rebaseEditor' | 'ai' | 'ai:markdown-preview' | 'ai:markdown-editor' | 'ai:picker' | 'associateIssueWithBranch' | 'commandPalette' | 'deeplink' | 'editor:hover' | 'feature-badge' | 'feature-gate' | 'graph-details' | 'graph-header' | 'graph-kanban' | 'graph-sidebar' | 'graph-treemap' | 'inspect' | 'inspect-overview' | 'integrations' | 'merge-target' | 'notification' | 'prompt' | 'quick-wizard' | 'remoteProvider' | 'scm' | 'scm-input' | 'startReview' | 'startWork' | 'statusbar:hover' | 'view' | 'view:hover' | 'walkthrough' | 'whatsnew'
}
```

### cli/install/succeeded

> Sent when a CLI install attempt succeeds

```typescript
{
  'attempts': number,
  'autoInstall': boolean,
  'insiders': boolean,
  'source': 'account' | 'subscription' | 'graph' | 'settings' | 'rebaseEditor' | 'ai' | 'ai:markdown-preview' | 'ai:markdown-editor' | 'ai:picker' | 'associateIssueWithBranch' | 'commandPalette' | 'deeplink' | 'editor:hover' | 'feature-badge' | 'feature-gate' | 'graph-details' | 'graph-header' | 'graph-kanban' | 'graph-sidebar' | 'graph-treemap' | 'inspect' | 'inspect-overview' | 'integrations' | 'merge-target' | 'notification' | 'prompt' | 'quick-wizard' | 'remoteProvider' | 'scm' | 'scm-input' | 'startReview' | 'startWork' | 'statusbar:hover' | 'view' | 'view:hover' | 'walkthrough' | 'whatsnew',
  'version': string
}
```

### cli/ipc/failed

> Sent when the CLI integration IPC server fails to start

```typescript
{
  'error.message': string
}
```

### cli/updateCore/completed

> Sent when a CLI update succeeds

```typescript
{
  'current': string,
  'previous': string
}
```

### cli/updateCore/failed

> Sent when a CLI update fails

```typescript
{
  'error.message': string,
  'previous': string
}
```

### cloudIntegrations/connected

> Sent when connected to one or more cloud-based integrations from gkdev

```typescript
{
  'integration.connected.ids': string,
  'integration.ids': string
}
```

### cloudIntegrations/connecting

> Sent when connecting to one or more cloud-based integrations

```typescript
{
  'integration.ids': string
}
```

### cloudIntegrations/disconnect/failed

> Sent when disconnecting a provider from the api fails

```typescript
{
  'code': number,
  'integration.id': string
}
```

### cloudIntegrations/getConnection/failed

> Sent when getting a provider token from the api fails

```typescript
{
  'code': number,
  'integration.id': string
}
```

### cloudIntegrations/getConnections/failed

> Sent when getting connected providers from the api fails

```typescript
{
  'code': number
}
```

### cloudIntegrations/hosting/connected

> Sent when a cloud-based hosting provider is connected

```typescript
{
  'hostingProvider.key': string,
  'hostingProvider.provider': 'github' | 'gitlab' | 'bitbucket' | 'azureDevOps' | 'bitbucket-server' | 'github-enterprise' | 'cloud-github-enterprise' | 'gitlab-self-hosted' | 'cloud-gitlab-self-hosted' | 'azure-devops-server' | 'jira' | 'linear' | 'trello'
}
```

### cloudIntegrations/hosting/disconnected

> Sent when a cloud-based hosting provider is disconnected

```typescript
{
  'hostingProvider.key': string,
  'hostingProvider.provider': 'github' | 'gitlab' | 'bitbucket' | 'azureDevOps' | 'bitbucket-server' | 'github-enterprise' | 'cloud-github-enterprise' | 'gitlab-self-hosted' | 'cloud-gitlab-self-hosted' | 'azure-devops-server' | 'jira' | 'linear' | 'trello'
}
```

### cloudIntegrations/issue/connected

> Sent when a cloud-based issue provider is connected

```typescript
{
  'issueProvider.key': string,
  'issueProvider.provider': 'github' | 'gitlab' | 'bitbucket' | 'azureDevOps' | 'bitbucket-server' | 'github-enterprise' | 'cloud-github-enterprise' | 'gitlab-self-hosted' | 'cloud-gitlab-self-hosted' | 'azure-devops-server' | 'jira' | 'linear' | 'trello'
}
```

### cloudIntegrations/issue/disconnected

> Sent when a cloud-based issue provider is disconnected

```typescript
{
  'issueProvider.key': string,
  'issueProvider.provider': 'github' | 'gitlab' | 'bitbucket' | 'azureDevOps' | 'bitbucket-server' | 'github-enterprise' | 'cloud-github-enterprise' | 'gitlab-self-hosted' | 'cloud-gitlab-self-hosted' | 'azure-devops-server' | 'jira' | 'linear' | 'trello'
}
```

### cloudIntegrations/refreshConnection/failed

> Sent when refreshing a provider token from the api fails

```typescript
{
  'code': number,
  'integration.id': string
}
```

### cloudIntegrations/refreshConnection/skippedUnusualToken

> Sent when a connection session has a missing expiry date
or when connection refresh is skipped due to being a non-cloud session

```typescript
{
  'cloud': boolean,
  'integration.id': string,
  'reason': 'skip-non-cloud' | 'missing-expiry'
}
```

### cloudIntegrations/settingsOpened

> Sent when a user chooses to manage the cloud integrations

```typescript
{
  'integration.id': 'github' | 'gitlab' | 'bitbucket' | 'azureDevOps' | 'bitbucket-server' | 'github-enterprise' | 'cloud-github-enterprise' | 'gitlab-self-hosted' | 'cloud-gitlab-self-hosted' | 'azure-devops-server' | 'jira' | 'linear' | 'trello'
}
```

### command

> Sent when a WeGit command is executed

```typescript
{
  'command': string,
  'webview': string
}
```

or

```typescript
{
  'command': 'gitlens.gitCommands',
  'context.mode': string,
  'context.submode': string,
  'webview': string
}
```

### command/core

> Sent when a VS Code command is executed by a WeGit provided action

```typescript
{
  'command': string
}
```

### commit/signed

> Sent when a commit is signed

```typescript
{
  'format': 'gpg' | 'ssh' | 'x509' | 'openpgp'
}
```

### commit/signing/failed

> Sent when commit signing fails

```typescript
{
  'format': 'gpg' | 'ssh' | 'x509' | 'openpgp',
  'reason': 'noKey' | 'gpgNotFound' | 'sshNotFound' | 'passphraseFailed' | 'unknown'
}
```

### commit/signing/setup

> Sent when commit signing setup is completed

```typescript
{
  'format': 'gpg' | 'ssh' | 'x509' | 'openpgp',
  'keyGenerated': boolean
}
```

### commit/signing/setupWizard/opened

> Sent when commit signing setup wizard is opened

```typescript
{
  'alreadyConfigured': boolean
}
```

### commitDetails/closed

```typescript
{
  [`context.${string}`]: string | number | boolean,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### commitDetails/mode/changed

> Sent when the user changes the selected tab (mode) on the Graph Details view

```typescript
{
  'context.autolinks': number,
  'context.inReview': boolean,
  'context.mode': 'wip',
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'mode.new': 'wip' | 'commit',
  'mode.old': 'wip' | 'commit'
}
```

or

```typescript
{
  'context.autolinks': number,
  'context.mode': 'commit',
  'context.pinned': boolean,
  'context.type': 'stash' | 'commit',
  'context.uncommitted': boolean,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'mode.new': 'wip' | 'commit',
  'mode.old': 'wip' | 'commit'
}
```

### commitDetails/reachability/failed

> Sent when commit reachability fails to load

```typescript
{
  'duration': number,
  'failed.error': string,
  'failed.reason': 'unknown' | 'git-error' | 'timeout'
}
```

### commitDetails/reachability/loaded

> Sent when commit reachability is successfully loaded

```typescript
{
  'duration': number,
  'refs.count': number
}
```

### commitDetails/showAborted

```typescript
{
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'duration': number,
  'loading': boolean
}
```

### commitDetails/shown

> Sent when the Inspect view is shown

```typescript
{
  'context.autolinks': number,
  'context.config.autolinks.enabled': boolean,
  'context.config.autolinks.enhanced': boolean,
  'context.config.avatars': boolean,
  'context.config.files.compact': boolean,
  'context.config.files.icon': 'status' | 'type',
  'context.config.files.layout': 'auto' | 'list' | 'tree',
  'context.config.files.threshold': number,
  'context.config.pullRequests.enabled': boolean,
  'context.inReview': boolean,
  'context.mode': 'wip',
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'duration': number,
  'loading': boolean
}
```

or

```typescript
{
  'context.autolinks': number,
  'context.config.autolinks.enabled': boolean,
  'context.config.autolinks.enhanced': boolean,
  'context.config.avatars': boolean,
  'context.config.files.compact': boolean,
  'context.config.files.icon': 'status' | 'type',
  'context.config.files.layout': 'auto' | 'list' | 'tree',
  'context.config.files.threshold': number,
  'context.config.pullRequests.enabled': boolean,
  'context.mode': 'commit',
  'context.pinned': boolean,
  'context.type': 'stash' | 'commit',
  'context.uncommitted': boolean,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'duration': number,
  'loading': boolean
}
```

### extension/chunkLoad/failed

> Sent when a lazily-loaded webpack chunk fails to load — typically because VS Code
background-upgraded the extension while the host kept running the old build

```typescript
{
  'error.code': string,
  'error.message': string
}
```

### gitCommand/conflict

> Sent when a conflict occurs while running a conflict-prone git command

```typescript
{
  'command': 'rebase' | 'merge' | 'cherry-pick' | 'revert' | 'stash-apply' | 'stash-pop'
}
```

### gitCommand/run

> Sent when a conflict-prone git command (merge, rebase, cherry-pick, revert, stash apply/pop) is run

```typescript
{
  'command': 'rebase' | 'merge' | 'cherry-pick' | 'revert' | 'stash-apply' | 'stash-pop'
}
```

### graph/action/jumpTo

> Sent when the user clicks on the Jump to HEAD/Reference (alt) header button on the graph view

```typescript
{
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'target': 'HEAD' | 'choose'
}
```

### graph/action/openRepoOnRemote

> Sent when the user clicks on the "Jump to HEAD"/"Jump to Reference" (alt) header button on the graph view

```typescript
{
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### graph/action/sidebar

> Sent when the user clicks on the "Open Repository on Remote" header button on the graph view

```typescript
{
  'action': string,
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### graph/autoFetch

> Sent when WeGit auto-fetch fires a `git fetch` for the visible graph view

```typescript
{
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'intervalSeconds': number,
  'sinceLastFetchedMs': number
}
```

### graph/branchesVisibility/changed

> Sent when the user changes the "branches visibility" on the graph view

```typescript
{
  'branchesVisibility.new': 'all' | 'smart' | 'current' | 'favorited' | 'agents',
  'branchesVisibility.old': 'all' | 'smart' | 'current' | 'favorited' | 'agents',
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### graph/columns/changed

> Sent when the user changes the columns on the graph view

```typescript
{
  [`column.${string}.isHidden`]: boolean,
  [`column.${string}.mode`]: string,
  [`column.${string}.width`]: number,
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### graph/command

> Sent when a graph command is executed

```typescript
{
  'command': string,
  'webview': string
}
```

### graph/filters/changed

> Sent when the user changes the filters on the graph view

```typescript
{
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'key': string,
  'value': boolean
}
```

### graph/filters/cleared

> Sent when the user clears all filters on the graph view

```typescript
{
  'cleared.branchesVisibility': boolean,
  'cleared.excludeRefs': boolean,
  'cleared.excludeTypes': boolean,
  'cleared.includeOnlyRefs': boolean,
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### graph/minimap/day/selected

> Sent when the user selects (clicks on) a day on the graph minimap

```typescript
{
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### graph/overview/action

> Sent when the user invokes an action item on a Graph Overview branch card

```typescript
{
  // Whether the user held Alt/Shift to swap to the alt action
  'alt': boolean,
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  // Where on the card the action was invoked
  'location': 'inline' | 'hover',
  'name': 'pull' | 'push' | 'fetch' | 'publishBranch' | 'switch' | 'openWorktree' | 'compareWithHead' | 'compareWithWorking' | 'compareWithPr' | 'other'
}
```

### graph/overview/shown

> Sent when the Graph Overview panel becomes visible (mounted in the active sidebar slot)

```typescript
{
  // Number of branches in the "active" section at the time of show
  'branches.active.count': number,
  // Number of branches in the "recent" section at the time of show
  'branches.recent.count': number,
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### graph/repository/changed

> Sent when the user changes the current repository on the graph view

```typescript
{
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'repository.closed': boolean,
  'repository.folder.scheme': string,
  'repository.id': string,
  'repository.provider.id': string,
  'repository.scheme': string
}
```

### graph/row/hovered

> Sent when the user points at a row on the graph view (first time and every 100 times after)

```typescript
{
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'count': number
}
```

### graph/row/selected

> Sent when the user selects (clicks on) a row or rows on the graph view (first time and every 100 times after)

```typescript
{
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'count': number,
  'rows': number
}
```

### graph/rows/loaded

> Sent when rows are loaded into the graph view

```typescript
{
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'duration': number,
  'rows': number
}
```

### graph/scope/changed

> Sent when the user scopes the graph view to a specific branch (Focus Branch feature)

```typescript
{
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  // Whether the scope's merge-target tip SHA is known at scope time (proxy for "merge-target resolved")
  'scope.hasMergeTarget': boolean,
  // Whether the scoped branch has a tracked upstream resolved at the time of the scope change
  'scope.hasUpstream': boolean,
  // Where the user initiated the scope change
  'source': 'popover' | 'overview-card'
}
```

### graph/scope/cleared

> Sent when the user clears the active graph scope

```typescript
{
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### graph/searched

> Sent when a search was performed on the graph view

```typescript
{
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'duration': number,
  'failed': boolean,
  'failed.error': string,
  'failed.error.detail': string,
  'failed.reason': 'error' | 'cancelled',
  'matches': number,
  'types': string
}
```

### graph/shown

> Sent when the graph view is shown

```typescript
{
  [`context.column.${string}.mode`]: string,
  [`context.column.${string}.visible`]: boolean,
  'context.config.allowMultiple': boolean,
  'context.config.autoFetch.enabled': boolean,
  'context.config.avatars': boolean,
  'context.config.branchesVisibility': 'all' | 'smart' | 'current' | 'favorited' | 'agents',
  'context.config.commitOrdering': 'date' | 'author-date' | 'topo',
  'context.config.dateFormat': string,
  'context.config.dateStyle': 'absolute' | 'relative',
  'context.config.defaultItemLimit': number,
  'context.config.details.location': 'right' | 'bottom',
  'context.config.dimMergeCommits': boolean,
  'context.config.editorOpeningBehavior': 'active' | 'auto',
  'context.config.experimental.kanban.enabled': boolean,
  'context.config.experimental.visualizations.activityDecay': '30s' | '1m' | '2m' | '5m' | '10m' | '30m',
  'context.config.experimental.visualizations.enabled': boolean,
  'context.config.highlightRowsOnRefHover': boolean,
  'context.config.initialRowSelection': 'wip' | 'head',
  'context.config.issues.enabled': boolean,
  'context.config.layout': 'editor' | 'panel',
  'context.config.minimap.additionalTypes': string,
  'context.config.minimap.dataType': 'commits' | 'lines',
  'context.config.minimap.enabled': boolean,
  'context.config.minimap.reversed': boolean,
  'context.config.multiselect': boolean | 'topological',
  'context.config.onlyFollowFirstParent': boolean,
  'context.config.pageItemLimit': number,
  'context.config.pullRequests.enabled': boolean,
  'context.config.scrollMarkers.additionalTypes': string,
  'context.config.scrollMarkers.enabled': boolean,
  'context.config.scrollRowPadding': number,
  'context.config.searchAutocompleteOnFocus': boolean,
  'context.config.searchItemLimit': number,
  'context.config.showGhostRefsOnRowHover': boolean,
  'context.config.showRemoteNames': boolean,
  'context.config.showUpstreamStatus': boolean,
  'context.config.showWorktreeWipStats': boolean,
  'context.config.sidebar.enabled': boolean,
  'context.config.sidebar.pinned': boolean,
  'context.config.statusBar.enabled': boolean,
  'context.config.stickyTimeline': boolean,
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'duration': number,
  'loading': boolean
}
```

### graph/virtualFile/failed

> Sent when opening a virtual-FS-backed file fails (e.g. the compose session is no longer registered)

```typescript
{
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'error.message': string,
  'files.count': number,
  'mode': 'diff' | 'comparePrevious' | 'multiDiff',
  // Best-effort categorization of the failure
  'reason': 'unknown' | 'provider-missing' | 'parent-missing'
}
```

### graph/virtualFile/opened

> Sent when a virtual-FS-backed file (e.g. a Graph Compose proposed commit) is opened

```typescript
{
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  // Number of files being opened (1 for single-file modes, N for multiDiff)
  'files.count': number,
  // Which open operation the user triggered
  'mode': 'diff' | 'comparePrevious' | 'multiDiff'
}
```

### graph/wip/commit/failed

> Sent when a commit from the Graph's WIP panel fails (e.g. a hook rejection or signing failure)

```typescript
{
  // Whether the failed commit was an amend
  'amend': boolean,
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  // Whether raw output (hook/git stderr) was captured and surfaced via "View Full Output"
  'hasOutput': boolean,
  'reason': 'unknown' | 'hookRejected' | 'signingFailed' | 'nothingToCommit' | 'conflicts' | 'identityMissing'
}
```

### graphDetails/closed

> Sent when the integrated graph details panel is collapsed

```typescript
{
  // How long the panel was open in milliseconds
  'duration': number,
  // Active panel mode at time of close
  'mode': 'wip' | 'commit' | 'compare' | 'review' | 'multicommit' | 'compose' | 'resolve' | 'none'
}
```

### graphDetails/mode/changed

> Sent when the active mode of the integrated graph details panel changes while open

```typescript
{
  'context.repository.closed': boolean,
  'context.repository.folder.scheme': string,
  'context.repository.id': string,
  'context.repository.provider.id': string,
  'context.repository.scheme': string,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'mode.new': 'wip' | 'commit' | 'compare' | 'review' | 'multicommit' | 'compose' | 'resolve' | 'none',
  'mode.old': 'wip' | 'commit' | 'compare' | 'review' | 'multicommit' | 'compose' | 'resolve' | 'none'
}
```

### graphDetails/reachability/failed

> Sent when commit reachability fails to load in Graph Details

```typescript
{
  'duration': number,
  'failed.error': string,
  'failed.reason': 'unknown' | 'git-error' | 'timeout'
}
```

### graphDetails/reachability/loaded

> Sent when commit reachability is successfully loaded in Graph Details

```typescript
{
  'duration': number,
  'refs.count': number
}
```

### graphDetails/shown

> Sent when the integrated graph details panel is expanded

```typescript
{
  // Which graph host the panel is in: editor area or bottom panel
  'host': 'editor' | 'panel',
  // Where the details panel is anchored relative to the graph
  'location': 'right' | 'bottom',
  // Active panel mode at time of show
  'mode': 'wip' | 'commit' | 'compare' | 'review' | 'multicommit' | 'compose' | 'resolve' | 'none',
  // Split-pane position percentage from the closed edge (0–100)
  'position': number,
  // Number of rows currently selected in the graph (0, 1, or N)
  'selection.count': number,
  // Whether the active selection is the WIP / uncommitted row
  'selection.uncommitted': boolean,
  // What caused the panel to be shown
  'trigger': 'toggle' | 'request-compare' | 'request-mode' | 'request-agents' | 'request-graph-wip-bar' | 'auto-restore'
}
```

### op/gate/deadlock

```typescript
{
  'key': string,
  'prop': string,
  // Whether this is just a warning or the gate was forcibly cleared
  'status': 'warning' | 'aborted',
  'timeout': number
}
```

### op/git/aborted

```typescript
{
  'duration': number,
  'operation': string,
  'reason': 'unknown' | 'timeout' | 'cancellation',
  'timeout': number
}
```

### op/git/gitDirResolve/failed

> Sent when getGitDir resolves to a non-existent .git directory or rev-parse fails

```typescript
{
  'error.message': string,
  'git.dir': string,
  'repository.path': string
}
```

### op/git/queueWait

> Sent when a background git command waited in the queue

```typescript
{
  // Number of active git processes when this command started
  'active': number,
  // Configured max concurrent processes
  'maxConcurrent': number,
  // Priority level of the command that waited
  'priority': 'interactive' | 'normal' | 'background',
  // Number of background commands queued
  'queued.background': number,
  // Number of interactive commands queued
  'queued.interactive': number,
  // Number of normal commands queued
  'queued.normal': number,
  // Time in ms the command waited in the queue before executing
  'waitTime': number
}
```

### openReviewMode

> Sent when a PR review was started in the inspect overview

```typescript
{
  'filesChanged': number,
  'provider': string,
  // Provided for compatibility with other GK surfaces
  'repoPrivacy': 'private' | 'public' | 'local',
  'repository.visibility': 'private' | 'public' | 'local',
  // Provided for compatibility with other GK surfaces
  'source': 'account' | 'subscription' | 'graph' | 'settings' | 'rebaseEditor' | 'ai' | 'ai:markdown-preview' | 'ai:markdown-editor' | 'ai:picker' | 'associateIssueWithBranch' | 'commandPalette' | 'deeplink' | 'editor:hover' | 'feature-badge' | 'feature-gate' | 'graph-details' | 'graph-header' | 'graph-kanban' | 'graph-sidebar' | 'graph-treemap' | 'inspect' | 'inspect-overview' | 'integrations' | 'merge-target' | 'notification' | 'prompt' | 'quick-wizard' | 'remoteProvider' | 'scm' | 'scm-input' | 'startReview' | 'startWork' | 'statusbar:hover' | 'view' | 'view:hover' | 'walkthrough' | 'whatsnew'
}
```

### productConfig/failed

> Sent when fetching the product config fails

```typescript
{
  'exception': string,
  'json': string,
  'reason': 'fetch' | 'validation',
  'statusCode': number
}
```

### providers/context

> Sent when the "context" of the workspace changes (e.g. repo added, integration connected, etc)

```typescript
void
```

### providers/registrationComplete

> Sent when we've loaded all the git providers and their repositories

```typescript
{
  'config.git.autoRepositoryDetection': boolean | 'subFolders' | 'openEditors'
}
```

### rebase/closed

```typescript
{
  [`context.${string}`]: string | number | boolean,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### rebase/showAborted

```typescript
{
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'duration': number,
  'loading': boolean
}
```

### rebase/shown

```typescript
{
  [`context.${string}`]: string | number | boolean,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'duration': number,
  'loading': boolean
}
```

### rebaseEditor/action/abort

> Sent when the user aborts a rebase

```typescript
{
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.duration': number,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### rebaseEditor/action/continue

> Sent when the user continues a paused rebase

```typescript
{
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### rebaseEditor/action/openConflictChanges

> Sent when the user opens current or incoming changes for a conflict file

```typescript
{
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  // Which side of the conflict was opened
  'side': 'current' | 'incoming'
}
```

### rebaseEditor/action/openConflictFile

> Sent when the user opens a conflict file from the inline conflict panel

```typescript
{
  // File extension of the opened conflict file (e.g. '.ts', '.json')
  'conflict.fileExtension': string,
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### rebaseEditor/action/resolveAllConflicts

> Sent when the user resolves all conflict files by taking one side

```typescript
{
  // Total number of conflicted files at the time of confirmation
  'conflict.fileCount': number,
  // Number of files whose resolution failed (checkout or staging error)
  'conflict.fileCount.failed': number,
  // Number of files successfully resolved (checked out or deleted, and then staged)
  'conflict.fileCount.resolved': number,
  // Number of files skipped because the requested side is unsupported for their status
  'conflict.fileCount.skipped': number,
  // Which side of the conflict was taken for all files
  'conflict.resolution': 'current' | 'incoming',
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### rebaseEditor/action/resolveConflict

> Sent when the user resolves a single conflict file by taking one side

```typescript
{
  // File extension of the resolved conflict file (e.g. '.ts', '.json')
  'conflict.fileExtension': string,
  // Which side of the conflict was taken
  'conflict.resolution': 'current' | 'incoming',
  // Two-character conflict status (e.g. 'UU', 'AU')
  'conflict.status': string,
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### rebaseEditor/action/revealRef

> Sent when the user reveals a ref (commit/branch) in graph or commit details

```typescript
{
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  // Where the ref is being revealed
  'location': 'graph' | 'commitDetails',
  // Type of ref being revealed
  'ref.type': 'commit' | 'branch'
}
```

### rebaseEditor/action/showConflicts

> Sent when the user clicks to show conflicts

```typescript
{
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### rebaseEditor/action/skip

> Sent when the user skips a commit during a paused rebase

```typescript
{
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### rebaseEditor/action/stageConflict

> Sent when the user stages a single conflict file (marks as resolved)

```typescript
{
  // File extension of the staged conflict file (e.g. '.ts', '.json')
  'conflict.fileExtension': string,
  // Two-character conflict status (e.g. 'UU', 'AU')
  'conflict.status': string,
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### rebaseEditor/action/start

> Sent when the user starts a rebase (clicks "Start Rebase")

```typescript
{
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.duration': number,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### rebaseEditor/action/switchToText

> Sent when the user switches to the text editor

```typescript
{
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.duration': number,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### rebaseEditor/action/toggleOrdering

> Sent when the user toggles the commit ordering (ascending/descending)

```typescript
{
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'ordering.new': 'asc' | 'desc',
  'ordering.old': 'asc' | 'desc'
}
```

### rebaseEditor/conflicts/detected

> Sent when conflict detection completes (check status for result)

```typescript
{
  // Number of conflicting commits (only when status is 'conflicts')
  'commits.conflicting': number,
  // Number of commits checked
  'commits.count': number,
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  // Which detection mode produced this event
  'detection': 'potential' | 'todo',
  // Duration of conflict detection in milliseconds
  'duration': number,
  // Result status
  'status': 'conflicts' | 'clean'
}
```

### rebaseEditor/conflicts/detecting

> Sent when conflict detection starts

```typescript
{
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### rebaseEditor/conflicts/failed

> Sent when conflict detection fails

```typescript
{
  // Number of commits that were being checked
  'commits.count': number,
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  // Duration before failure in milliseconds
  'duration': number,
  // Error message
  'error': string
}
```

### rebaseEditor/entries/changed

> Sent when the user changes rebase entry action(s) (pick, squash, drop, etc.)

```typescript
{
  // The new action applied
  'action': string,
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  // Number of entries changed
  'count': number
}
```

### rebaseEditor/entries/moved

> Sent when the user moves/reorders entries

```typescript
{
  'context.ascending': boolean,
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  // Number of entries moved
  'count': number,
  // Method used to move entries
  'method': 'drag' | 'keyboard'
}
```

### rebaseEditor/shown

> Sent when the Rebase Editor is shown

```typescript
{
  'context.ascending': boolean,
  'context.config.density': 'compact' | 'comfortable',
  'context.config.openBehavior': 'auto' | 'beside',
  'context.config.openOnPausedRebase': boolean | 'interactive',
  'context.config.ordering': 'asc' | 'desc',
  'context.config.revealBehavior': 'onDoubleClick' | 'onSelection',
  'context.config.revealLocation': 'graph' | 'inspect',
  'context.done.count': number,
  'context.hasConflicts': boolean,
  'context.isPaused': boolean,
  'context.isRebasing': boolean,
  'context.preservesMerges': boolean,
  'context.session.start': string,
  'context.todo.count': number,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'duration': number,
  'loading': boolean
}
```

### remoteProviders/connected

> Sent when a local (Git remote-based) hosting provider is connected

```typescript
{
  'hostingProvider.key': string,
  'hostingProvider.provider': 'github' | 'gitlab' | 'bitbucket' | 'azureDevOps' | 'bitbucket-server' | 'github-enterprise' | 'cloud-github-enterprise' | 'gitlab-self-hosted' | 'cloud-gitlab-self-hosted' | 'azure-devops-server' | 'jira' | 'linear' | 'trello',
  // @deprecated: true
  'remoteProviders.key': string
}
```

### remoteProviders/disconnected

> Sent when a local (Git remote-based) hosting provider is disconnected

```typescript
{
  'hostingProvider.key': string,
  'hostingProvider.provider': 'github' | 'gitlab' | 'bitbucket' | 'azureDevOps' | 'bitbucket-server' | 'github-enterprise' | 'cloud-github-enterprise' | 'gitlab-self-hosted' | 'cloud-gitlab-self-hosted' | 'azure-devops-server' | 'jira' | 'linear' | 'trello',
  // @deprecated: true
  'remoteProviders.key': string
}
```

### repositories/changed

> Sent when the workspace's repositories change

```typescript
{
  'repositories.added': number,
  'repositories.removed': number
}
```

### repositories/visibility

> Sent when the workspace's repository visibility is first requested

```typescript
{
  'repositories.visibility': 'private' | 'public' | 'local' | 'mixed'
}
```

### repository/opened

> Sent when a repository is opened

```typescript
{
  'repository.closed': boolean,
  'repository.contributors.commits.avgPerContributor': number,
  'repository.contributors.commits.count': number,
  'repository.contributors.count': number,
  'repository.contributors.distribution.[1]': number,
  'repository.contributors.distribution.[101+]': number,
  'repository.contributors.distribution.[11-50]': number,
  'repository.contributors.distribution.[2-5]': number,
  'repository.contributors.distribution.[51-100]': number,
  'repository.contributors.distribution.[6-10]': number,
  'repository.contributors.since': '1.year.ago',
  'repository.folder.scheme': string,
  'repository.id': string,
  'repository.provider.id': string,
  'repository.remoteProviders': string,
  'repository.scheme': string,
  'repository.submodules.openedCount': number,
  'repository.worktrees.openedCount': number
}
```

### repository/visibility

> Sent when a repository's visibility is first requested

```typescript
{
  'repository.closed': boolean,
  'repository.folder.scheme': string,
  'repository.id': string,
  'repository.provider.id': string,
  'repository.scheme': string,
  'repository.visibility': 'private' | 'public' | 'local'
}
```

### settings/closed

```typescript
{
  [`context.${string}`]: string | number | boolean,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string
}
```

### settings/showAborted

```typescript
{
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'duration': number,
  'loading': boolean
}
```

### settings/shown

```typescript
{
  [`context.${string}`]: string | number | boolean,
  'context.webview.host': 'view' | 'editor' | 'panel',
  'context.webview.id': string,
  'context.webview.instanceId': string,
  'context.webview.type': string,
  'duration': number,
  'loading': boolean
}
```

### startReview/action

> Sent when the user chooses to manage integrations

```typescript
{
  'instance': number,
  'action': 'manage' | 'connect',
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### startReview/agent/resolved

> Sent when the manual-vs-agent flow resolves (manual, cancel, or a specific agent)

```typescript
{
  'instance': number,
  'agent.resolution': 'manual' | 'cancel',
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

or

```typescript
{
  'instance': number,
  'agent.id': string,
  'agent.kind': string,
  'agent.resolution': 'agent',
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### startReview/open

> Sent when the user opens Start Review; use `instance` to correlate a StartReview "session"

```typescript
{
  'instance': number,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string
}
```

### startReview/opened

> Sent when Start Review is opened; use `instance` to correlate a StartReview "session"

```typescript
{
  'instance': number,
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### startReview/pr/action

> Sent when the user takes an action on a Start Review PR

```typescript
{
  'instance': number,
  'action': 'soft-open',
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  [`item.${string}`]: string | number | boolean,
  'items.count': number
}
```

### startReview/pr/chosen

> Sent when the user chooses a PR to review in the second step

```typescript
{
  'instance': number,
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  [`item.${string}`]: string | number | boolean,
  'items.count': number
}
```

### startReview/steps/connect

> Sent when the user reaches the "connect an integration" step of Start Review

```typescript
{
  'instance': number,
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### startReview/steps/pr

> Sent when the user reaches the "choose a PR" step of Start Review

```typescript
{
  'instance': number,
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### startReview/title/action

> Sent when the user chooses to connect an integration

```typescript
{
  'instance': number,
  'action': 'connect',
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### startWork/action

> Sent when the user chooses to manage integrations

```typescript
{
  'instance': number,
  'action': 'manage' | 'connect',
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### startWork/agent/resolved

> Sent when the manual-vs-agent flow resolves (manual, cancel, or a specific agent)

```typescript
{
  'instance': number,
  'agent.resolution': 'manual' | 'cancel',
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

or

```typescript
{
  'instance': number,
  'agent.id': string,
  'agent.kind': string,
  'agent.resolution': 'agent',
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### startWork/issue/action

> Sent when the user takes an action on a StartWork issue

```typescript
{
  'instance': number,
  'action': 'soft-open',
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  [`item.${string}`]: string | number | boolean,
  'items.count': number
}
```

### startWork/issue/chosen

> Sent when the user chooses an issue to start work in the second step

```typescript
{
  'instance': number,
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  [`item.${string}`]: string | number | boolean,
  'items.count': number
}
```

### startWork/open

> Sent when the user opens Start Work; use `instance` to correlate a StartWork "session"

```typescript
{
  'instance': number,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string
}
```

### startWork/opened

> Sent when Start Work is opened; use `instance` to correlate a StartWork "session"

```typescript
{
  'instance': number,
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### startWork/steps/connect

> Sent when the user reaches the "connect an integration" step of Start Work

```typescript
{
  'instance': number,
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### startWork/steps/issue

> Sent when the user reaches the "choose an issue" step of Start Work

```typescript
{
  'instance': number,
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### startWork/title/action

> Sent when the user chooses to connect an integration

```typescript
{
  'instance': number,
  'action': 'connect',
  'connected': boolean,
  // Route requested by the caller for the manual-vs-agent flow; `undefined` when the caller didn't opt in.
  'context.showOpenInAgent': string,
  'items.count': number
}
```

### subscription

> Sent when the subscription is loaded

```typescript
{
  [`account.${string}`]: string,
  'subscription.actual.id': 'community',
  'subscription.effective.id': 'community',
  'subscription.featurePreviews.graph.day': number,
  [`subscription.featurePreviews.graph.day.${number}.startedOn`]: string,
  'subscription.featurePreviews.graph.startedOn': string,
  'subscription.featurePreviews.graph.status': 'eligible' | 'active' | 'expired',
  'subscription.id': 'community',
  // Promo discount code associated with the upgrade
  'subscription.promo.code': string,
  // Promo key (identifier) associated with the upgrade
  'subscription.promo.key': string,
  'subscription.state': -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6,
  'subscription.stateString': string
}
```

### subscription/action

> Sent when the user takes an action on the subscription

```typescript
{
  'action': 'manage' | 'sign-up' | 'sign-in' | 'sign-out' | 'manage-subscription' | 'reactivate' | 'refer-friend' | 'resend-verification' | 'pricing'
}
```

or

```typescript
{
  // `true` if the user cancels the VS Code prompt to open the browser
  'aborted': boolean,
  'action': 'upgrade',
  // Promo discount code associated with the upgrade
  'promo.code': string,
  // Promo key (identifier) associated with the upgrade
  'promo.key': string
}
```

or

```typescript
{
  'action': 'visibility',
  'visible': boolean
}
```

### subscription/changed

> Sent when the subscription changes

```typescript
{
  [`account.${string}`]: string,
  [`previous.account.${string}`]: string,
  'previous.subscription.actual.id': 'community',
  'previous.subscription.effective.id': 'community',
  'previous.subscription.id': 'community',
  'subscription.actual.id': 'community',
  'subscription.effective.id': 'community',
  'subscription.featurePreviews.graph.day': number,
  [`subscription.featurePreviews.graph.day.${number}.startedOn`]: string,
  'subscription.featurePreviews.graph.startedOn': string,
  'subscription.featurePreviews.graph.status': 'eligible' | 'active' | 'expired',
  'subscription.id': 'community',
  // Promo discount code associated with the upgrade
  'subscription.promo.code': string,
  // Promo key (identifier) associated with the upgrade
  'subscription.promo.key': string,
  'subscription.state': -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6,
  'subscription.stateString': string
}
```

### usage/track

> Sent when a "tracked feature" is interacted with, today that is only when webview/webviewView/custom editor is shown

```typescript
{
  'usage.count': number,
  'usage.key': string /* TrackedUsageKeys */
}
```

### walkthrough

> Sent when the walkthrough is opened

```typescript
{
  'step': 'get-started-community' | 'visualize-code-history' | 'improve-workflows-with-integrations',
  'usingFallbackUrl': boolean
}
```

### walkthrough/action

> Sent when the walkthrough is opened

```typescript
{
  'command': string,
  'detail': string,
  'name': 'open/help-center/interactive-code-history' | 'connect/integrations' | 'create/worktree' | 'open/help-center' | 'open/walkthrough' | 'open/inspect',
  'type': 'command'
}
```

or

```typescript
{
  'detail': string,
  'name': 'open/help-center/interactive-code-history' | 'connect/integrations' | 'create/worktree' | 'open/help-center' | 'open/walkthrough' | 'open/inspect',
  'type': 'url',
  'url': string
}
```

### walkthrough/completion

```typescript
{
  'context.key': 'gettingStarted' | 'visualizeCodeHistory' | 'gitBlame' | 'prReviews' | 'mcpFeatures' | 'aiFeatures' | 'graphAgentMonitoring' | 'graphParallelWork' | 'graphAiReview' | 'graphCompose' | 'graphCompare' | 'graphNextSteps'
}
```

