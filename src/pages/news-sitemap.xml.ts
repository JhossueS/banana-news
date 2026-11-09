/** Sitemap de Google News: solo las notas de las últimas 48 horas (máximo 1000). */
import type { APIRoute } from 'astro';
import { indiceNoticias } from '../lib/noticias';
import { cachePublico } from '../lib/cache';
import { absoluta, NOMBRE_SITIO, xml } from '../lib/seo';

export const prerender = false;

export const GET: APIRoute = async () => {
	const notas = await indiceNoticias({ desde: new Date(Date.now() - 48 * 3600 * 1000), limit: 1000 });
	const urls = notas.map(
		(n) =>
			`<url><loc>${xml(absoluta(`/noticias/${n.slug}/`))}</loc><news:news><news:publication><news:name>${xml(NOMBRE_SITIO)}</news:name><news:language>es</news:language></news:publication><news:publication_date>${n.fecha.toISOString()}</news:publication_date><news:title>${xml(n.titulo)}</news:title></news:news></url>`,
	);
	const res = new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${urls.join('\n')}\n</urlset>\n`,
		{ headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
	);
	cachePublico(res.headers, 300);
	return res;
};
