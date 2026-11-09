/**
 * Crea la conexión a Postgres.
 * - Con `DATABASE_URL` (Railway, producción) usa postgres.js.
 * - Sin ella (desarrollo local sin Docker) usa PGlite, un Postgres embebido en `.data/pglite`.
 * No depende de `astro:env` para poder usarse también desde los scripts de `scripts/`.
 */
import { drizzle as drizzlePg, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema.ts';

export type Db = PostgresJsDatabase<typeof schema>;

export const PGLITE_DIR = '.data/pglite';

export async function crearDb(url?: string): Promise<Db> {
	if (url) {
		const { default: postgres } = await import('postgres');
		return drizzlePg(postgres(url, { max: 10 }), { schema });
	}
	const { mkdirSync } = await import('node:fs');
	mkdirSync(PGLITE_DIR, { recursive: true });
	const { PGlite } = await import('@electric-sql/pglite');
	const { drizzle } = await import('drizzle-orm/pglite');
	// Misma API de consultas; el tipo se unifica con el de postgres.js
	return drizzle(new PGlite(PGLITE_DIR), { schema }) as unknown as Db;
}
