import type { Entry } from '$lib/types';
import {
	getDeletedEntries,
	getMeta,
	listEntries,
	replaceEntries,
	setDeletedEntries,
	setMeta
} from '$lib/db/database';

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const SYNC_FILE_NAME = 'simplePersonalDB-sync.json';
const SNAPSHOT_VERSION = 1;

interface TokenResponse {
	access_token?: string;
	error?: string;
	error_description?: string;
}

interface TokenClient {
	requestAccessToken(config?: { prompt?: string }): void;
}

declare global {
	interface Window {
		google?: {
			accounts: {
				oauth2: {
					initTokenClient(config: {
						client_id: string;
						scope: string;
						callback: (response: TokenResponse) => void;
					}): TokenClient;
				};
			};
		};
	}
}

export interface DriveSnapshot {
	version: number;
	updatedAt: string;
	entries: Entry[];
	deletedEntries: Record<string, string>;
}

export interface DriveSyncResult {
	uploaded: number;
	downloaded: number;
	deleted: number;
	syncedAt: string;
}

interface DriveFile {
	id: string;
	name: string;
	modifiedTime?: string;
}

let gisScriptPromise: Promise<void> | null = null;
let tokenClient: TokenClient | null = null;

export function isGoogleDriveSyncConfigured(): boolean {
	return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}

export async function syncWithGoogleDrive(): Promise<DriveSyncResult> {
	const accessToken = await requestAccessToken();
	const localSnapshot = await buildLocalSnapshot();
	const remote = await downloadSnapshot(accessToken);
	const remoteSnapshot = remote?.snapshot ?? null;
	const merged = mergeSnapshots(localSnapshot, remoteSnapshot);

	await replaceEntries(merged.entries);
	await setDeletedEntries(merged.deletedEntries);

	const fileId = await uploadSnapshot(accessToken, remote?.fileId ?? null, merged);
	const syncedAt = new Date().toISOString();
	await setMeta('googleDriveFileId', fileId);
	await setMeta('lastGoogleDriveSyncAt', syncedAt);

	return {
		uploaded: countEntriesMissingOrNewer(merged.entries, remoteSnapshot?.entries ?? []),
		downloaded: countEntriesMissingOrNewer(merged.entries, localSnapshot.entries),
		deleted: Object.keys(merged.deletedEntries).length,
		syncedAt
	};
}

export function mergeSnapshots(
	local: DriveSnapshot,
	remote: DriveSnapshot | null
): DriveSnapshot {
	if (!remote) return local;

	const localEntries = new Map(local.entries.map((entry) => [entry.id, entry]));
	const remoteEntries = new Map(remote.entries.map((entry) => [entry.id, entry]));
	const deletedEntries = { ...remote.deletedEntries, ...local.deletedEntries };
	for (const [id, deletedAt] of Object.entries(local.deletedEntries)) {
		if ((remote.deletedEntries[id] ?? '') > deletedAt) {
			deletedEntries[id] = remote.deletedEntries[id];
		}
	}

	const ids = new Set([
		...localEntries.keys(),
		...remoteEntries.keys(),
		...Object.keys(deletedEntries)
	]);
	const entries: Entry[] = [];
	const keptDeletedEntries: Record<string, string> = {};

	for (const id of ids) {
		const localEntry = localEntries.get(id) ?? null;
		const remoteEntry = remoteEntries.get(id) ?? null;
		const deletedAt = deletedEntries[id] ?? '';
		const newestEntry = pickNewerEntry(localEntry, remoteEntry);
		if (!newestEntry) {
			keptDeletedEntries[id] = deletedAt;
			continue;
		}
		if (deletedAt > newestEntry.updatedAt) {
			keptDeletedEntries[id] = deletedAt;
			continue;
		}
		entries.push(newestEntry);
	}

	return {
		version: SNAPSHOT_VERSION,
		updatedAt: new Date().toISOString(),
		entries: entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
		deletedEntries: keptDeletedEntries
	};
}

async function buildLocalSnapshot(): Promise<DriveSnapshot> {
	return {
		version: SNAPSHOT_VERSION,
		updatedAt: new Date().toISOString(),
		entries: await listEntries(),
		deletedEntries: await getDeletedEntries()
	};
}

async function requestAccessToken(): Promise<string> {
	const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
	if (!clientId) {
		throw new Error('VITE_GOOGLE_CLIENT_ID が未設定です');
	}
	await loadGisScript();
	if (!window.google) {
		throw new Error('Google Identity Services を読み込めませんでした');
	}
	return new Promise((resolve, reject) => {
		tokenClient ??= window.google!.accounts.oauth2.initTokenClient({
			client_id: clientId,
			scope: DRIVE_SCOPE,
			callback: (response) => {
				if (response.access_token) {
					resolve(response.access_token);
				} else {
					reject(
						new Error(
							response.error_description || response.error || 'Google認証がキャンセルされました'
						)
					);
				}
			}
		});
		tokenClient.requestAccessToken({ prompt: '' });
	});
}

function loadGisScript(): Promise<void> {
	if (window.google) return Promise.resolve();
	gisScriptPromise ??= new Promise((resolve, reject) => {
		const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_URL}"]`);
		if (existing) {
			existing.addEventListener('load', () => resolve(), { once: true });
			existing.addEventListener('error', () => reject(new Error('Google認証スクリプトの読み込みに失敗しました')), {
				once: true
			});
			return;
		}
		const script = document.createElement('script');
		script.src = GIS_SCRIPT_URL;
		script.async = true;
		script.defer = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error('Google認証スクリプトの読み込みに失敗しました'));
		document.head.appendChild(script);
	});
	return gisScriptPromise;
}

async function downloadSnapshot(
	accessToken: string
): Promise<{ fileId: string; snapshot: DriveSnapshot } | null> {
	const storedFileId = await getMeta('googleDriveFileId');
	const file = storedFileId
		? await getFile(accessToken, storedFileId)
		: await findSyncFile(accessToken);
	if (!file) return null;

	const response = await driveFetch(accessToken, `${DRIVE_API}/files/${file.id}?alt=media`);
	if (response.status === 404) return null;
	if (!response.ok) throw await responseError(response, 'Google Driveからの読み込みに失敗しました');
	return { fileId: file.id, snapshot: parseSnapshot(await response.json()) };
}

async function getFile(accessToken: string, fileId: string): Promise<DriveFile | null> {
	const response = await driveFetch(
		accessToken,
		`${DRIVE_API}/files/${fileId}?fields=id,name,modifiedTime`
	);
	if (response.status === 404) return findSyncFile(accessToken);
	if (!response.ok) throw await responseError(response, 'Google Driveファイルの確認に失敗しました');
	return (await response.json()) as DriveFile;
}

async function findSyncFile(accessToken: string): Promise<DriveFile | null> {
	const params = new URLSearchParams({
		spaces: 'appDataFolder',
		fields: 'files(id,name,modifiedTime)',
		q: `name='${SYNC_FILE_NAME.replace(/'/g, "\\'")}' and trashed=false`
	});
	const response = await driveFetch(accessToken, `${DRIVE_API}/files?${params.toString()}`);
	if (!response.ok) throw await responseError(response, 'Google Driveファイルの検索に失敗しました');
	const body = (await response.json()) as { files?: DriveFile[] };
	return body.files?.[0] ?? null;
}

async function uploadSnapshot(
	accessToken: string,
	fileId: string | null,
	snapshot: DriveSnapshot
): Promise<string> {
	const metadata = fileId ? { name: SYNC_FILE_NAME } : { name: SYNC_FILE_NAME, parents: ['appDataFolder'] };
	const boundary = `simplePersonalDB_${crypto.randomUUID()}`;
	const body = [
		`--${boundary}`,
		'Content-Type: application/json; charset=UTF-8',
		'',
		JSON.stringify(metadata),
		`--${boundary}`,
		'Content-Type: application/json; charset=UTF-8',
		'',
		JSON.stringify(snapshot),
		`--${boundary}--`
	].join('\r\n');
	const url = fileId
		? `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=multipart&fields=id`
		: `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id`;
	const response = await driveFetch(accessToken, url, {
		method: fileId ? 'PATCH' : 'POST',
		headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
		body
	});
	if (!response.ok) throw await responseError(response, 'Google Driveへの保存に失敗しました');
	const uploaded = (await response.json()) as { id?: string };
	if (!uploaded.id) throw new Error('Google DriveのファイルIDを取得できませんでした');
	return uploaded.id;
}

function driveFetch(accessToken: string, input: string, init: RequestInit = {}): Promise<Response> {
	return fetch(input, {
		...init,
		headers: {
			...(init.headers ?? {}),
			Authorization: `Bearer ${accessToken}`
		}
	});
}

function parseSnapshot(value: unknown): DriveSnapshot {
	if (!value || typeof value !== 'object') throw new Error('Drive同期ファイルの形式が不正です');
	const snapshot = value as Partial<DriveSnapshot>;
	if (!Array.isArray(snapshot.entries)) throw new Error('Drive同期ファイルにentriesがありません');
	return {
		version: Number(snapshot.version) || SNAPSHOT_VERSION,
		updatedAt: typeof snapshot.updatedAt === 'string' ? snapshot.updatedAt : new Date().toISOString(),
		entries: snapshot.entries.filter(isEntry),
		deletedEntries: normalizeDeletedEntries(snapshot.deletedEntries)
	};
}

function normalizeDeletedEntries(value: unknown): Record<string, string> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return Object.fromEntries(
		Object.entries(value).filter(([id, deletedAt]) => typeof id === 'string' && typeof deletedAt === 'string')
	);
}

function isEntry(value: unknown): value is Entry {
	if (!value || typeof value !== 'object') return false;
	const entry = value as Partial<Entry>;
	return (
		typeof entry.id === 'string' &&
		Array.isArray(entry.tags) &&
		entry.tags.every((tag) => typeof tag === 'string') &&
		typeof entry.name === 'string' &&
		(entry.valueType === 'text' || entry.valueType === 'date') &&
		typeof entry.value === 'string' &&
		typeof entry.memo === 'string' &&
		typeof entry.createdAt === 'string' &&
		typeof entry.updatedAt === 'string'
	);
}

function pickNewerEntry(a: Entry | null, b: Entry | null): Entry | null {
	if (!a) return b;
	if (!b) return a;
	return a.updatedAt >= b.updatedAt ? a : b;
}

function countEntriesMissingOrNewer(entries: Entry[], base: Entry[]): number {
	const baseById = new Map(base.map((entry) => [entry.id, entry]));
	return entries.filter((entry) => {
		const baseEntry = baseById.get(entry.id);
		return !baseEntry || entry.updatedAt > baseEntry.updatedAt;
	}).length;
}

async function responseError(response: Response, fallback: string): Promise<Error> {
	let detail = '';
	try {
		const body = await response.json();
		detail = body?.error?.message ? `: ${body.error.message}` : '';
	} catch {
		// Ignore non-JSON error bodies.
	}
	return new Error(`${fallback}（${response.status}）${detail}`);
}
