/**
 * Cambiar el rol, restablecer el acceso o borrar una cuenta.
 * Restablecer quita la contraseña actual, cierra sus sesiones y envía un enlace nuevo: sirve también
 * para bloquear de inmediato una cuenta comprometida.
 */
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'astro/zod';
import { SITE_URL } from 'astro:env/server';
import { db, tablas } from '../../../../db/index';
import { error, exigir, json, leerJson } from '../../../../lib/admin';
import { bloquearAcceso, crearEnlaceAcceso, HORAS_RESTABLECER } from '../../../../lib/cuentas';
import { enviarEnlace } from '../../../../lib/avisos-cuenta';

export const prerender = false;

const Cambios = z.object({ rol: z.enum(tablas.rol.enumValues).optional(), restablecer: z.boolean().optional() });

export const PATCH: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'usuarios');
	if (no) return no;
	const id = ctx.params.id!;
	const u = await db.query.user.findFirst({ where: eq(tablas.user.id, id) });
	if (!u) return error('No encontramos lo que buscas.', 404);
	const p = Cambios.safeParse(await leerJson(ctx.request));
	if (!p.success) return error('Revisa los datos e inténtalo de nuevo.');
	const yo = id === ctx.locals.usuario!.id;
	if (p.data.rol && yo && p.data.rol !== 'admin') return error('No puedes quitarte el rol de administrador.');
	if (p.data.restablecer && yo) return error('Para cambiar tu propia contraseña usa «¿Olvidaste tu contraseña?» en la pantalla de ingreso.');
	if (p.data.rol) await db.update(tablas.user).set({ rol: p.data.rol, updatedAt: new Date() }).where(eq(tablas.user.id, id));
	if (!p.data.restablecer) return json({ ok: true });

	await bloquearAcceso(db, id);
	const enlace = await crearEnlaceAcceso(db, id, HORAS_RESTABLECER, SITE_URL);
	const enviado = await enviarEnlace(u, 'restablecer', enlace);
	return json({ ok: true, enviado, ...(enviado ? {} : { enlace }) });
};

export const DELETE: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'usuarios');
	if (no) return no;
	const id = ctx.params.id!;
	if (id === ctx.locals.usuario!.id) return error('No puedes borrar tu propia cuenta.');
	await db.delete(tablas.verification).where(eq(tablas.verification.value, id));
	await db.delete(tablas.user).where(eq(tablas.user.id, id));
	return json({ ok: true });
};
