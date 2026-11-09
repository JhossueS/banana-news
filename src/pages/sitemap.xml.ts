/** Sitemap general: páginas fijas, archivo, secciones, firmas y todas las notas publicadas. */
import type { APIRoute } from 'astro';
import { autores, indiceNoticias } from '../lib/noticias';
import { cachePublico } from '../lib/cache';
import { absoluta, hrefAutor, secciones, xml } from '../lib/seo';
import { paginasLegales, paginasMedio } from '../data/site';

export const prerender = false;

const fecha = (d: Date | null | undefined) => (d ? `<lastmod>${d.toISOString()}</lastmod>` : '');
const url = (ruta: string, lastmod?: Date | null) => `<url><loc>${xml(absoluta(ruta))}</loc>${fecha(lastmod)}</url>`;

export const GET: APIRoute = async () => {
	const [notas, firmas] = await Promise.all([indiceNoticias(), autores()]);
	const ultima = notas[0]?.modificado ?? null;
	const ultimaDe = (seccion: string) => notas.find((n) => n.seccion === seccion)?.fecha ?? null;

	const urls = [
		url('/', ultima),
		url('/noticias/', ultima),
		...secciones.map((s) => url(s.href, ultimaDe(s.nombre))),
		...firmas.map((a) => url(hrefAutor(a.autor), a.ultima)),
		...[...paginasMedio, ...paginasLegales].map((p) => url(p.href)),
		url('/publicar/'),
		...notas.map((n) => url(`/noticias/${n.slug}/`, n.modificado > n.fecha ? n.modificado : n.fecha)),
	];

	const res = new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`, {
		headers: { 'Content-Type': 'application/xml; charset=utf-8' },
	});
	cachePublico(res.headers, 600);
	return res;
};
