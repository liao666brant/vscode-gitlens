import type { TextEditor } from 'vscode';
import type { GitBlame, ProgressiveGitBlame } from '@gitlens/git/models/blame.js';
import { debug } from '@gitlens/utils/decorators/log.js';
import type { FileAnnotationType } from '../config.js';
import type { Container } from '../container.js';
import { getCommitDate } from '../git/utils/-webview/commit.utils.js';
import { configuration } from '../system/-webview/configuration.js';
import type { TrackedGitDocument } from '../trackers/trackedDocument.js';
import type { DidChangeStatusCallback } from './annotationProvider.js';
import { AnnotationProviderBase } from './annotationProvider.js';
import type { ComputedHeatmap } from './annotations.js';
import { getHeatmapColors } from './annotations.js';

export abstract class BlameAnnotationProviderBase extends AnnotationProviderBase {
	protected blame: Promise<GitBlame | undefined>;
	protected progressive: Promise<ProgressiveGitBlame | undefined> | undefined;

	constructor(
		container: Container,
		onDidChangeStatus: DidChangeStatusCallback,
		annotationType: FileAnnotationType,
		editor: TextEditor,
		trackedDocument: TrackedGitDocument,
	) {
		super(container, onDidChangeStatus, annotationType, editor, trackedDocument);

		this.progressive = container.git.getBlameProgressive(this.trackedDocument.uri, editor.document);
		this.blame = this.progressive.then(p =>
			p != null ? p.completed : container.git.getBlame(this.trackedDocument.uri, editor.document),
		);

		if (editor.document.isDirty) {
			trackedDocument.setForceDirtyStateChangeOnNextDocumentChange();
		}
	}

	override async validate(): Promise<boolean> {
		// If progressive blame is streaming, it's valid — don't block on the full result
		const progressive = await this.progressive;
		if (progressive != null) return true;

		const blame = await this.blame;
		return Boolean(blame?.lines.length);
	}

	protected async getBlame(force?: boolean): Promise<GitBlame | undefined> {
		if (force) {
			this.blame = this.container.git.getBlame(this.trackedDocument.uri, this.editor.document);
		}
		const blame = await this.blame;
		if (!blame?.lines.length) return undefined;

		return blame;
	}

	@debug({ args: false })
	protected getComputedHeatmap(blame: GitBlame): ComputedHeatmap {
		const dates: Date[] = [];

		for (const commit of blame.commits.values()) {
			dates.push(getCommitDate(commit));
		}

		dates.sort((a, b) => a.getTime() - b.getTime());

		const coldThresholdDate = new Date();
		coldThresholdDate.setDate(coldThresholdDate.getDate() - (configuration.get('heatmap.ageThreshold') || 90));
		const coldThresholdTimestamp = coldThresholdDate.getTime();

		const hotDates: Date[] = [];
		const coldDates: Date[] = [];

		for (const d of dates) {
			if (d.getTime() < coldThresholdTimestamp) {
				coldDates.push(d);
			} else {
				hotDates.push(d);
			}
		}

		let lookupTable:
			| number[]
			| {
					hot: number[];
					cold: number[];
			  };
		if (hotDates.length && coldDates.length) {
			lookupTable = {
				hot: getRelativeAgeLookupTable(hotDates),
				cold: getRelativeAgeLookupTable(coldDates),
			};
		} else {
			lookupTable = getRelativeAgeLookupTable(dates);
		}

		const getLookupTable = (date: Date, unified?: boolean) =>
			Array.isArray(lookupTable)
				? lookupTable
				: unified
					? [...lookupTable.hot, ...lookupTable.cold]
					: date.getTime() < coldThresholdTimestamp
						? lookupTable.cold
						: lookupTable.hot;

		const computeRelativeAge = (date: Date, lookup: number[]) => {
			const time = date.getTime();
			let index = 0;
			for (let i = 0; i < lookup.length; i++) {
				index = i;
				if (time >= lookup[i]) break;
			}

			return index;
		};

		return {
			coldThresholdTimestamp: coldThresholdTimestamp,
			colors: getHeatmapColors(),
			computeRelativeAge: (date: Date) => computeRelativeAge(date, getLookupTable(date)),
			computeOpacity: (date: Date) => {
				const lookup = getLookupTable(date, true);
				const age = computeRelativeAge(date, lookup);

				return Math.max(0.2, Math.round((1 - age / lookup.length) * 100) / 100);
			},
		};
	}
}

function getRelativeAgeLookupTable(dates: Date[]) {
	const lookup: number[] = [];

	const half = Math.floor(dates.length / 2);
	const median = dates.length % 2 ? dates[half].getTime() : (dates[half - 1].getTime() + dates[half].getTime()) / 2.0;

	const newest = dates.at(-1)!.getTime();
	let step = (newest - median) / 5;
	for (let i = 5; i > 0; i--) {
		lookup.push(median + step * i);
	}

	lookup.push(median);

	const oldest = dates[0].getTime();
	step = (median - oldest) / 4;
	for (let i = 1; i <= 4; i++) {
		lookup.push(median - step * i);
	}

	return lookup;
}
