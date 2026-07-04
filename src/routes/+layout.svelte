<!--
	App shell: top navigation (list / SQL) and the routed page content.
	Requests persistent storage once on startup to reduce iOS eviction risk.
-->
<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
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

	const links = [
		{ href: '/', label: '一覧' },
		{ href: '/sql', label: 'SQL' }
	];
</script>

<div class="flex h-dvh flex-col bg-slate-50 text-slate-900">
	<header class="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2">
		<h1 class="text-base font-bold">PersonalDB</h1>
		<nav class="flex gap-1">
			{#each links as link (link.href)}
				<a
					href={link.href}
					class="rounded px-3 py-1.5 text-sm font-medium
						{page.url.pathname === link.href
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
