<!--
	Fixed-height virtual scrolling list: renders only the rows visible in the
	viewport (plus overscan) so large entry lists stay responsive.
	Shows floating jump-to-top/bottom buttons while the list overflows.
-->
<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Full list of items to virtualize. */
		items: T[];
		/** Fixed pixel height of one row. */
		itemHeight?: number;
		/** Extra rows rendered above/below the viewport. */
		overscan?: number;
		/** Row renderer. */
		row: Snippet<[T]>;
		/** Rendered when the list is empty. */
		empty?: Snippet;
	}

	let { items, itemHeight = 72, overscan = 5, row, empty }: Props = $props();

	let scroller = $state<HTMLDivElement | null>(null);
	let scrollTop = $state(0);
	let viewportHeight = $state(0);

	const totalHeight = $derived(items.length * itemHeight);
	const start = $derived(Math.max(0, Math.floor(scrollTop / itemHeight) - overscan));
	const end = $derived(
		Math.min(items.length, Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan)
	);
	const visible = $derived(items.slice(start, end));
	const scrollable = $derived(totalHeight > viewportHeight);

	/** Jumps to the first row. */
	function scrollToTop(): void {
		scroller?.scrollTo({ top: 0 });
	}

	/** Jumps to the last row. */
	function scrollToBottom(): void {
		scroller?.scrollTo({ top: totalHeight });
	}
</script>

<div class="relative h-full">
	<div
		class="h-full overflow-y-auto"
		bind:this={scroller}
		bind:clientHeight={viewportHeight}
		onscroll={(event) => (scrollTop = event.currentTarget.scrollTop)}
	>
		{#if items.length === 0}
			{#if empty}{@render empty()}{/if}
		{:else}
			<div class="relative" style:height="{totalHeight}px">
				{#each visible as item, i (start + i)}
					<div
						class="absolute inset-x-0"
						style:top="{(start + i) * itemHeight}px"
						style:height="{itemHeight}px"
					>
						{@render row(item)}
					</div>
				{/each}
			</div>
		{/if}
	</div>
	{#if scrollable}
		<div class="absolute right-4 bottom-4 flex flex-col gap-2">
			<button
				type="button"
				class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/70 text-lg
					text-white shadow-md hover:bg-slate-700"
				aria-label="先頭へ移動"
				onclick={scrollToTop}
			>
				↑
			</button>
			<button
				type="button"
				class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/70 text-lg
					text-white shadow-md hover:bg-slate-700"
				aria-label="末尾へ移動"
				onclick={scrollToBottom}
			>
				↓
			</button>
		</div>
	{/if}
</div>
