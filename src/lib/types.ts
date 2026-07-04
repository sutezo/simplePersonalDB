// Core domain types for simplePersonalDB.
// A single generic record type ("Entry") covers every stored item.

/** Type of the stored value: free text or a calendar date (yyyy-mm-dd). */
export type ValueType = 'text' | 'date';

/** A single database record. */
export interface Entry {
	/** UUID assigned at creation time. */
	id: string;
	/** Category tags: space-free words, multiple allowed. */
	tags: string[];
	/** Item name (free text). */
	name: string;
	/** Type of {@link Entry.value}. */
	valueType: ValueType;
	/** Single-line value (~20 chars). Date values are stored as yyyy-mm-dd. */
	value: string;
	/** Multi-line memo (~100 chars). */
	memo: string;
	/** Creation timestamp (ISO 8601, read-only). */
	createdAt: string;
	/** Last-update timestamp (ISO 8601, read-only). */
	updatedAt: string;
}

/** User-editable fields of an {@link Entry}. */
export type EntryInput = Pick<Entry, 'tags' | 'name' | 'valueType' | 'value' | 'memo'>;

/** A saved SQL query from the SQL console history. */
export interface SqlHistoryEntry {
	/** UUID assigned when the query is recorded. */
	id: string;
	/** The executed SELECT statement. */
	sql: string;
	/** Execution timestamp (ISO 8601). */
	executedAt: string;
}
