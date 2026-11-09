/**
 * Crea la PRIMERA cuenta de administrador al arrancar, solo si la base no tiene ninguna cuenta.
 * Se activa con ADMIN_INICIAL=correo@dominio (opcional ADMIN_INICIAL_NOMBRE). Lo corre `pnpm start`.
 *
 * Igual que `admin:crear`: la cuenta nace sin contraseña y recibe un enlace de un solo uso (48 h) para elegirla.
 * El enlace se envía por correo (Resend); solo si el correo no sale se escribe en el log del servidor.
 * Cuando ya existe alguna cuenta no hace nada, así que dejar la variable puesta es inofensivo.
 */
import { count } from 'drizzle-orm';
import { crearDb } from '../src/db/client.ts';
import { user } from '../src/db/schema.ts';
import { crearCuenta, crearEnlaceAcceso, HORAS_INVITACION } from '../src/lib/cuentas.ts';

const email = process.env.ADMIN_INICIAL?.trim().toLowerCase();
if (!email) process.exit(0);
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
	console.error(`[admin-inicial] ADMIN_INICIAL no es un correo válido: «${email}». No se crea ninguna cuenta.`);
	process.exit(0);
}
if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
	console.error('[admin-inicial] Falta DATABASE_URL.');
	process.exit(1);
}

const db = await crearDb(process.env.DATABASE_URL);
const [fila] = await db.select({ n: count() }).from(user);
if ((fila?.n ?? 0) > 0) process.exit(0);

const name = process.env.ADMIN_INICIAL_NOMBRE?.trim() || 'Administración';
const siteUrl = process.env.SITE_URL || 'http://localhost:4321';
const { id } = await crearCuenta(db, { email, name, rol: 'admin' });
const enlace = await crearEnlaceAcceso(db, id, HORAS_INVITACION, siteUrl);

async function enviar() {
	const key = process.env.RESEND_API_KEY;
	if (!key) return false;
	try {
		const r = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				from: process.env.CORREO_REMITENTE || 'Banana News <no-responder@example.com>',
				to: [email],
				subject: 'Tu acceso al panel de Banana News',
				text: `Hola, ${name}:\n\nSe creó la cuenta de administración del panel de Banana News. Elige tu contraseña aquí:\n\n${enlace}\n\nEl enlace sirve una sola vez y vence en ${HORAS_INVITACION} horas.\n\n— Banana News`,
			}),
		});
		if (!r.ok) console.error(`[admin-inicial] Resend respondió ${r.status}: ${await r.text()}`);
		return r.ok;
	} catch (e) {
		console.error('[admin-inicial] No se pudo enviar el correo', e);
		return false;
	}
}

if (await enviar()) {
	console.log(`[admin-inicial] Creada la cuenta ${email} (admin). Enviamos el enlace para elegir la contraseña a ese correo.`);
} else {
	// Sin correo: el enlace queda en el log. Es de un solo uso y vence; úsalo cuanto antes.
	console.log(`[admin-inicial] Creada la cuenta ${email} (admin). No se pudo enviar el correo; enlace (un solo uso, vence en ${HORAS_INVITACION} h):\n  ${enlace}`);
}
process.exit(0);
