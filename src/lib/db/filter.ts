// Pure in-memory filtering, sorting and tag helpers for entries.
// Kept side-effect free so the logic is directly unit-testable.
import type { Entry } from '$lib/types';

/** Search / filter conditions applied to the entry list. */
export interface FilterCondition {
	/** Keyword matched (case-insensitive) against name, value and memo. */
	keyword: string;
	/** Entries must contain every selected tag. */
	tags: string[];
	/** Inclusive lower bound of `updatedAt` (yyyy-mm-dd, empty = unbounded). */
	from: string;
	/** Inclusive upper bound of `updatedAt` (yyyy-mm-dd, empty = unbounded). */
	to: string;
}

/**
 * Filters entries by keyword, tags and update-date range.
 * @param entries - Entries to filter (order is preserved).
 * @param cond - Filter conditions.
 * @returns Entries matching every active condition.
 */
export function filterEntries(entries: Entry[], cond: FilterCondition): Entry[] {
	const keyword = cond.keyword.trim().toLowerCase();
	return entries.filter((entry) => {
		if (keyword) {
			const haystack = `${entry.name}\n${entry.value}\n${entry.memo}`.toLowerCase();
			if (!haystack.includes(keyword)) return false;
		}
		if (cond.tags.length > 0 && !cond.tags.every((tag) => entry.tags.includes(tag))) {
			return false;
		}
		const date = entry.updatedAt.slice(0, 10);
		if (cond.from && date < cond.from) return false;
		if (cond.to && date > cond.to) return false;
		return true;
	});
}

/**
 * Sorts entries by `updatedAt`.
 * @param entries - Entries to sort (not mutated).
 * @param direction - 'desc' for newest first, 'asc' for oldest first.
 * @returns A newly sorted array.
 */
export function sortByUpdatedAt(entries: Entry[], direction: 'asc' | 'desc'): Entry[] {
	const sign = direction === 'asc' ? 1 : -1;
	return [...entries].sort((a, b) => sign * a.updatedAt.localeCompare(b.updatedAt));
}

/**
 * Collects the unique set of tags used across all entries.
 * @param entries - Entries to scan.
 * @returns Sorted unique tag list.
 */
export function collectTags(entries: Entry[]): string[] {
	const tags = new Set<string>();
	for (const entry of entries) {
		for (const tag of entry.tags) tags.add(tag);
	}
	return [...tags].sort();
}

/**
 * Parses space-separated tag input into a unique tag list.
 * @param input - Raw user input (full-width spaces are also separators).
 * @returns Unique, order-preserving tag list.
 */
export function parseTags(input: string): string[] {
	return [...new Set(input.split(/[\s　]+/).filter((tag) => tag.length > 0))];
}
