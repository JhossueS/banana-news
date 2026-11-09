/** Conexión única para el servidor de Astro. */
import { DATABASE_URL } from 'astro:env/server';
import { crearDb, type Db } from './client.ts';

// Un solo cliente aunque Vite recargue el módulo en desarrollo (PGlite no admite dos instancias sobre el mismo directorio).
const g = globalThis as typeof globalThis & { __bnDb?: Promise<Db> };
export const db: Db = await (g.__bnDb ??= crearDb(DATABASE_URL));

export * as tablas from './schema.ts';
