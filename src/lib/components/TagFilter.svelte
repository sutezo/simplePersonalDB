<!--
	Tag filter chips: shows every known tag as a toggleable chip.
	Multiple tags can be active at once (AND filtering).
-->
<script lang="ts">
	interface Props {
		/** All known tags. */
		tags: string[];
		/** Currently selected tags (bindable). */
		selected: string[];
	}

	let { tags, selected = $bindable() }: Props = $props();

	/**
	 * Toggles a tag in the selection.
	 * @param tag - Tag to toggle.
	 */
	function toggle(tag: string): void {
		selected = selected.includes(tag)
			? selected.filter((t) => t !== tag)
			: [...selected, tag];
	}
</script>

{#if tags.length > 0}
	<div class="flex flex-wrap gap-1.5">
		{#each tags as tag (tag)}
			<button
				type="button"
				class="rounded-full px-3 py-1 text-xs font-medium transition-colors
					{selected.includes(tag)
					? 'bg-slate-800 text-white'
					: 'bg-slate-200 text-slate-700 hover:bg-slate-300'}"
				onclick={() => toggle(tag)}
			>
				{tag}
			</button>
		{/each}
	</div>
{/if}
