<!--
	Main screen: entry list with keyword/tag/date-range filtering plus a detail
	pane. Two panes side-by-side on wide screens, two switched screens on mobile.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Entry, EntryInput } from '$lib/types';
	import {
		createEntry,
		deleteEntry,
		getMeta,
		importEntries,
		listEntries,
		setMeta,
		updateEntry
	} from '$lib/db/database';
	import { collectTags, filterEntries, sortByUpdatedAt } from '$lib/db/filter';
	import { csvToEntries, exportCsv } from '$lib/db/csv';
	import { needsBackupReminder, snoozeUntil } from '$lib/db/backup';
	import { isGoogleDriveSyncConfigured, syncWithGoogleDrive } from '$lib/db/googleDriveSync';
	import EntryForm from '$lib/components/EntryForm.svelte';
	import TagFilter from '$lib/components/TagFilter.svelte';
	import VirtualList from '$lib/components/VirtualList.svelte';

	let entries = $state<Entry[]>([]);
	let selectedId = $state<string | null>(null);
	let creating = $state(false);
	let keyword = $state('');
	let selectedTags = $state<string[]>([]);
	let from = $state('');
	let to = $state('');
	let sortDirection = $state<'asc' | 'desc'>('desc');
	let lastBackupAt = $state<string | null>(null);
	let backupSnoozedUntil = $state<string | null>(null);
	let importMessage = $state('');
	let syncMessage = $state('');
	let syncing = $state(false);
	let lastGoogleDriveSyncAt = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	const googleDriveSyncConfigured = isGoogleDriveSyncConfigured();

	const allTags = $derived(collectTags(entries));
	const filtered = $derived(
		sortByUpdatedAt(
			filterEntries(entries, { keyword, tags: selectedTags, from, to }),
			sortDirection
		)
	);
	const selected = $derived(entries.find((entry) => entry.id === selectedId) ?? null);
	const editorOpen = $derived(creating || selected !== null);
	const showBackupReminder = $derived(
		needsBackupReminder({ entries, lastBackupAt, snoozedUntil: backupSnoozedUntil })
	);

	onMount(async () => {
		await reload();
		lastBackupAt = await getMeta('lastBackupAt');
		backupSnoozedUntil = await getMeta('backupSnoozedUntil');
		lastGoogleDriveSyncAt = await getMeta('lastGoogleDriveSyncAt');
	});

	/** Reloads all entries from IndexedDB. */
	async function reload(): Promise<void> {
		entries = await listEntries();
	}

	/** Exports a CSV backup and records the backup time when it completes. */
	async function handleExport(): Promise<void> {
		const completed = await exportCsv(entries);
		if (completed) {
			const now = new Date().toISOString();
			await setMeta('lastBackupAt', now);
			lastBackupAt = now;
		}
	}

	/** Hides the backup reminder for a few days. */
	async function handleSnoozeBackup(): Promise<void> {
		const until = snoozeUntil();
		await setMeta('backupSnoozedUntil', until);
		backupSnoozedUntil = until;
	}

	/**
	 * Imports entries from the selected CSV file (upsert by id).
	 * @param event - Change event of the hidden file input.
	 */
	async function handleImportFile(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			const imported = csvToEntries(await file.text());
			if (!window.confirm(`${imported.length}件をインポートします。同じIDの項目は上書きされます。よろしいですか？`)) {
				importMessage = '';
				return;
			}
			const count = await importEntries(imported);
			await reload();
			importMessage = `${count}件をインポートしました`;
		} catch (error) {
			importMessage = `インポート失敗: ${error instanceof Error ? error.message : String(error)}`;
		}
	}

	/** Runs one user-initiated Google Drive snapshot sync. */
	async function handleGoogleDriveSync(): Promise<void> {
		if (syncing) return;
		syncing = true;
		syncMessage = 'Google Driveと同期中...';
		try {
			const result = await syncWithGoogleDrive();
			await reload();
			lastGoogleDriveSyncAt = result.syncedAt;
			lastBackupAt = result.syncedAt;
			await setMeta('lastBackupAt', result.syncedAt);
			syncMessage = `Google Drive同期完了: 反映 ${result.downloaded}件 / 保存 ${result.uploaded}件`;
		} catch (error) {
			syncMessage = `Google Drive同期失敗: ${error instanceof Error ? error.message : String(error)}`;
		} finally {
			syncing = false;
		}
	}

	/**
	 * Creates or updates an entry from the form input.
	 * @param input - Validated form values.
	 */
	async function handleSave(input: EntryInput): Promise<void> {
		if (selected) {
			await updateEntry(selected.id, input);
		} else {
			await createEntry(input);
		}
		creating = false;
		selectedId = null;
		await reload();
	}

	/** Deletes the selected entry after confirmation. */
	async function handleDelete(): Promise<void> {
		if (!selected) return;
		if (!window.confirm(`「${selected.name}」を削除しますか？`)) return;
		await deleteEntry(selected.id);
		selectedId = null;
		await reload();
	}

	/** Closes the editor pane without saving. */
	function closeEditor(): void {
		creating = false;
		selectedId = null;
	}

	/**
	 * Formats an ISO timestamp as a short localized string.
	 * @param iso - ISO 8601 timestamp.
	 * @returns Localized date-time string.
	 */
	function formatDateTime(iso: string): string {
		return new Date(iso).toLocaleString('ja-JP', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="flex h-full">
	<!-- List pane (hidden on mobile while the editor is open) -->
	<section
		class="flex min-w-0 flex-1 flex-col {editorOpen ? 'hidden md:flex' : 'flex'}"
	>
		{#if showBackupReminder}
			<div
				class="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
			>
				<span class="min-w-0 flex-1">
					データ消失に備えてバックアップをおすすめします
					{lastBackupAt ? `（前回: ${formatDateTime(lastBackupAt)}）` : '（未実施）'}
				</span>
				<button
					type="button"
					class="shrink-0 rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
					onclick={handleExport}
				>
					今すぐバックアップ
				</button>
				<button
					type="button"
					class="shrink-0 rounded border border-amber-300 px-3 py-1 text-xs hover:bg-amber-100"
					onclick={handleSnoozeBackup}
				>
					あとで
				</button>
			</div>
		{/if}
		<div class="flex flex-col gap-2 border-b border-slate-200 bg-white p-3">
			<div class="flex flex-wrap items-center gap-2">
				<input
					type="search"
					class="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
					placeholder="キーワード検索（項目・値・メモ）"
					bind:value={keyword}
				/>
				<label class="flex shrink-0 items-center gap-1">
					<span class="text-xs text-slate-600">更新日</span>
					<input
						type="date"
						class="shrink-0 rounded border border-slate-300 px-2 py-1"
						bind:value={from}
					/>
				</label>
				<span class="shrink-0 text-xs text-slate-600">〜</span>
				<input
					type="date"
					class="shrink-0 rounded border border-slate-300 px-2 py-1"
					bind:value={to}
				/>
				<button
					type="button"
					class="shrink-0 rounded bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
					onclick={() => {
						selectedId = null;
						creating = true;
					}}
				>
					＋ 新規
				</button>
			</div>
			<div class="flex flex-wrap items-center gap-2 text-xs text-slate-600">
				<button
					type="button"
					class="ml-auto rounded border border-slate-300 px-2 py-1 hover:bg-slate-100"
					onclick={() => (sortDirection = sortDirection === 'desc' ? 'asc' : 'desc')}
				>
					最終更新 {sortDirection === 'desc' ? '↓' : '↑'}
				</button>
				<button
					type="button"
					class="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100"
					onclick={handleExport}
				>
					CSVエクスポート
				</button>
				<button
					type="button"
					class="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100"
					onclick={() => fileInput?.click()}
				>
					CSVインポート
				</button>
				<button
					type="button"
					class="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!googleDriveSyncConfigured || syncing}
					onclick={handleGoogleDriveSync}
					title={googleDriveSyncConfigured ? 'Google Driveのアプリ専用領域と同期' : 'VITE_GOOGLE_CLIENT_ID が未設定です'}
				>
					{syncing ? 'Drive同期中' : 'Google Drive同期'}
				</button>
				<input
					type="file"
					accept=".csv,text/csv"
					class="hidden"
					bind:this={fileInput}
					onchange={handleImportFile}
				/>
			</div>
			{#if importMessage}
				<p class="text-xs {importMessage.startsWith('インポート失敗') ? 'text-red-600' : 'text-emerald-700'}">
					{importMessage}
				</p>
			{/if}
			{#if syncMessage || lastGoogleDriveSyncAt}
				<p class="text-xs {syncMessage.startsWith('Google Drive同期失敗') ? 'text-red-600' : 'text-emerald-700'}">
					{syncMessage || `前回Drive同期: ${formatDateTime(lastGoogleDriveSyncAt!)}`}
				</p>
			{/if}
			<TagFilter tags={allTags} bind:selected={selectedTags} />
		</div>

		<div class="min-h-0 flex-1">
			<VirtualList items={filtered} itemHeight={72}>
				{#snippet row(entry: Entry)}
					<button
						type="button"
						class="flex h-full w-full flex-col justify-center gap-0.5 border-b border-slate-100 px-4 text-left
							{entry.id === selectedId ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'}"
						onclick={() => {
							creating = false;
							selectedId = entry.id;
						}}
					>
						<span class="flex items-baseline gap-2">
							<span class="truncate text-sm font-medium">{entry.name}</span>
							<span class="truncate text-sm text-slate-600">{entry.value}</span>
						</span>
						<span class="flex items-center gap-2 text-xs text-slate-400">
							<span class="truncate">
								{#each entry.tags as tag (tag)}
									<span class="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">{tag}</span>
								{/each}
							</span>
							<span class="ml-auto shrink-0">{formatDateTime(entry.updatedAt)}</span>
						</span>
					</button>
				{/snippet}
				{#snippet empty()}
					<p class="p-8 text-center text-sm text-slate-400">
						{entries.length === 0 ? 'データがありません。「＋ 新規」から登録してください。' : '条件に一致するデータがありません。'}
					</p>
				{/snippet}
			</VirtualList>
		</div>
		<footer class="border-t border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-400">
			{filtered.length} / {entries.length} 件
		</footer>
	</section>

	<!-- Detail / editor pane -->
	{#if editorOpen}
		<section
			class="w-full overflow-y-auto border-l border-slate-200 bg-white md:w-[28rem]"
		>
			{#key selectedId ?? 'new'}
				<EntryForm
					entry={selected}
					existingTags={allTags}
					onsave={handleSave}
					ondelete={selected ? handleDelete : undefined}
					oncancel={closeEditor}
				/>
			{/key}
		</section>
	{/if}
</div>
