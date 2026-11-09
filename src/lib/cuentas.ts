/**
 * Alta y acceso de cuentas del panel (sin registro público). Nadie elige ni ve la contraseña de otra persona:
 * cada cuenta recibe un ENLACE de un solo uso, con vencimiento, para poner su propia contraseña.
 * - El enlace usa el mismo token que «restablecer contraseña» de Better Auth (`reset-password:<token>`), así que
 *   lo valida y lo consume Better Auth (POST /api/auth/reset-password).
 * - En la base solo se guarda el hash SHA-256 del identificador (`verification.storeIdentifier: 'hashed'`):
 *   quien lea la tabla no puede usar los enlaces.
 * - El token va en el fragmento (#t=…) de la URL: el navegador nunca lo envía al servidor ni al CDN, ni queda en logs.
 * Sin dependencias de Astro: lo usan también los scripts.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { account, session, user, verification, type Rol } from '../db/schema.ts';

/** Vigencia del enlace para una cuenta nueva y para restablecer el acceso */
export const HORAS_INVITACION = 48;
export const HORAS_RESTABLECER = 2;
export const RUTA_ACTIVAR = '/admin/activar/';

/** Mismo formato que Better Auth con storeIdentifier 'hashed': SHA-256 en base64url sin relleno */
const identificador = (token: string) => createHash('sha256').update(`reset-password:${token}`).digest('base64url');

/** URL que se envía a la persona. El token va en el fragmento, nunca en la ruta ni en la query */
export const urlActivar = (siteUrl: string, token: string) => `${new URL(RUTA_ACTIVAR, siteUrl).href}#t=${token}`;

/** Crea la cuenta SIN contraseña: no puede ingresar hasta que use su enlace */
export async function crearCuenta(db: Db, { email, name, rol }: { email: string; name: string; rol: Rol }) {
	const id = randomUUID();
	await db.insert(user).values({ id, email: email.toLowerCase(), name, rol, emailVerified: true });
	return { id };
}

/** Genera un enlace nuevo (invalida los anteriores de esa cuenta) y devuelve su URL */
export async function crearEnlaceAcceso(db: Db, userId: string, horas: number, siteUrl: string) {
	const token = randomBytes(32).toString('base64url');
	await db.delete(verification).where(eq(verification.value, userId));
	await db.insert(verification).values({
		id: randomUUID(),
		identifier: identificador(token),
		value: userId,
		expiresAt: new Date(Date.now() + horas * 3600_000),
	});
	return urlActivar(siteUrl, token);
}

/** Quita la contraseña y cierra todas las sesiones: la cuenta queda bloqueada hasta que use un enlace nuevo */
export async function bloquearAcceso(db: Db, userId: string) {
	await db.delete(account).where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));
	await db.delete(session).where(eq(session.userId, userId));
}

/** IDs de las cuentas que ya tienen contraseña (las demás están pendientes de activar) */
export async function cuentasActivas(db: Db) {
	const filas = await db.select({ userId: account.userId }).from(account).where(eq(account.providerId, 'credential'));
	return new Set(filas.map((f) => f.userId));
}
