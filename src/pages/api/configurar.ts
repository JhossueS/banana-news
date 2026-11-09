/** Crea la primera cuenta de administrador (ver lib/instalacion.ts). Deja de existir en cuanto hay una cuenta. */
import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { error, json, leerJson } from '../../lib/admin';
import { crearAdminInicial, hayCuentas, tokenConfigurado, tokenCorrecto } from '../../lib/instalacion';
import { dentroDelLimite, hashIp, ipDe } from '../../lib/seguridad';
import { enviarCorreo } from '../../lib/correo';

export const prerender = false;

const Entrada = z.object({
	token: z.string().max(512),
	name: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
	email: z.email('Escribe un correo válido.').max(200),
	password: z.string().min(12, 'La contraseña debe tener al menos 12 caracteres.').max(128, 'La contraseña puede tener hasta 128 caracteres.'),
});

export const POST: APIRoute = async (ctx) => {
	if (await hayCuentas()) return error('No existe', 404);
	if (!tokenConfigurado()) return error('Falta configurar SETUP_TOKEN en el servidor.', 503);

	let address: string | undefined;
	try {
		address = ctx.clientAddress;
	} catch {
		/* sin dirección en algunos entornos */
	}
	if (!(await dentroDelLimite('configurar', hashIp(ipDe(ctx.request, address)), 5, 900))) {
		return error('Demasiados intentos. Espera 15 minutos.', 429);
	}

	const p = Entrada.safeParse(await leerJson(ctx.request));
	if (!p.success) return error(p.error.issues[0]?.message ?? 'Datos inválidos');
	if (!tokenCorrecto(p.data.token)) return error('El código de instalación no es correcto.', 403);

	const creada = await crearAdminInicial(p.data);
	if (!creada) return error('No existe', 404);

	console.info(`[instalacion] Creada la cuenta de administración ${p.data.email.toLowerCase()}`);
	await enviarCorreo({
		para: p.data.email,
		asunto: 'Se creó tu cuenta de administración · Banana News',
		texto: `Hola, ${p.data.name}:\n\nSe creó la cuenta de administración del panel de Banana News con este correo. Ya puedes ingresar en /admin.\n\nSi no fuiste tú, revisa tu servidor de inmediato.\n\n— Banana News`,
	});
	return json({ ok: true }, 201);
};
