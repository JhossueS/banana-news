/** Archivos privados (adjuntos de denuncias): solo con sesión. Con R2 redirige a una URL firmada temporal. */
import type { APIRoute } from 'astro';
import { exigir } from '../../../../lib/admin';
import { medios } from '../../../../lib/medios';
import { PREFIJO_PRIVADO } from '../../../../lib/nucleo/medios';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'moderacion');
	if (no) return no;
	const key = ctx.params.key ?? '';
	if (!key.startsWith(PREFIJO_PRIVADO)) return new Response('No existe', { status: 404 });
	if (!medios.local) return ctx.redirect(await medios.urlPrivada(key), 302);
	try {
		const buf = await medios.leerLocal(key);
		// Siempre como descarga: lo subió un lector y nunca debe ejecutarse en el navegador
		return new Response(new Uint8Array(buf), {
			headers: {
				'Content-Type': 'application/octet-stream',
				'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
				'X-Content-Type-Options': 'nosniff',
				'Cache-Control': 'private, no-store',
			},
		});
	} catch {
		return new Response('No existe', { status: 404 });
	}
};
