// SvelteKit configuration: pure SPA built with adapter-static.
// The fallback page (index.html) serves every route client-side.
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: 'index.html'
    }),
    paths: {
      // GitHub Pages serves the site under /<repo>/; the deploy workflow
      // sets BASE_PATH accordingly. Local dev uses ''.
      base: process.env.BASE_PATH || ''
    }
  }
};

export default config;
