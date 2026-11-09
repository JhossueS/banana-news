/** robots.txt: el panel y la API fuera del índice; las imágenes servidas por /api/media sí se rastrean. */
import type { APIRoute } from 'astro';
import { absoluta } from '../lib/seo';

export const GET: APIRoute = () =>
	new Response(
		[
			'User-agent: *',
			'Allow: /',
			'Allow: /api/media/',
			'Disallow: /admin/',
			'Disallow: /api/',
			'',
			`Sitemap: ${absoluta('/sitemap.xml')}`,
			`Sitemap: ${absoluta('/news-sitemap.xml')}`,
			'',
		].join('\n'),
		{ headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
	);
