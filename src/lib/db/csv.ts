// CSV export: pure serialization of entries plus a browser-side
// download/share helper (Web Share API with Blob-download fallback).
import type { Entry } from '$lib/types';

/** Column order of the exported CSV. */
export const CSV_COLUMNS = [
	'id',
	'tags',
	'name',
	'valueType',
	'value',
	'memo',
	'createdAt',
	'updatedAt'
] as const;

/**
 * Escapes a single CSV field (RFC 4180 style).
 * @param field - Raw field value.
 * @returns The escaped field, quoted when necessary.
 */
export function escapeCsvField(field: string): string {
	if (/[",\r\n]/.test(field)) {
		return `"${field.replace(/"/g, '""')}"`;
	}
	return field;
}

/**
 * Serializes entries into a CSV string (CRLF line endings, header row included).
 * @param entries - Entries to export.
 * @returns CSV text; tags are joined with a single space.
 */
export function entriesToCsv(entries: Entry[]): string {
	const header = CSV_COLUMNS.join(',');
	const lines = entries.map((entry) =>
		CSV_COLUMNS.map((column) => {
			const raw = column === 'tags' ? entry.tags.join(' ') : entry[column];
			return escapeCsvField(raw);
		}).join(',')
	);
	return [header, ...lines].join('\r\n') + '\r\n';
}

/**
 * Exports entries as a CSV file via the iOS share sheet when available,
 * otherwise triggers a plain Blob download.
 * @param entries - Entries to export.
 */
export async function exportCsv(entries: Entry[]): Promise<void> {
	const stamp = new Date().toISOString().slice(0, 10);
	const fileName = `personal-db-${stamp}.csv`;
	// UTF-8 BOM so spreadsheet apps detect the encoding correctly.
	const blob = new Blob(['\uFEFF' + entriesToCsv(entries)], { type: 'text/csv' });
	const file = new File([blob], fileName, { type: 'text/csv' });

	if (navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({ files: [file], title: fileName });
			return;
		} catch (error) {
			// AbortError means the user cancelled the share sheet; do nothing.
			if (error instanceof DOMException && error.name === 'AbortError') return;
			// Fall through to download for any other failure.
		}
	}

	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = fileName;
	anchor.click();
	URL.revokeObjectURL(url);
}
