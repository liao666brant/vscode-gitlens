import type { SearchQuery } from '@gitlens/git/models/search.js';
import type { Source } from '../constants.telemetry.js';
import type { Container } from '../container.js';
import type { NaturalLanguageSearchOptions } from '../community/stubs/pro.js';

/** Converts natural language to a structured search query */
export function processNaturalLanguageToSearchQuery(
	_container: Container,
	search: SearchQuery,
	_source: Source,
	_options?: NaturalLanguageSearchOptions,
): Promise<SearchQuery> {
	return Promise.resolve(search);
}
