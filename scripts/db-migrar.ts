/** Aplica las migraciones de `drizzle/`. Uso: pnpm db:migrar */
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator';
import { migrate as migrateLite } from 'drizzle-orm/pglite/migrator';
import { crearDb } from '../src/db/client.ts';

const url = process.env.DATABASE_URL;
const db = await crearDb(url);
const opts = { migrationsFolder: 'drizzle' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
await (url ? migratePg(db, opts) : migrateLite(db as any, opts));
console.log(`Migraciones aplicadas en ${url ? 'Postgres' : 'PGlite (.data/pglite)'}.`);
process.exit(0);
