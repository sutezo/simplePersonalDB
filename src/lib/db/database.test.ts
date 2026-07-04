// Integration tests for the IndexedDB layer using fake-indexeddb.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
	SQL_HISTORY_LIMIT,
	addSqlHistory,
	createEntry,
	deleteEntry,
	deleteSqlHistory,
	getMeta,
	importEntries,
	listEntries,
	listSqlHistory,
	setMeta,
	updateEntry
} from './database';

describe('database CRUD', () => {
	it('creates, updates, lists and deletes entries', async () => {
		const created = await createEntry({
			tags: ['home'],
			name: 'fridge',
			valueType: 'text',
			value: 'RX-100',
			memo: ''
		});
		expect(created.id).toBeTruthy();
		expect(created.createdAt).toBe(created.updatedAt);

		const updated = await updateEntry(created.id, {
			tags: ['home', 'warranty'],
			name: 'fridge',
			valueType: 'date',
			value: '2027-01-31',
			memo: 'extended'
		});
		expect(updated.createdAt).toBe(created.createdAt);
		expect(updated.updatedAt >= created.updatedAt).toBe(true);
		expect(updated.tags).toEqual(['home', 'warranty']);

		const listed = await listEntries();
		expect(listed.map((e) => e.id)).toContain(created.id);

		await deleteEntry(created.id);
		const afterDelete = await listEntries();
		expect(afterDelete.map((e) => e.id)).not.toContain(created.id);
	});

	it('rejects updates to unknown ids', async () => {
		await expect(
			updateEntry('missing-id', {
				tags: [],
				name: 'x',
				valueType: 'text',
				value: '',
				memo: ''
			})
		).rejects.toThrow('Entry not found');
	});

	it('records SQL history newest-first and deletes entries', async () => {
		const first = await addSqlHistory('SELECT 1');
		await new Promise((resolve) => setTimeout(resolve, 5));
		const second = await addSqlHistory('SELECT 2');

		const listed = await listSqlHistory();
		expect(listed.map((h) => h.sql)).toEqual(['SELECT 2', 'SELECT 1']);
		expect(first.executedAt <= second.executedAt).toBe(true);

		await deleteSqlHistory(second.id);
		expect((await listSqlHistory()).map((h) => h.sql)).toEqual(['SELECT 1']);
		await deleteSqlHistory(first.id);
	});

	it('moves a re-executed identical query to the top instead of duplicating', async () => {
		await addSqlHistory('SELECT a');
		await new Promise((resolve) => setTimeout(resolve, 5));
		await addSqlHistory('SELECT b');
		await new Promise((resolve) => setTimeout(resolve, 5));
		await addSqlHistory('SELECT a');

		const listed = await listSqlHistory();
		expect(listed.map((h) => h.sql)).toEqual(['SELECT a', 'SELECT b']);
		for (const item of listed) await deleteSqlHistory(item.id);
	});

	it('prunes the oldest history entries beyond the limit', async () => {
		for (let i = 0; i < SQL_HISTORY_LIMIT + 3; i++) {
			await addSqlHistory(`SELECT ${i}`);
		}
		const listed = await listSqlHistory();
		expect(listed.length).toBe(SQL_HISTORY_LIMIT);
		expect(listed.some((h) => h.sql === `SELECT ${SQL_HISTORY_LIMIT + 2}`)).toBe(true);
		for (const item of listed) await deleteSqlHistory(item.id);
	});

	it('stores and reads meta values', async () => {
		expect(await getMeta('lastBackupAt')).toBeNull();
		await setMeta('lastBackupAt', '2026-07-04T00:00:00.000Z');
		expect(await getMeta('lastBackupAt')).toBe('2026-07-04T00:00:00.000Z');
		await setMeta('lastBackupAt', '2026-07-05T00:00:00.000Z');
		expect(await getMeta('lastBackupAt')).toBe('2026-07-05T00:00:00.000Z');
	});

	it('imports entries with upsert semantics keeping timestamps', async () => {
		const existing = await createEntry({
			tags: [],
			name: 'before',
			valueType: 'text',
			value: '',
			memo: ''
		});
		const count = await importEntries([
			{
				...existing,
				name: 'after',
				updatedAt: '2026-01-01T00:00:00.000Z'
			},
			{
				id: 'imported-new',
				tags: ['restored'],
				name: 'new entry',
				valueType: 'text',
				value: 'v',
				memo: '',
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z'
			}
		]);
		expect(count).toBe(2);

		const listed = await listEntries();
		const overwritten = listed.find((e) => e.id === existing.id);
		expect(overwritten?.name).toBe('after');
		expect(overwritten?.updatedAt).toBe('2026-01-01T00:00:00.000Z');
		expect(listed.some((e) => e.id === 'imported-new')).toBe(true);

		await deleteEntry(existing.id);
		await deleteEntry('imported-new');
	});

	it('lists entries newest-first by updatedAt', async () => {
		const first = await createEntry({ tags: [], name: 'older', valueType: 'text', value: '', memo: '' });
		await new Promise((resolve) => setTimeout(resolve, 5));
		const second = await createEntry({ tags: [], name: 'newer', valueType: 'text', value: '', memo: '' });
		const listed = await listEntries();
		expect(listed.findIndex((e) => e.id === second.id)).toBeLessThan(
			listed.findIndex((e) => e.id === first.id)
		);
	});
});
