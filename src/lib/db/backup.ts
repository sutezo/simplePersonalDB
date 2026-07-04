// Backup reminder policy: decides when to prompt the user to export a CSV
// backup, since iOS may evict IndexedDB data under storage pressure.
import type { Entry } from '$lib/types';

/** Days after the last backup before a reminder may appear. */
export const BACKUP_INTERVAL_DAYS = 7;

/** Days a dismissed reminder stays hidden. */
export const BACKUP_SNOOZE_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Inputs for {@link needsBackupReminder}. */
export interface BackupReminderState {
	/** Current entries (no reminder when empty). */
	entries: Entry[];
	/** ISO timestamp of the last completed backup, or null if never. */
	lastBackupAt: string | null;
	/** ISO timestamp until which the reminder is snoozed, or null. */
	snoozedUntil: string | null;
	/** Current time (injectable for tests). */
	now?: Date;
}

/**
 * Decides whether the backup reminder should be shown.
 * Shown when data exists and either no backup was ever made, or the last
 * backup is older than {@link BACKUP_INTERVAL_DAYS} days and entries changed
 * since then. A snooze hides the reminder until it expires.
 * @param state - Current entries and backup metadata.
 * @returns True when the reminder should be displayed.
 */
export function needsBackupReminder(state: BackupReminderState): boolean {
	const { entries, lastBackupAt, snoozedUntil } = state;
	const now = state.now ?? new Date();
	if (entries.length === 0) {
		return false;
	}
	if (snoozedUntil && now.getTime() < Date.parse(snoozedUntil)) {
		return false;
	}
	if (!lastBackupAt) {
		return true;
	}
	if (now.getTime() - Date.parse(lastBackupAt) < BACKUP_INTERVAL_DAYS * DAY_MS) {
		return false;
	}
	return entries.some((entry) => entry.updatedAt > lastBackupAt);
}

/**
 * Computes the ISO timestamp until which a dismissed reminder stays hidden.
 * @param now - Current time (injectable for tests).
 * @returns ISO timestamp {@link BACKUP_SNOOZE_DAYS} days from now.
 */
export function snoozeUntil(now: Date = new Date()): string {
	return new Date(now.getTime() + BACKUP_SNOOZE_DAYS * DAY_MS).toISOString();
}
