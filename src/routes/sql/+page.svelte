<!--
	SQL console: runs SELECT-only queries against a throwaway in-memory SQLite
	database rebuilt from IndexedDB on each run. Includes a simple query builder
	and a persisted history of executed queries (click to load back).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		addSqlHistory,
		deleteSqlHistory,
		listEntries,
		listSqlHistory
	} from '$lib/db/database';
	import {
		ENTRY_COLUMNS,
		buildDatabase,
		buildSelectSql,
		executeSelect,
		validateSelectOnly,
		type QueryResult
	} from '$lib/db/sqlEngine';
	import { loadSqlJs } from '$lib/db/sqlLoader';
	import type { SqlHistoryEntry } from '$lib/types';

	let sqlText = $state('SELECT name, value, tags\nFROM entries\nORDER BY updatedAt DESC');
	let checkedColumns = $state<string[]>(['name', 'value']);
	let groupBy = $state('');
	let result = $state<QueryResult | null>(null);
	let errorMessage = $state('');
	let running = $state(false);
	let history = $state<SqlHistoryEntry[]>([]);

	onMount(async () => {
		history = await listSqlHistory();
	});

	/**
	 * Toggles a column in the query-builder selection.
	 * @param column - Column name to toggle.
	 */
	function toggleColumn(column: string): void {
		checkedColumns = checkedColumns.includes(column)
			? checkedColumns.filter((c) => c !== column)
			: [...checkedColumns, column];
	}

	/** Generates SQL from the query builder into the editor. */
	function generateSql(): void {
		sqlText = buildSelectSql(checkedColumns, groupBy);
	}

	/** Executes the SQL in the editor against the current entries. */
	async function run(): Promise<void> {
		const validationError = validateSelectOnly(sqlText);
		if (validationError) {
			errorMessage = validationError;
			result = null;
			return;
		}
		running = true;
		errorMessage = '';
		try {
			const [SQL, entries] = await Promise.all([loadSqlJs(), listEntries()]);
			const db = buildDatabase(SQL, entries);
			try {
				result = executeSelect(db, sqlText);
			} finally {
				db.close();
			}
			await addSqlHistory(sqlText);
			history = await listSqlHistory();
		} catch (error) {
			result = null;
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			running = false;
		}
	}

	/**
	 * Loads a history entry back into the editor.
	 * @param item - History entry to load.
	 */
	function selectHistory(item: SqlHistoryEntry): void {
		sqlText = item.sql;
	}

	/**
	 * Removes one entry from the history.
	 * @param item - History entry to remove.
	 */
	async function removeHistory(item: SqlHistoryEntry): Promise<void> {
		await deleteSqlHistory(item.id);
		history = await listSqlHistory();
	}

	/**
	 * Formats an ISO timestamp as a short localized string.
	 * @param iso - ISO 8601 timestamp.
	 * @returns Localized date-time string.
	 */
	function formatDateTime(iso: string): string {
		return new Date(iso).toLocaleString('ja-JP', {
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="flex h-full flex-col gap-3 overflow-y-auto p-4">
	<section class="rounded border border-slate-200 bg-white p-3">
		<h2 class="mb-2 text-sm font-bold">クエリビルダー（テーブル: entries）</h2>
		<div class="flex flex-wrap items-center gap-3 text-sm">
			<div class="flex flex-wrap gap-2">
				{#each ENTRY_COLUMNS as column (column)}
					<label class="flex items-center gap-1">
						<input
							type="checkbox"
							checked={checkedColumns.includes(column)}
							onchange={() => toggleColumn(column)}
						/>
						<span>{column}</span>
					</label>
				{/each}
			</div>
			<label class="flex items-center gap-1">
				<span class="text-slate-500">GROUP BY</span>
				<select class="rounded border border-slate-300 px-2 py-1" bind:value={groupBy}>
					<option value="">なし</option>
					{#each ENTRY_COLUMNS as column (column)}
						<option value={column}>{column}</option>
					{/each}
				</select>
			</label>
			<button
				type="button"
				class="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100"
				onclick={generateSql}
			>
				SQL生成
			</button>
		</div>
	</section>

	<section class="flex flex-col gap-2">
		<textarea
			rows="5"
			class="w-full rounded border border-slate-300 bg-white p-3 font-mono text-sm"
			spellcheck="false"
			bind:value={sqlText}
		></textarea>
		<div class="flex items-center gap-3">
			<button
				type="button"
				class="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
				disabled={running}
				onclick={run}
			>
				{running ? '実行中…' : '実行'}
			</button>
			<span class="text-xs text-slate-400">SELECT文のみ実行できます</span>
		</div>
	</section>

	{#if errorMessage}
		<p class="rounded bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
	{/if}

	{#if result}
		{#if result.rows.length === 0}
			<p class="text-sm text-slate-400">結果は0件です。</p>
		{:else}
			<div class="overflow-x-auto rounded border border-slate-200 bg-white">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-200 bg-slate-50 text-left">
							{#each result.columns as column (column)}
								<th class="px-3 py-2 font-medium">{column}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each result.rows as row, rowIndex (rowIndex)}
							<tr class="border-b border-slate-100">
								{#each row as cell, cellIndex (cellIndex)}
									<td class="px-3 py-2 align-top whitespace-pre-wrap">{cell ?? ''}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="text-xs text-slate-400">{result.rows.length} 行</p>
		{/if}
	{/if}

	{#if history.length > 0}
		<section class="rounded border border-slate-200 bg-white">
			<h2 class="border-b border-slate-200 px-3 py-2 text-sm font-bold">履歴</h2>
			<ul>
				{#each history as item (item.id)}
					<li class="flex items-center gap-2 border-b border-slate-100 last:border-b-0">
						<button
							type="button"
							class="flex min-w-0 flex-1 items-baseline gap-3 px-3 py-2 text-left hover:bg-slate-50"
							title={item.sql}
							onclick={() => selectHistory(item)}
						>
							<code class="truncate font-mono text-xs">{item.sql.replace(/\s+/g, ' ')}</code>
							<span class="ml-auto shrink-0 text-xs text-slate-400">
								{formatDateTime(item.executedAt)}
							</span>
						</button>
						<button
							type="button"
							class="shrink-0 px-2 py-2 text-xs text-slate-400 hover:text-red-600"
							aria-label="履歴を削除"
							onclick={() => removeHistory(item)}
						>
							✕
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
