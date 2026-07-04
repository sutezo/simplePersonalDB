// Integration tests for the IndexedDB layer using fake-indexeddb.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createEntry, deleteEntry, listEntries, updateEntry } from './database';

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
