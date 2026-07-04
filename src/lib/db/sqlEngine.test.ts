// Unit tests for the SELECT-only SQL engine (validation, execution, builder).
import { describe, expect, it, beforeAll } from 'vitest';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import {
	buildDatabase,
	buildSelectSql,
	executeSelect,
	validateSelectOnly
} from './sqlEngine';
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
	makeEntry({ id: 'a', name: 'fridge', tags: ['home'], value: '1' }),
	makeEntry({ id: 'b', name: 'tv', tags: ['home', 'gadget'], value: '2' }),
	makeEntry({ id: 'c', name: 'laptop', tags: ['work'], value: '3' })
];

let SQL: SqlJsStatic;

beforeAll(async () => {
	SQL = await initSqlJs();
});

describe('validateSelectOnly', () => {
	it('accepts a single SELECT statement (with optional trailing semicolon)', () => {
		expect(validateSelectOnly('SELECT * FROM entries')).toBeNull();
		expect(validateSelectOnly('  select name from entries;  ')).toBeNull();
	});

	it('rejects empty input, non-SELECT and multi-statement SQL', () => {
		expect(validateSelectOnly('')).not.toBeNull();
		expect(validateSelectOnly('DELETE FROM entries')).not.toBeNull();
		expect(validateSelectOnly('SELECT 1; DROP TABLE entries')).not.toBeNull();
	});
});

describe('buildDatabase / executeSelect', () => {
	it('loads entries and answers SELECT queries', () => {
		const db = buildDatabase(SQL, entries);
		try {
			const result = executeSelect(db, "SELECT name FROM entries WHERE tags LIKE '%home%' ORDER BY name");
			expect(result.columns).toEqual(['name']);
			expect(result.rows).toEqual([['fridge'], ['tv']]);
		} finally {
			db.close();
		}
	});

	it('supports GROUP BY with aggregates', () => {
		const db = buildDatabase(SQL, entries);
		try {
			const result = executeSelect(
				db,
				'SELECT valueType, COUNT(*) AS count FROM entries GROUP BY valueType'
			);
			expect(result.rows).toEqual([['text', 3]]);
		} finally {
			db.close();
		}
	});

	it('returns empty columns/rows when nothing matches', () => {
		const db = buildDatabase(SQL, entries);
		try {
			const result = executeSelect(db, "SELECT * FROM entries WHERE name = 'nope'");
			expect(result.rows).toEqual([]);
		} finally {
			db.close();
		}
	});

	it('throws on invalid SQL', () => {
		const db = buildDatabase(SQL, entries);
		try {
			expect(() => executeSelect(db, 'SELECT nosuchcol FROM entries')).toThrow();
		} finally {
			db.close();
		}
	});
});

describe('buildSelectSql', () => {
	it('builds a plain SELECT with chosen columns', () => {
		expect(buildSelectSql(['name', 'value'], '')).toBe(
			'SELECT name, value\nFROM entries\nORDER BY updatedAt DESC'
		);
	});

	it('selects all columns when none are chosen', () => {
		expect(buildSelectSql([], '')).toBe('SELECT *\nFROM entries\nORDER BY updatedAt DESC');
	});

	it('adds COUNT(*) and the group column for GROUP BY', () => {
		const sql = buildSelectSql(['name'], 'valueType');
		expect(sql).toContain('GROUP BY valueType');
		expect(sql).toContain('COUNT(*) AS count');
		expect(sql).toContain('valueType, name');
	});
});
