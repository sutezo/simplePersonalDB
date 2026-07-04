// Vite configuration: SvelteKit + Tailwind CSS 4 plugin.
// Also hosts the Vitest configuration for unit tests (node environment).
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    host: '0.0.0.0',
    port: 42304
  },
  preview: {
    host: '0.0.0.0',
    port: 4173
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
