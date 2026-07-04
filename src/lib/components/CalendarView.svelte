<!--
	Month calendar grid (display only): renders date-typed entries on their day
	cells, with previous/next month navigation. No click-to-edit behaviour.
-->
<script lang="ts">
	import type { CalendarCell } from '$lib/db/calendar';

	interface Props {
		/** Day cells covering the first Sunday through the last Saturday. */
		cells: CalendarCell[];
		/** Displayed year. */
		year: number;
		/** Displayed month index (0-11). */
		month: number;
		/** Today's date (yyyy-mm-dd) used to highlight the current day. */
		today: string;
		/** Moves to the previous month. */
		onprev: () => void;
		/** Moves to the next month. */
		onnext: () => void;
	}

	let { cells, year, month, today, onprev, onnext }: Props = $props();

	/** Weekday header labels, Sunday first. */
	const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
	/** Max entry names shown per cell before collapsing into a "+N" counter. */
	const MAX_VISIBLE = 3;
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-center gap-4 py-2">
		<button
			type="button"
			class="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
			onclick={onprev}
			aria-label="前の月"
		>
			◀
		</button>
		<span class="min-w-32 text-center text-sm font-medium">{year}年{month + 1}月</span>
		<button
			type="button"
			class="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
			onclick={onnext}
			aria-label="次の月"
		>
			▶
		</button>
	</div>

	<div class="grid grid-cols-7 border-t border-l border-slate-200 text-xs">
		{#each weekdays as label, index (label)}
			<div
				class="border-r border-b border-slate-200 bg-slate-50 py-1 text-center font-medium
					{index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-slate-600'}"
			>
				{label}
			</div>
		{/each}
	</div>

	<div class="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 border-l border-slate-200 text-xs">
		{#each cells as cell (cell.date)}
			<div
				class="min-h-16 overflow-hidden border-r border-b border-slate-200 p-1
					{cell.inCurrentMonth ? 'bg-white' : 'bg-slate-50 text-slate-400'}"
			>
				<div
					class="mb-0.5 text-right font-medium
						{cell.date === today ? 'inline-block rounded bg-slate-800 px-1 text-white' : ''}"
				>
					{cell.day}
				</div>
				<div class="flex flex-col gap-0.5">
					{#each cell.entries.slice(0, MAX_VISIBLE) as entry (entry.id)}
						<div
							class="truncate rounded bg-slate-100 px-1 text-slate-700"
							title={entry.name}
						>
							{entry.name}
						</div>
					{/each}
					{#if cell.entries.length > MAX_VISIBLE}
						<div class="px-1 text-slate-500">+{cell.entries.length - MAX_VISIBLE}</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>
