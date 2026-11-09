/** Sustituto local de la URL presignada de R2: el panel hace PUT del archivo aquí. */
import type { APIRoute } from 'astro';
import { error, exigir, json } from '../../../../lib/admin';
import { medios } from '../../../../lib/medios';
import { PREFIJO_PUBLICO } from '../../../../lib/nucleo/medios';

export const prerender = false;
const MAX = 200 * 1024 * 1024;

export const PUT: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'medios');
	if (no) return no;
	const key = ctx.params.key ?? '';
	if (!medios.local) return error('Solo disponible sin R2', 404);
	if (!key.startsWith(PREFIJO_PUBLICO)) return error('Clave inválida');
	const buf = new Uint8Array(await ctx.request.arrayBuffer());
	if (!buf.byteLength || buf.byteLength > MAX) return error('Archivo vacío o demasiado grande');
	await medios.guardar(key, buf, ctx.request.headers.get('content-type') ?? 'application/octet-stream');
	return json({ ok: true });
};
