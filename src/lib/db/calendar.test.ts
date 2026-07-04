// Unit tests for the pure calendar helpers (date-entry selection + month grid).
import { describe, expect, it } from 'vitest';
import { buildMonthGrid, filterDateEntries } from './calendar';
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

describe('filterDateEntries', () => {
	const entries: Entry[] = [
		makeEntry({ id: 'a', valueType: 'date', value: '2026-07-14', tags: ['home'] }),
		makeEntry({ id: 'b', valueType: 'text', value: '2026-07-14', tags: ['home'] }),
		makeEntry({ id: 'c', valueType: 'date', value: 'not-a-date', tags: ['home'] }),
		makeEntry({ id: 'd', valueType: 'date', value: '2026-08-01', tags: ['home', 'work'] })
	];

	it('keeps only date-typed entries with a valid yyyy-mm-dd value', () => {
		const result = filterDateEntries(entries, []);
		expect(result.map((e) => e.id)).toEqual(['a', 'd']);
	});

	it('applies the tag filter (AND)', () => {
		const result = filterDateEntries(entries, ['home', 'work']);
		expect(result.map((e) => e.id)).toEqual(['d']);
	});
});

describe('buildMonthGrid', () => {
	it('spans the first Sunday through the last Saturday in whole weeks', () => {
		// July 2026: 1st is a Wednesday, 31st is a Friday.
		const cells = buildMonthGrid(2026, 6, []);
		expect(cells.length % 7).toBe(0);
		expect(cells[0].date).toBe('2026-06-28'); // Sunday before the 1st
		expect(cells[cells.length - 1].date).toBe('2026-08-01'); // Saturday after the 31st
	});

	it('flags days outside the target month', () => {
		const cells = buildMonthGrid(2026, 6, []);
		const first = cells.find((c) => c.date === '2026-07-01');
		const lead = cells.find((c) => c.date === '2026-06-30');
		expect(first?.inCurrentMonth).toBe(true);
		expect(lead?.inCurrentMonth).toBe(false);
	});

	it('assigns entries to the cell matching their date value', () => {
		const entries: Entry[] = [
			makeEntry({ id: 'a', valueType: 'date', value: '2026-07-14' }),
			makeEntry({ id: 'b', valueType: 'date', value: '2026-07-14' })
		];
		const cells = buildMonthGrid(2026, 6, entries);
		const target = cells.find((c) => c.date === '2026-07-14');
		expect(target?.entries.map((e) => e.id)).toEqual(['a', 'b']);
		const empty = cells.find((c) => c.date === '2026-07-15');
		expect(empty?.entries).toEqual([]);
	});

	it('handles February of a leap year', () => {
		// Feb 2028 is a leap year: 29 days, 1st is a Tuesday.
		const cells = buildMonthGrid(2028, 1, []);
		expect(cells.some((c) => c.date === '2028-02-29' && c.inCurrentMonth)).toBe(true);
		expect(cells.some((c) => c.date === '2028-02-30')).toBe(false);
	});
});
