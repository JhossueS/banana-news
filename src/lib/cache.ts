/** Cabeceras de caché del CDN y purga en Cloudflare. */
import { CF_API_TOKEN, CF_ZONE_ID, SITE_URL } from 'astro:env/server';
import { secciones } from './seo';

/**
 * El navegador siempre pregunta al CDN (max-age=0); el CDN sirve su copia `sMaxAge` segundos
 * y después la sigue sirviendo mientras la renueva en segundo plano (stale-while-revalidate),
 * o si el origen está caído (stale-if-error).
 */
export function cachePublico(headers: Headers, sMaxAge: number, swr = 86400) {
	headers.set('Cache-Control', `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}, stale-if-error=${swr}`);
	headers.set('CDN-Cache-Control', `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}, stale-if-error=${swr}`);
}

export const sinCache = (headers: Headers) => headers.set('Cache-Control', 'private, no-store');

/** Rutas públicas que dependen de cada tipo de cambio */
export const rutas = {
	nota: (slug: string) => [
		`/noticias/${slug}/`,
		`/api/publica/noticias/${slug}`,
		'/',
		'/api/publica/noticias',
		'/api/publica/mapa',
		// Archivo, secciones y feeds (las firmas y las páginas 2+ se renuevan solas en minutos)
		'/noticias/',
		...secciones.map((s) => s.href),
		'/sitemap.xml',
		'/news-sitemap.xml',
		'/rss.xml',
	],
	mapa: () => ['/', '/api/publica/mapa'],
	portada: () => ['/'],
};

/** Purga URLs en Cloudflare. Sin credenciales (desarrollo) no hace nada. Nunca lanza. */
export async function purgar(paths: string[]) {
	if (!CF_ZONE_ID || !CF_API_TOKEN || !paths.length) {
		if (paths.length) console.info(`[cache] purga simulada: ${paths.join(', ')}`);
		return;
	}
	const files = [...new Set(paths)].map((p) => new URL(p, SITE_URL).href);
	try {
		// La API admite hasta 30 URLs por llamada
		for (let i = 0; i < files.length; i += 30) {
			const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ files: files.slice(i, i + 30) }),
			});
			if (!r.ok) console.error(`[cache] purga falló (${r.status}): ${await r.text()}`);
		}
	} catch (e) {
		console.error('[cache] purga falló', e);
	}
}
