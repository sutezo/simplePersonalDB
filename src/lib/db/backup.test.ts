// Unit tests for the backup reminder policy.
import { describe, expect, it } from 'vitest';
import {
	BACKUP_INTERVAL_DAYS,
	BACKUP_SNOOZE_DAYS,
	needsBackupReminder,
	snoozeUntil
} from './backup';
import type { Entry } from '$lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date('2026-07-04T12:00:00.000Z');

/**
 * Builds a minimal entry updated at the given time.
 * @param updatedAt - ISO update timestamp.
 * @returns A complete entry.
 */
function entryUpdatedAt(updatedAt: string): Entry {
	return {
		id: 'id',
		tags: [],
		name: 'x',
		valueType: 'text',
		value: '',
		memo: '',
		createdAt: updatedAt,
		updatedAt
	};
}

/**
 * Returns an ISO timestamp `days` days before `now`.
 * @param days - Number of days to subtract.
 * @returns ISO timestamp.
 */
function daysAgo(days: number): string {
	return new Date(now.getTime() - days * DAY_MS).toISOString();
}

describe('needsBackupReminder', () => {
	it('is hidden when there are no entries', () => {
		expect(
			needsBackupReminder({ entries: [], lastBackupAt: null, snoozedUntil: null, now })
		).toBe(false);
	});

	it('is shown when data exists but no backup was ever made', () => {
		expect(
			needsBackupReminder({
				entries: [entryUpdatedAt(daysAgo(1))],
				lastBackupAt: null,
				snoozedUntil: null,
				now
			})
		).toBe(true);
	});

	it('is hidden while snoozed and shown after the snooze expires', () => {
		const entries = [entryUpdatedAt(daysAgo(1))];
		expect(
			needsBackupReminder({
				entries,
				lastBackupAt: null,
				snoozedUntil: daysAgo(-1), // tomorrow
				now
			})
		).toBe(false);
		expect(
			needsBackupReminder({
				entries,
				lastBackupAt: null,
				snoozedUntil: daysAgo(1), // expired yesterday
				now
			})
		).toBe(true);
	});

	it('is hidden when the last backup is recent', () => {
		expect(
			needsBackupReminder({
				entries: [entryUpdatedAt(daysAgo(1))],
				lastBackupAt: daysAgo(BACKUP_INTERVAL_DAYS - 1),
				snoozedUntil: null,
				now
			})
		).toBe(false);
	});

	it('is shown when the backup is old and entries changed since', () => {
		expect(
			needsBackupReminder({
				entries: [entryUpdatedAt(daysAgo(1))],
				lastBackupAt: daysAgo(BACKUP_INTERVAL_DAYS + 1),
				snoozedUntil: null,
				now
			})
		).toBe(true);
	});

	it('is hidden when the backup is old but nothing changed since', () => {
		expect(
			needsBackupReminder({
				entries: [entryUpdatedAt(daysAgo(BACKUP_INTERVAL_DAYS + 5))],
				lastBackupAt: daysAgo(BACKUP_INTERVAL_DAYS + 1),
				snoozedUntil: null,
				now
			})
		).toBe(false);
	});
});

describe('snoozeUntil', () => {
	it('returns a timestamp the configured number of days ahead', () => {
		expect(snoozeUntil(now)).toBe(
			new Date(now.getTime() + BACKUP_SNOOZE_DAYS * DAY_MS).toISOString()
		);
	});
});
