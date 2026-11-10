/** Alta de cuentas: se crea sin contraseña y la persona recibe un enlace para elegir la suya. */
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'astro/zod';
import { SITE_URL } from 'astro:env/server';
import { db, tablas } from '../../../../db/index';
import { error, exigir, json, leerJson } from '../../../../lib/admin';
import { crearCuenta, crearEnlaceAcceso, HORAS_INVITACION } from '../../../../lib/cuentas';
import { enviarEnlace } from '../../../../lib/avisos-cuenta';

export const prerender = false;

const Entrada = z.object({
	email: z.email('Escribe un correo válido.').max(200),
	name: z.string().trim().min(2, 'Escribe el nombre de la persona.').max(120),
	rol: z.enum(tablas.rol.enumValues),
});

export const POST: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'usuarios');
	if (no) return no;
	const p = Entrada.safeParse(await leerJson(ctx.request));
	if (!p.success) return error(p.error.issues[0]?.message ?? 'Revisa los datos e inténtalo de nuevo.');
	const email = p.data.email.toLowerCase();
	const existe = await db.query.user.findFirst({ where: eq(tablas.user.email, email), columns: { id: true } });
	if (existe) return error('Ya existe una cuenta con ese correo.', 409);
	const { id } = await crearCuenta(db, { ...p.data, email });
	const enlace = await crearEnlaceAcceso(db, id, HORAS_INVITACION, SITE_URL);
	const enviado = await enviarEnlace({ email, name: p.data.name }, 'invitacion', enlace);
	// El enlace solo vuelve al panel si no salió por correo (p. ej. sin Resend configurado)
	return json({ id, enviado, ...(enviado ? {} : { enlace }) }, 201);
};
