/** Lista pública de notas publicadas. ?seccion=Ciudad&limit=20 */
import type { APIRoute } from 'astro';
import { listarNoticias } from '../../../lib/noticias';
import { cachePublico } from '../../../lib/cache';

export const prerender = false;

const resumen = (n: Awaited<ReturnType<typeof listarNoticias>>[number]) => ({
	slug: n.slug,
	titulo: n.titulo,
	bajada: n.bajada,
	seccion: n.seccion,
	fecha: n.fecha,
	actualizado: n.actualizado,
	autor: n.autor,
	lugar: n.lugar,
	estado: n.estado,
	imagen: n.imagen,
	url: `/noticias/${n.slug}/`,
});

export const GET: APIRoute = async ({ url }) => {
	const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 50);
	const seccion = url.searchParams.get('seccion') ?? undefined;
	const res = Response.json((await listarNoticias({ limit, seccion })).map(resumen));
	cachePublico(res.headers, 60);
	return res;
};
