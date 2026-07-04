// Unit tests for CSV serialization/deserialization (escaping, parsing, roundtrip).
import { describe, expect, it } from 'vitest';
import { csvToEntries, entriesToCsv, escapeCsvField, parseCsv } from './csv';
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

describe('parseCsv', () => {
	it('parses quoted fields with commas, escaped quotes and newlines', () => {
		const rows = parseCsv('a,"b,c","say ""hi""","l1\nl2"\r\nd,e,f,g\r\n');
		expect(rows).toEqual([
			['a', 'b,c', 'say "hi"', 'l1\nl2'],
			['d', 'e', 'f', 'g']
		]);
	});

	it('ignores a leading BOM and handles LF-only endings', () => {
		expect(parseCsv('\uFEFFa,b\nc,d')).toEqual([
			['a', 'b'],
			['c', 'd']
		]);
	});
});

describe('csvToEntries', () => {
	it('roundtrips entries through entriesToCsv', () => {
		const restored = csvToEntries(entriesToCsv([sampleEntry]));
		expect(restored).toEqual([sampleEntry]);
	});

	it('rejects an unexpected header', () => {
		expect(() => csvToEntries('foo,bar\r\n1,2\r\n')).toThrow('ヘッダー');
	});

	it('rejects an invalid value type with the line number', () => {
		const csv =
			'id,tags,name,valueType,value,memo,createdAt,updatedAt\r\n' +
			'x,,item,bogus,v,,2026-01-01T00:00:00.000Z,2026-01-01T00:00:00.000Z\r\n';
		expect(() => csvToEntries(csv)).toThrow('2行目');
	});

	it('fills in a missing id', () => {
		const csv =
			'id,tags,name,valueType,value,memo,createdAt,updatedAt\r\n' +
			',,item,text,v,,2026-01-01T00:00:00.000Z,2026-01-01T00:00:00.000Z\r\n';
		const [entry] = csvToEntries(csv);
		expect(entry.id.length).toBeGreaterThan(0);
	});
});
