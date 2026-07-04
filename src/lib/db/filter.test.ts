// Unit tests for the pure filtering, sorting and tag helper functions.
import { describe, expect, it } from 'vitest';
import { collectTags, filterEntries, parseTags, sortByUpdatedAt } from './filter';
import type { Entry } from '$lib/types';

/**
 * Builds a test entry with overridable fields.
 * @param overrides - Fields to override.
 * @returns A complete entry.
 */
function makeEntry(overrides: Partial<Entry>): Entry {
	return {
		id: 'id',
		tags: [],
		name: '',
		valueType: 'text',
		value: '',
		memo: '',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides
	};
}

const entries: Entry[] = [
	makeEntry({ id: 'a', name: 'fridge warranty', tags: ['home'], updatedAt: '2026-03-01T00:00:00.000Z' }),
	makeEntry({ id: 'b', value: 'ABC-123', tags: ['home', 'gadget'], updatedAt: '2026-05-01T00:00:00.000Z' }),
	makeEntry({ id: 'c', memo: 'serial fridge', tags: ['work'], updatedAt: '2026-07-01T00:00:00.000Z' })
];

describe('filterEntries', () => {
	it('matches keyword across name, value and memo case-insensitively', () => {
		const byName = filterEntries(entries, { keyword: 'FRIDGE', tags: [], from: '', to: '' });
		expect(byName.map((e) => e.id)).toEqual(['a', 'c']);
		const byValue = filterEntries(entries, { keyword: 'abc-123', tags: [], from: '', to: '' });
		expect(byValue.map((e) => e.id)).toEqual(['b']);
	});

	it('requires every selected tag (AND)', () => {
		const result = filterEntries(entries, { keyword: '', tags: ['home', 'gadget'], from: '', to: '' });
		expect(result.map((e) => e.id)).toEqual(['b']);
	});

	it('applies the inclusive updatedAt date range', () => {
		const result = filterEntries(entries, { keyword: '', tags: [], from: '2026-03-01', to: '2026-05-01' });
		expect(result.map((e) => e.id)).toEqual(['a', 'b']);
	});
});

describe('sortByUpdatedAt', () => {
	it('sorts descending and ascending without mutating the input', () => {
		const desc = sortByUpdatedAt(entries, 'desc');
		expect(desc.map((e) => e.id)).toEqual(['c', 'b', 'a']);
		const asc = sortByUpdatedAt(entries, 'asc');
		expect(asc.map((e) => e.id)).toEqual(['a', 'b', 'c']);
		expect(entries.map((e) => e.id)).toEqual(['a', 'b', 'c']);
	});
});

describe('collectTags', () => {
	it('returns the sorted unique tag set', () => {
		expect(collectTags(entries)).toEqual(['gadget', 'home', 'work']);
	});
});

describe('parseTags', () => {
	it('splits on half- and full-width spaces and deduplicates', () => {
		expect(parseTags('  home　gadget home ')).toEqual(['home', 'gadget']);
		expect(parseTags('')).toEqual([]);
	});
});
