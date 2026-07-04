import { html, nothing } from 'lit';
import { createCommandLink } from '../../../../../system/commands.js';
import './action-chip.js';

export function renderLearnAboutAutolinks(opts: {
	hasIntegrationsConnected: boolean;
	hasAccount: boolean;
	showLabel?: boolean;
	slotName?: 'prefix' | 'suffix';
}) {
	const autolinkSettingsLink = createCommandLink('gitlens.showSettingsPage!autolinks', {
		showOptions: { preserveFocus: true },
	});

	let label = 'Configure autolinks to linkify external references, like Jira or Zendesk tickets, in commit messages.';
	if (!opts.hasIntegrationsConnected) {
		label = `<a href="${autolinkSettingsLink}">Configure autolinks</a> to linkify external references, like Jira or Zendesk tickets, in commit messages.`;
		label += '\n\nAdd matching rules here to enable project-specific autolinks.';
	}

	return html`<gl-action-chip
		slot=${opts.slotName ?? nothing}
		href=${autolinkSettingsLink}
		data-action="autolink-settings"
		icon="info"
		.label=${label}
		truncate
		overlay=${opts.hasIntegrationsConnected ? 'tooltip' : 'popover'}
		>${opts.showLabel ? html`<span class="mq-hide-sm">&nbsp;No autolinks found</span>` : nothing}</gl-action-chip
	>`;
}
