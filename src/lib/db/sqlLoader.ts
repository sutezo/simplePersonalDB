// Browser-side loader for sql.js: resolves the wasm binary through Vite
// so it is bundled locally and precached by the service worker (zero external I/O).
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

/**
 * Initializes sql.js once and caches the module.
 * @returns The initialized sql.js module.
 */
export function loadSqlJs(): Promise<SqlJsStatic> {
	sqlJsPromise ??= initSqlJs({ locateFile: () => wasmUrl });
	return sqlJsPromise;
}
