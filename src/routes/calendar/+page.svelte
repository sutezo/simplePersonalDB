<!--
	Calendar screen: shows date-typed entries on a month grid, filtered by tags.
	Display only (no editing); keyword/date-range search is intentionally absent.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Entry } from '$lib/types';
	import { listEntries } from '$lib/db/database';
	import { collectTags } from '$lib/db/filter';
	import { buildMonthGrid, filterDateEntries } from '$lib/db/calendar';
	import TagFilter from '$lib/components/TagFilter.svelte';
	import CalendarView from '$lib/components/CalendarView.svelte';

	const now = new Date();

	let entries = $state<Entry[]>([]);
	let selectedTags = $state<string[]>([]);
	let year = $state(now.getFullYear());
	let month = $state(now.getMonth());

	const allTags = $derived(collectTags(entries));
	const dateEntries = $derived(filterDateEntries(entries, selectedTags));
	const cells = $derived(buildMonthGrid(year, month, dateEntries));
	const today = $derived(
		`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
			now.getDate()
		).padStart(2, '0')}`
	);

	onMount(async () => {
		entries = await listEntries();
	});

	/** Moves the view to the previous month, wrapping the year as needed. */
	function prevMonth(): void {
		if (month === 0) {
			month = 11;
			year -= 1;
		} else {
			month -= 1;
		}
	}

	/** Moves the view to the next month, wrapping the year as needed. */
	function nextMonth(): void {
		if (month === 11) {
			month = 0;
			year += 1;
		} else {
			month += 1;
		}
	}
</script>

<div class="flex h-full flex-col">
	<div class="border-b border-slate-200 bg-white p-3">
		<TagFilter tags={allTags} bind:selected={selectedTags} />
	</div>
	<div class="min-h-0 flex-1 overflow-y-auto p-3">
		<CalendarView {cells} {year} {month} {today} onprev={prevMonth} onnext={nextMonth} />
	</div>
</div>
