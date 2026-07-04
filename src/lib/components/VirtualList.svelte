<!--
	Fixed-height virtual scrolling list: renders only the rows visible in the
	viewport (plus overscan) so large entry lists stay responsive.
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

	let scrollTop = $state(0);
	let viewportHeight = $state(0);

	const start = $derived(Math.max(0, Math.floor(scrollTop / itemHeight) - overscan));
	const end = $derived(
		Math.min(items.length, Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan)
	);
	const visible = $derived(items.slice(start, end));
</script>

<div
	class="h-full overflow-y-auto"
	bind:clientHeight={viewportHeight}
	onscroll={(event) => (scrollTop = event.currentTarget.scrollTop)}
>
	{#if items.length === 0}
		{#if empty}{@render empty()}{/if}
	{:else}
		<div class="relative" style:height="{items.length * itemHeight}px">
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
