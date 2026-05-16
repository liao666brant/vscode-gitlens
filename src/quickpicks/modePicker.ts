import type { QuickPickItem } from 'vscode';
import { window } from 'vscode';
import { GlyphChars } from '../constants.js';
import { configuration } from '../system/-webview/configuration.js';

export interface ModesQuickPickItem extends QuickPickItem {
	key: string | undefined;
}

export async function showModePicker(): Promise<ModesQuickPickItem | undefined> {
	const modes = configuration.get('modes');
	if (modes == null) return undefined;

	const modeKeys = Object.keys(modes);
	if (modeKeys.length === 0) return undefined;

	const mode = configuration.get('mode.active');

	const items = modeKeys.map(key => {
		const modeCfg = modes[key];
		const item: ModesQuickPickItem = {
			label: `${mode === key ? '$(check)\u00a0\u00a0' : '\u00a0\u00a0\u00a0\u00a0\u00a0'}${modeCfg.name} \u6a21\u5f0f`,
			description: modeCfg.description ? `\u00a0${GlyphChars.Dash}\u00a0 ${modeCfg.description}` : '',
			key: key,
		};
		return item;
	});

	if (mode && modes[mode] != null) {
		items.unshift({
			label: `\u9000\u51fa ${modes[mode].name} \u6a21\u5f0f`,
			key: undefined,
		});
	}

	const pick = await window.showQuickPick(items, {
		placeHolder: '\u9009\u62e9\u8981\u8fdb\u5165\u7684 GitLens \u6a21\u5f0f',
	});

	return pick;
}
