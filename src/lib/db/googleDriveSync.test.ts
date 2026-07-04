import { describe, expect, it } from 'vitest';
import type { Entry } from '$lib/types';
import { mergeSnapshots, type DriveSnapshot } from './googleDriveSync';

function entry(id: string, updatedAt: string, name = id): Entry {
	return {
		id,
		tags: ['tag'],
		name,
		valueType: 'text',
		value: '',
		memo: '',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt
	};
}

function snapshot(entries: Entry[], deletedEntries: Record<string, string> = {}): DriveSnapshot {
	return {
		version: 1,
		updatedAt: '2026-07-05T00:00:00.000Z',
		entries,
		deletedEntries
	};
}

describe('Google Drive snapshot merge', () => {
	it('keeps the newest entry for the same id', () => {
		const merged = mergeSnapshots(
			snapshot([entry('same', '2026-07-05T00:00:00.000Z', 'local')]),
			snapshot([entry('same', '2026-07-04T00:00:00.000Z', 'remote')])
		);

		expect(merged.entries).toHaveLength(1);
		expect(merged.entries[0].name).toBe('local');
	});

	it('merges entries that exist only on one side', () => {
		const merged = mergeSnapshots(
			snapshot([entry('local', '2026-07-05T00:00:00.000Z')]),
			snapshot([entry('remote', '2026-07-04T00:00:00.000Z')])
		);

		expect(merged.entries.map((item) => item.id).sort()).toEqual(['local', 'remote']);
	});

	it('keeps a deletion when the tombstone is newer than the entry', () => {
		const merged = mergeSnapshots(
			snapshot([entry('deleted', '2026-07-04T00:00:00.000Z')]),
			snapshot([], { deleted: '2026-07-05T00:00:00.000Z' })
		);

		expect(merged.entries).toHaveLength(0);
		expect(merged.deletedEntries.deleted).toBe('2026-07-05T00:00:00.000Z');
	});

	it('restores an entry when the entry is newer than the tombstone', () => {
		const merged = mergeSnapshots(
			snapshot([entry('restored', '2026-07-06T00:00:00.000Z')]),
			snapshot([], { restored: '2026-07-05T00:00:00.000Z' })
		);

		expect(merged.entries.map((item) => item.id)).toEqual(['restored']);
		expect(merged.deletedEntries.restored).toBeUndefined();
	});
});
