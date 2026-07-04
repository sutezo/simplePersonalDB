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
		listEntries,
		updateEntry
	} from '$lib/db/database';
	import { collectTags, filterEntries, sortByUpdatedAt } from '$lib/db/filter';
	import { exportCsv } from '$lib/db/csv';
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

	const allTags = $derived(collectTags(entries));
	const filtered = $derived(
		sortByUpdatedAt(
			filterEntries(entries, { keyword, tags: selectedTags, from, to }),
			sortDirection
		)
	);
	const selected = $derived(entries.find((entry) => entry.id === selectedId) ?? null);
	const editorOpen = $derived(creating || selected !== null);

	onMount(reload);

	/** Reloads all entries from IndexedDB. */
	async function reload(): Promise<void> {
		entries = await listEntries();
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
		<div class="flex flex-col gap-2 border-b border-slate-200 bg-white p-3">
			<div class="flex gap-2">
				<input
					type="search"
					class="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
					placeholder="キーワード検索（項目・値・メモ）"
					bind:value={keyword}
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
				<label class="flex items-center gap-1">
					<span>更新日</span>
					<input
						type="date"
						class="rounded border border-slate-300 px-2 py-1"
						bind:value={from}
					/>
				</label>
				<span>〜</span>
				<input type="date" class="rounded border border-slate-300 px-2 py-1" bind:value={to} />
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
					onclick={() => exportCsv(entries)}
				>
					CSVエクスポート
				</button>
			</div>
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
