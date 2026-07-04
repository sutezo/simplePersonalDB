// Pure calendar helpers: selects date-typed entries and lays them out on a
// month grid. Side-effect free and timezone-safe (string-based dates) so the
// logic is directly unit-testable in Node.
import type { Entry } from '$lib/types';
import { filterEntries } from '$lib/db/filter';

/** A single day cell of the month grid. */
export interface CalendarCell {
	/** Cell date in yyyy-mm-dd. */
	date: string;
	/** Day of month (1-31). */
	day: number;
	/** True when the cell belongs to the grid's target month. */
	inCurrentMonth: boolean;
	/** Date-typed entries whose value falls on this date. */
	entries: Entry[];
}

/** Matches a strict yyyy-mm-dd date string. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Selects date-typed entries, filtered by tags (AND).
 * Reuses {@link filterEntries} for tag matching, then keeps only entries whose
 * type is `date` and whose value is a valid yyyy-mm-dd string.
 * @param entries - All entries.
 * @param tags - Tags that entries must all contain (empty = no tag filter).
 * @returns Date-typed entries matching the tag filter.
 */
export function filterDateEntries(entries: Entry[], tags: string[]): Entry[] {
	return filterEntries(entries, { keyword: '', tags, from: '', to: '' }).filter(
		(entry) => entry.valueType === 'date' && DATE_PATTERN.test(entry.value)
	);
}

/**
 * Formats a year/month/day triple as a yyyy-mm-dd string.
 * @param year - Full year.
 * @param month - Month index (0-11).
 * @param day - Day of month (1-31).
 * @returns yyyy-mm-dd date string.
 */
function toDateString(year: number, month: number, day: number): string {
	const mm = String(month + 1).padStart(2, '0');
	const dd = String(day).padStart(2, '0');
	return `${year}-${mm}-${dd}`;
}

/**
 * Builds a Sunday-started month grid, padded to whole weeks, with the given
 * date entries grouped onto their matching day cells.
 * @param year - Target year.
 * @param month - Target month index (0-11).
 * @param dateEntries - Pre-filtered date-typed entries (see {@link filterDateEntries}).
 * @returns Ordered day cells covering the first Sunday through the last Saturday.
 */
export function buildMonthGrid(
	year: number,
	month: number,
	dateEntries: Entry[]
): CalendarCell[] {
	// Group entries by their date value for O(1) lookup per cell.
	const byDate = new Map<string, Entry[]>();
	for (const entry of dateEntries) {
		const list = byDate.get(entry.value);
		if (list) list.push(entry);
		else byDate.set(entry.value, [entry]);
	}

	const firstOfMonth = new Date(year, month, 1);
	const lastOfMonth = new Date(year, month + 1, 0);
	// Days to prepend so the grid starts on Sunday.
	const leadingDays = firstOfMonth.getDay();
	// Days to append so the grid ends on Saturday.
	const trailingDays = 6 - lastOfMonth.getDay();
	const totalDays = leadingDays + lastOfMonth.getDate() + trailingDays;

	const cells: CalendarCell[] = [];
	for (let offset = 0; offset < totalDays; offset++) {
		// Start `leadingDays` before the 1st; Date normalizes month overflow.
		const date = new Date(year, month, 1 - leadingDays + offset);
		const iso = toDateString(date.getFullYear(), date.getMonth(), date.getDate());
		cells.push({
			date: iso,
			day: date.getDate(),
			inCurrentMonth: date.getMonth() === month,
			entries: byDate.get(iso) ?? []
		});
	}
	return cells;
}
