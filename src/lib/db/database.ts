// IndexedDB persistence layer built on `idb`.
// Provides CRUD operations for entries and persistent-storage negotiation.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Entry, EntryInput } from '$lib/types';

const DB_NAME = 'simple-personal-db';
const DB_VERSION = 1;
const STORE = 'entries';

interface PersonalDbSchema extends DBSchema {
	entries: {
		key: string;
		value: Entry;
		indexes: { 'by-updatedAt': string; 'by-tags': string };
	};
}

let dbPromise: Promise<IDBPDatabase<PersonalDbSchema>> | null = null;

/**
 * Opens (and lazily creates) the IndexedDB database.
 * @returns The shared database connection.
 */
function getDb(): Promise<IDBPDatabase<PersonalDbSchema>> {
	dbPromise ??= openDB<PersonalDbSchema>(DB_NAME, DB_VERSION, {
		upgrade(db) {
			const store = db.createObjectStore(STORE, { keyPath: 'id' });
			store.createIndex('by-updatedAt', 'updatedAt');
			store.createIndex('by-tags', 'tags', { multiEntry: true });
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
 * Deletes an entry.
 * @param id - Id of the entry to delete.
 */
export async function deleteEntry(id: string): Promise<void> {
	const db = await getDb();
	await db.delete(STORE, id);
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
