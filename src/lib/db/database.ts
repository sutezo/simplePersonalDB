// IndexedDB persistence layer built on `idb`.
// Provides CRUD operations for entries and persistent-storage negotiation.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Entry, EntryInput, SqlHistoryEntry } from '$lib/types';

const DB_NAME = 'simple-personal-db';
const DB_VERSION = 3;
const STORE = 'entries';
const HISTORY_STORE = 'sqlHistory';
const META_STORE = 'meta';

/** Maximum number of SQL history entries kept; older ones are pruned. */
export const SQL_HISTORY_LIMIT = 50;

/** Keys of the small key-value `meta` store. */
export type MetaKey = 'lastBackupAt' | 'backupSnoozedUntil';

interface PersonalDbSchema extends DBSchema {
	entries: {
		key: string;
		value: Entry;
		indexes: { 'by-updatedAt': string; 'by-tags': string };
	};
	sqlHistory: {
		key: string;
		value: SqlHistoryEntry;
		indexes: { 'by-executedAt': string };
	};
	meta: {
		key: string;
		value: { key: MetaKey; value: string };
	};
}

let dbPromise: Promise<IDBPDatabase<PersonalDbSchema>> | null = null;

/**
 * Opens (and lazily creates) the IndexedDB database.
 * @returns The shared database connection.
 */
function getDb(): Promise<IDBPDatabase<PersonalDbSchema>> {
	dbPromise ??= openDB<PersonalDbSchema>(DB_NAME, DB_VERSION, {
		upgrade(db, oldVersion) {
			if (oldVersion < 1) {
				const store = db.createObjectStore(STORE, { keyPath: 'id' });
				store.createIndex('by-updatedAt', 'updatedAt');
				store.createIndex('by-tags', 'tags', { multiEntry: true });
			}
			if (oldVersion < 2) {
				const history = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
				history.createIndex('by-executedAt', 'executedAt');
			}
			if (oldVersion < 3) {
				db.createObjectStore(META_STORE, { keyPath: 'key' });
			}
		}
	});
	return dbPromise;
}

/**
 * Lists all entries sorted by last-update time, newest first.
 * @returns All stored entries.
 */
export async function listEntries(): Promise<Entry[]> {
	const db = await getDb();
	const entries = await db.getAllFromIndex(STORE, 'by-updatedAt');
	return entries.reverse();
}

/**
 * Creates a new entry with generated id and timestamps.
 * @param input - User-provided fields.
 * @returns The stored entry.
 */
export async function createEntry(input: EntryInput): Promise<Entry> {
	const now = new Date().toISOString();
	const entry: Entry = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
	const db = await getDb();
	await db.add(STORE, entry);
	return entry;
}

/**
 * Updates an existing entry and refreshes its `updatedAt` timestamp.
 * @param id - Id of the entry to update.
 * @param input - New user-provided field values.
 * @returns The updated entry.
 * @throws If no entry with the given id exists.
 */
export async function updateEntry(id: string, input: EntryInput): Promise<Entry> {
	const db = await getDb();
	const existing = await db.get(STORE, id);
	if (!existing) {
		throw new Error(`Entry not found: ${id}`);
	}
	const updated: Entry = { ...existing, ...input, updatedAt: new Date().toISOString() };
	await db.put(STORE, updated);
	return updated;
}

/**
 * Imports entries in one transaction, overwriting existing ids (upsert).
 * Timestamps in the imported data are kept as-is (restore semantics).
 * @param entries - Entries to import.
 * @returns Number of imported entries.
 */
export async function importEntries(entries: Entry[]): Promise<number> {
	const db = await getDb();
	const tx = db.transaction(STORE, 'readwrite');
	for (const entry of entries) {
		await tx.store.put(entry);
	}
	await tx.done;
	return entries.length;
}

/**
 * Deletes an entry.
 * @param id - Id of the entry to delete.
 */
export async function deleteEntry(id: string): Promise<void> {
	const db = await getDb();
	await db.delete(STORE, id);
}

/**
 * Records an executed SQL query in the history.
 * An identical previous query is moved to the top instead of duplicated,
 * and entries beyond {@link SQL_HISTORY_LIMIT} are pruned (oldest first).
 * @param sql - The executed SELECT statement.
 * @returns The stored history entry.
 */
export async function addSqlHistory(sql: string): Promise<SqlHistoryEntry> {
	const db = await getDb();
	const tx = db.transaction(HISTORY_STORE, 'readwrite');
	for (const item of await tx.store.getAll()) {
		if (item.sql === sql) {
			await tx.store.delete(item.id);
		}
	}
	const entry: SqlHistoryEntry = {
		id: crypto.randomUUID(),
		sql,
		executedAt: new Date().toISOString()
	};
	await tx.store.add(entry);
	// Keys from the index are ordered by executedAt ascending (oldest first).
	const keys = await tx.store.index('by-executedAt').getAllKeys();
	for (const key of keys.slice(0, Math.max(0, keys.length - SQL_HISTORY_LIMIT))) {
		await tx.store.delete(key);
	}
	await tx.done;
	return entry;
}

/**
 * Lists the SQL history, most recent first.
 * @returns All stored history entries.
 */
export async function listSqlHistory(): Promise<SqlHistoryEntry[]> {
	const db = await getDb();
	const items = await db.getAllFromIndex(HISTORY_STORE, 'by-executedAt');
	return items.reverse();
}

/**
 * Deletes one SQL history entry.
 * @param id - Id of the history entry to delete.
 */
export async function deleteSqlHistory(id: string): Promise<void> {
	const db = await getDb();
	await db.delete(HISTORY_STORE, id);
}

/**
 * Reads a value from the key-value meta store.
 * @param key - Meta key to read.
 * @returns The stored value, or null when unset.
 */
export async function getMeta(key: MetaKey): Promise<string | null> {
	const db = await getDb();
	const record = await db.get(META_STORE, key);
	return record?.value ?? null;
}

/**
 * Writes a value to the key-value meta store.
 * @param key - Meta key to write.
 * @param value - Value to store.
 */
export async function setMeta(key: MetaKey, value: string): Promise<void> {
	const db = await getDb();
	await db.put(META_STORE, { key, value });
}

/**
 * Requests persistent storage so iOS is less likely to evict the database.
 * @returns True when the storage is (already or newly) persistent.
 */
export async function requestPersistentStorage(): Promise<boolean> {
	if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
		return false;
	}
	try {
		return await navigator.storage.persist();
	} catch {
		return false;
	}
}
