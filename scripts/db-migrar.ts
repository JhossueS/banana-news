/** Aplica las migraciones de `drizzle/`. Uso: pnpm db:migrar */
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator';
import { migrate as migrateLite } from 'drizzle-orm/pglite/migrator';
import { crearDb } from '../src/db/client.ts';

const url = process.env.DATABASE_URL;
// En producción, sin DATABASE_URL las tablas se crearían en un PGlite temporal del contenedor: abortar el deploy
if (!url && process.env.NODE_ENV === 'production') {
	console.error('Falta DATABASE_URL: en Railway define ${{Postgres.DATABASE_URL}} en el servicio web.');
	process.exit(1);
}
const db = await crearDb(url);
const opts = { migrationsFolder: 'drizzle' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
await (url ? migratePg(db, opts) : migrateLite(db as any, opts));
console.log(`Migraciones aplicadas en ${url ? 'Postgres' : 'PGlite (.data/pglite)'}.`);
process.exit(0);
