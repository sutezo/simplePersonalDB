// SPA mode: disable SSR/prerender entirely; adapter-static emits a
// fallback index.html that serves every route client-side.
export const ssr = false;
export const prerender = false;
export const csr = true;
