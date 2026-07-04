// SELECT-only SQL execution over entries using sql.js (SQLite compiled to wasm).
// Entries are copied into an in-memory database each run; nothing is persisted.
import type { Database, SqlJsStatic } from 'sql.js';
import type { Entry } from '$lib/types';

/** Columns of the virtual `entries` table exposed to SQL. */
export const ENTRY_COLUMNS = [
	'id',
	'tags',
	'name',
	'valueType',
	'value',
	'memo',
	'createdAt',
	'updatedAt'
] as const;

/** Result of a successful SELECT execution. */
export interface QueryResult {
	columns: string[];
	rows: unknown[][];
}

/**
 * Validates that the given SQL is a single SELECT statement.
 * @param sql - Raw SQL text.
 * @returns An error message in Japanese, or null when the SQL is acceptable.
 */
export function validateSelectOnly(sql: string): string | null {
	const trimmed = sql.trim().replace(/;\s*$/, '');
	if (trimmed.length === 0) {
		return 'SQLを入力してください';
	}
	if (trimmed.includes(';')) {
		return '実行できるのは1つのステートメントのみです';
	}
	if (!/^select\s/i.test(trimmed)) {
		return 'SELECT文のみ実行できます';
	}
	return null;
}

/**
 * Builds an in-memory SQLite database containing all entries.
 * Tags are stored space-joined so they can be matched with LIKE.
 * @param SQL - Initialized sql.js module.
 * @param entries - Entries to load.
 * @returns A ready-to-query database (caller must `close()` it).
 */
export function buildDatabase(SQL: SqlJsStatic, entries: Entry[]): Database {
	const db = new SQL.Database();
	db.run(
		`CREATE TABLE entries (
			id TEXT PRIMARY KEY,
			tags TEXT,
			name TEXT,
			valueType TEXT,
			value TEXT,
			memo TEXT,
			createdAt TEXT,
			updatedAt TEXT
		)`
	);
	const stmt = db.prepare('INSERT INTO entries VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
	try {
		for (const entry of entries) {
			stmt.run([
				entry.id,
				entry.tags.join(' '),
				entry.name,
				entry.valueType,
				entry.value,
				entry.memo,
				entry.createdAt,
				entry.updatedAt
			]);
		}
	} finally {
		stmt.free();
	}
	return db;
}

/**
 * Executes a validated SELECT statement.
 * @param db - Database built by {@link buildDatabase}.
 * @param sql - SELECT statement (validate with {@link validateSelectOnly} first).
 * @returns Result columns and rows (empty columns when no row matched).
 * @throws Error with the SQLite message when the SQL is invalid.
 */
export function executeSelect(db: Database, sql: string): QueryResult {
	const results = db.exec(sql);
	if (results.length === 0) {
		return { columns: [], rows: [] };
	}
	const [first] = results;
	return { columns: first.columns, rows: first.values };
}

/**
 * Builds a SELECT statement from chosen columns and an optional GROUP BY column.
 * @param columns - Columns to select (empty = all columns).
 * @param groupBy - Column to group by, or empty string for none.
 * @returns The generated SQL text.
 */
export function buildSelectSql(columns: string[], groupBy: string): string {
	if (groupBy) {
		const selected = columns.includes(groupBy) ? columns : [groupBy, ...columns];
		return `SELECT ${selected.join(', ')}, COUNT(*) AS count\nFROM entries\nGROUP BY ${groupBy}\nORDER BY count DESC`;
	}
	const selected = columns.length > 0 ? columns.join(', ') : '*';
	return `SELECT ${selected}\nFROM entries\nORDER BY updatedAt DESC`;
}
