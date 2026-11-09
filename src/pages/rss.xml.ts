/** Feed RSS con las 30 notas más recientes. */
import type { APIRoute } from 'astro';
import { indiceNoticias } from '../lib/noticias';
import { cachePublico } from '../lib/cache';
import { absoluta, LEMA, NOMBRE_SITIO, xml } from '../lib/seo';

export const prerender = false;

export const GET: APIRoute = async () => {
	const notas = await indiceNoticias({ limit: 30 });
	const items = notas.map((n) => {
		const link = xml(absoluta(`/noticias/${n.slug}/`));
		return `<item><title>${xml(n.titulo)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><description>${xml(n.bajada)}</description><category>${xml(n.seccion)}</category><dc:creator>${xml(n.autor)}</dc:creator><pubDate>${n.fecha.toUTCString()}</pubDate></item>`;
	});
	const res = new Response(
		`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<title>${xml(NOMBRE_SITIO)}</title>
<link>${xml(absoluta('/'))}</link>
<description>${xml(`${LEMA}. Noticias de Ecuador.`)}</description>
<language>es-EC</language>
<atom:link href="${xml(absoluta('/rss.xml'))}" rel="self" type="application/rss+xml" />
${notas[0] ? `<lastBuildDate>${notas[0].fecha.toUTCString()}</lastBuildDate>` : ''}
${items.join('\n')}
</channel>
</rss>
`,
		{ headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } },
	);
	cachePublico(res.headers, 300);
	return res;
};
