<!--
	App shell: top navigation (list / SQL) and the routed page content.
	Requests persistent storage once on startup to reduce iOS eviction risk.
-->
<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { requestPersistentStorage } from '$lib/db/database';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	onMount(() => {
		void requestPersistentStorage();
	});

	// base-prefixed so links work when hosted under a sub path (GitHub Pages).
	const links = [
		{ href: `${base}/`, label: '一覧' },
		{ href: `${base}/calendar`, label: 'カレンダー' },
		{ href: `${base}/sql`, label: 'SQL' }
	];

	/**
	 * Checks whether a nav link points at the current page,
	 * tolerating a trailing-slash difference.
	 * @param href - Link target.
	 * @param pathname - Current page pathname.
	 * @returns True when the link is active.
	 */
	function isActive(href: string, pathname: string): boolean {
		return pathname === href || `${pathname}/` === href;
	}
</script>

<div class="flex h-dvh flex-col bg-slate-50 text-slate-900">
	<header class="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2">
		<h1 class="text-base font-bold">PersonalDB</h1>
		<nav class="flex gap-1">
			{#each links as link (link.href)}
				<a
					href={link.href}
					class="rounded px-3 py-1.5 text-sm font-medium
						{isActive(link.href, page.url.pathname)
						? 'bg-slate-800 text-white'
						: 'text-slate-600 hover:bg-slate-100'}"
				>
					{link.label}
				</a>
			{/each}
		</nav>
	</header>
	<main class="min-h-0 flex-1">
		{@render children()}
	</main>
</div>
