/** Una nota publicada, con su cuerpo en HTML */
import type { APIRoute } from 'astro';
import { getNoticiaPorSlug } from '../../../../lib/noticias';
import { cachePublico } from '../../../../lib/cache';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
	const n = await getNoticiaPorSlug(params.slug ?? '');
	if (!n) {
		const res = Response.json({ error: 'No existe' }, { status: 404 });
		cachePublico(res.headers, 30, 300);
		return res;
	}
	const { id: _id, modificado: _m, ...publica } = n;
	const res = Response.json(publica);
	cachePublico(res.headers, n.estado === 'ultima-hora' || n.estado === 'en-vivo' ? 60 : 300);
	return res;
};
