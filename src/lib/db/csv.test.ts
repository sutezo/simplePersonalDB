// Unit tests for CSV serialization (field escaping and full document shape).
import { describe, expect, it } from 'vitest';
import { entriesToCsv, escapeCsvField } from './csv';
import type { Entry } from '$lib/types';

const sampleEntry: Entry = {
	id: 'id-1',
	tags: ['home', 'warranty'],
	name: 'fridge',
	valueType: 'date',
	value: '2027-01-31',
	memo: 'line1\nline2',
	createdAt: '2026-07-01T00:00:00.000Z',
	updatedAt: '2026-07-02T00:00:00.000Z'
};

describe('escapeCsvField', () => {
	it('returns plain fields unchanged', () => {
		expect(escapeCsvField('abc')).toBe('abc');
	});

	it('quotes fields containing commas, quotes and newlines', () => {
		expect(escapeCsvField('a,b')).toBe('"a,b"');
		expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
		expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
	});
});

describe('entriesToCsv', () => {
	it('emits a header row and one row per entry with CRLF endings', () => {
		const csv = entriesToCsv([sampleEntry]);
		const lines = csv.split('\r\n');
		expect(lines[0]).toBe('id,tags,name,valueType,value,memo,createdAt,updatedAt');
		expect(lines[1]).toContain('home warranty');
		expect(lines[1]).toContain('"line1\nline2"');
		expect(csv.endsWith('\r\n')).toBe(true);
	});

	it('produces only the header for an empty list', () => {
		expect(entriesToCsv([])).toBe(
			'id,tags,name,valueType,value,memo,createdAt,updatedAt\r\n'
		);
	});
});
