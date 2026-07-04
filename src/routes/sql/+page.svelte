<!--
	SQL console: runs SELECT-only queries against a throwaway in-memory SQLite
	database rebuilt from IndexedDB on each run. Includes a simple query builder.
-->
<script lang="ts">
	import { listEntries } from '$lib/db/database';
	import {
		ENTRY_COLUMNS,
		buildDatabase,
		buildSelectSql,
		executeSelect,
		validateSelectOnly,
		type QueryResult
	} from '$lib/db/sqlEngine';
	import { loadSqlJs } from '$lib/db/sqlLoader';

	let sqlText = $state('SELECT name, value, tags\nFROM entries\nORDER BY updatedAt DESC');
	let checkedColumns = $state<string[]>(['name', 'value']);
	let groupBy = $state('');
	let result = $state<QueryResult | null>(null);
	let errorMessage = $state('');
	let running = $state(false);

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
		} catch (error) {
			result = null;
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			running = false;
		}
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
</div>
