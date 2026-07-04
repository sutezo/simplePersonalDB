// Ambient type declarations for SvelteKit's App namespace.
// See https://svelte.dev/docs/kit/types#app.d.ts for available interfaces.
declare global {
	interface ImportMetaEnv {
		readonly VITE_GOOGLE_CLIENT_ID?: string;
	}

	interface ImportMeta {
		readonly env: ImportMetaEnv;
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
