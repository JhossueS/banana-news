/** Antispam y límites para los formularios públicos: Turnstile, hash de IP y rate limit en Postgres. */
import { createHash } from 'node:crypto';
import { lt, sql } from 'drizzle-orm';
import { IP_SALT, TURNSTILE_SECRET } from 'astro:env/server';
import { db, tablas } from '../db/index.ts';

/**
 * IP real del visitante. Detrás de Cloudflare viene en cf-connecting-ip (Cloudflare la fija y sobrescribe la
 * que mande el visitante; con ORIGEN_SECRETO nadie puede saltarse Cloudflare). No se usa X-Forwarded-For:
 * su primer valor lo escribe el propio visitante.
 */
export function ipDe(request: Request, clientAddress?: string) {
	return request.headers.get('cf-connecting-ip') ?? clientAddress ?? '0.0.0.0';
}

/** Nunca guardamos la IP en claro */
export const hashIp = (ip: string) => createHash('sha256').update(`${IP_SALT}:${ip}`).digest('hex').slice(0, 32);


export async function verificarTurnstile(token: string | undefined | null, ip: string) {
	if (!token) return false;
	try {
		const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token, remoteip: ip }),
		});
		const j = (await r.json()) as { success?: boolean };
		return !!j.success;
	} catch (e) {
		console.error('[turnstile] verificación fallida', e);
		return false;
	}
}

/**
 * Cuenta un intento y devuelve false si se superó el máximo en la ventana.
 * Una sola sentencia atómica: reinicia la ventana si ya venció.
 */
export async function dentroDelLimite(accion: string, ipHash: string, max = 5, ventanaSeg = 600) {
	const clave = `${accion}:${ipHash}`;
	const hasta = new Date(Date.now() + ventanaSeg * 1000);
	const [fila] = await db
		.insert(tablas.rateLimits)
		.values({ clave, contador: 1, ventanaHasta: hasta })
		.onConflictDoUpdate({
			target: tablas.rateLimits.clave,
			set: {
				contador: sql`case when ${tablas.rateLimits.ventanaHasta} < now() then 1 else ${tablas.rateLimits.contador} + 1 end`,
				ventanaHasta: sql`case when ${tablas.rateLimits.ventanaHasta} < now() then ${hasta.toISOString()}::timestamptz else ${tablas.rateLimits.ventanaHasta} end`,
			},
		})
		.returning({ contador: tablas.rateLimits.contador });
	// De vez en cuando, borrar las ventanas vencidas para que la tabla no crezca sin fin
	if (Math.random() < 0.02) {
		db.delete(tablas.rateLimits)
			.where(lt(tablas.rateLimits.ventanaHasta, sql`now() - interval '1 day'`))
			.catch((e) => console.error('[rate-limit] limpieza fallida', e));
	}
	return (fila?.contador ?? 1) <= max;
}
