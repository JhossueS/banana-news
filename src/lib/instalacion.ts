/**
 * Instalación: crear la PRIMERA cuenta de administrador desde /admin/configurar/.
 * - Solo funciona mientras la base no tiene ninguna cuenta; después la página responde 404 para siempre.
 * - Exige el código SETUP_TOKEN (variable de Railway): nadie más que quien controla el servidor puede usarla,
 *   aunque llegue antes a la página.
 * - El código se compara en tiempo constante y la creación va dentro de un bloqueo de Postgres, así que dos
 *   peticiones simultáneas no pueden crear dos administradores.
 */
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { count, sql } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { SETUP_TOKEN } from 'astro:env/server';
import { db, tablas } from '../db/index.ts';

/** Largo mínimo del código: uno corto se podría adivinar */
export const MIN_TOKEN = 24;

export const tokenConfigurado = () => !!SETUP_TOKEN && SETUP_TOKEN.length >= MIN_TOKEN;

export async function hayCuentas() {
	const [fila] = await db.select({ n: count() }).from(tablas.user);
	return (fila?.n ?? 0) > 0;
}

/** Compara hashes de igual largo en tiempo constante (no revela cuántos caracteres coinciden) */
export function tokenCorrecto(intento: string) {
	if (!tokenConfigurado()) return false;
	const a = createHash('sha256').update(intento).digest();
	const b = createHash('sha256').update(SETUP_TOKEN!).digest();
	return timingSafeEqual(a, b);
}

/** Crea el administrador inicial. Devuelve false si ya existía alguna cuenta (otra petición ganó) */
export async function crearAdminInicial({ email, name, password }: { email: string; name: string; password: string }) {
	const hash = await hashPassword(password);
	return db.transaction(async (tx) => {
		// Bloqueo exclusivo durante la transacción: las peticiones simultáneas esperan aquí
		await tx.execute(sql`select pg_advisory_xact_lock(7240115)`);
		const [fila] = await tx.select({ n: count() }).from(tablas.user);
		if ((fila?.n ?? 0) > 0) return false;
		const id = randomUUID();
		await tx.insert(tablas.user).values({ id, email: email.toLowerCase(), name, rol: 'admin', emailVerified: true });
		await tx.insert(tablas.account).values({ id: randomUUID(), userId: id, accountId: id, providerId: 'credential', password: hash });
		return true;
	});
}
