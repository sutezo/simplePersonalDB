// CSV export/import: pure (de)serialization of entries plus a browser-side
// download/share helper (Web Share API with Blob-download fallback).
import type { Entry } from '$lib/types';
import { parseTags } from '$lib/db/filter';

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
 * Parses CSV text into rows of fields (RFC 4180: quoted fields, escaped
 * quotes, CR/LF/CRLF line endings). A leading BOM is ignored.
 * @param text - Raw CSV text.
 * @returns Rows of raw field strings.
 */
export function parseCsv(text: string): string[][] {
	const input = text.startsWith('\uFEFF') ? text.slice(1) : text;
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;
	for (let i = 0; i < input.length; i++) {
		const ch = input[i];
		if (inQuotes) {
			if (ch === '"') {
				if (input[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === ',') {
			row.push(field);
			field = '';
		} else if (ch === '\r' || ch === '\n') {
			if (ch === '\r' && input[i + 1] === '\n') i++;
			row.push(field);
			field = '';
			rows.push(row);
			row = [];
		} else {
			field += ch;
		}
	}
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

/**
 * Deserializes CSV text (as produced by {@link entriesToCsv}) into entries.
 * @param text - CSV text including the header row.
 * @returns Parsed entries; missing ids/timestamps are filled in.
 * @throws Error with a Japanese message when the format is invalid.
 */
export function csvToEntries(text: string): Entry[] {
	const rows = parseCsv(text).filter((row) => !(row.length === 1 && row[0] === ''));
	if (rows.length === 0) {
		throw new Error('CSVが空です');
	}
	if (rows[0].join(',') !== CSV_COLUMNS.join(',')) {
		throw new Error(`CSVのヘッダーが想定と異なります: ${rows[0].join(',')}`);
	}
	const now = new Date().toISOString();
	return rows.slice(1).map((row, index) => {
		const line = index + 2;
		if (row.length !== CSV_COLUMNS.length) {
			throw new Error(`${line}行目: 列数が不正です（${row.length}列）`);
		}
		const [id, tags, name, valueType, value, memo, createdAt, updatedAt] = row;
		if (valueType !== 'text' && valueType !== 'date') {
			throw new Error(`${line}行目: データ型が不正です（${valueType}）`);
		}
		if (name.trim().length === 0) {
			throw new Error(`${line}行目: 項目名が空です`);
		}
		return {
			id: id || crypto.randomUUID(),
			tags: parseTags(tags),
			name,
			valueType,
			value,
			memo,
			createdAt: createdAt || now,
			updatedAt: updatedAt || now
		};
	});
}

/**
 * Exports entries as a CSV file via the iOS share sheet when available,
 * otherwise triggers a plain Blob download.
 * @param entries - Entries to export.
 * @returns True when the export completed; false when the user cancelled it.
 */
export async function exportCsv(entries: Entry[]): Promise<boolean> {
	const stamp = new Date().toISOString().slice(0, 10);
	const fileName = `personal-db-${stamp}.csv`;
	// UTF-8 BOM so spreadsheet apps detect the encoding correctly.
	const blob = new Blob(['\uFEFF' + entriesToCsv(entries)], { type: 'text/csv' });
	const file = new File([blob], fileName, { type: 'text/csv' });

	if (navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({ files: [file], title: fileName });
			return true;
		} catch (error) {
			// AbortError means the user cancelled the share sheet.
			if (error instanceof DOMException && error.name === 'AbortError') return false;
			// Fall through to download for any other failure.
		}
	}

	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = fileName;
	anchor.click();
	URL.revokeObjectURL(url);
	return true;
}
