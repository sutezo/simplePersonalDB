// Service worker: precaches every build asset and static file so the app
// works fully offline, serving the SPA fallback page for navigations.
/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `cache-${version}`;
// '/' returns the SPA fallback page and is cached for offline navigation.
const ASSETS = [...build, ...files, '/'];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS);
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const url = new URL(request.url);

			if (url.origin === sw.location.origin && ASSETS.includes(url.pathname)) {
				const hit = await cache.match(url.pathname);
				if (hit) return hit;
			}

			try {
				const response = await fetch(request);
				if (response.ok && url.origin === sw.location.origin) {
					await cache.put(request, response.clone());
				}
				return response;
			} catch (error) {
				// Offline: navigations fall back to the cached SPA shell.
				if (request.mode === 'navigate') {
					const fallback = await cache.match('/');
					if (fallback) return fallback;
				}
				const hit = await cache.match(request);
				if (hit) return hit;
				throw error;
			}
		})()
	);
});
