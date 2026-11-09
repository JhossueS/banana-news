import { timingSafeEqual } from 'node:crypto';
import { defineMiddleware } from 'astro:middleware';
import { ORIGEN_SECRETO } from 'astro:env/server';
import { configuracion, esDespliegue } from './lib/produccion.ts';

const privada = (p: string) => p === '/admin' || p.startsWith('/admin/') || p.startsWith('/api/admin/');

/** Comparación en tiempo constante del secreto que agrega Cloudflare */
function desdeCloudflare(request: Request) {
	if (!ORIGEN_SECRETO) return true;
	const a = Buffer.from(request.headers.get('x-bn-origen') ?? '');
	const b = Buffer.from(ORIGEN_SECRETO);
	return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Cabeceras de seguridad para las respuestas del servidor. Las páginas estáticas (prerenderizadas) no pasan
 * por aquí: reciben las mismas cabeceras desde la regla de Cloudflare (DEPLOY.md §2).
 * La CSP solo usa directivas que no dependen de los scripts: no se puede enmarcar el sitio, ni cargar plugins,
 * ni cambiar la base de las URLs, ni enviar formularios a otro dominio.
 */
function cabecerasSeguridad(res: Response, panel: boolean) {
	const h = res.headers;
	const marco = panel ? "'none'" : "'self'";
	h.set('Content-Security-Policy', `frame-ancestors ${marco}; object-src 'none'; base-uri 'self'; form-action 'self'${esDespliegue ? '; upgrade-insecure-requests' : ''}`);
	h.set('X-Frame-Options', panel ? 'DENY' : 'SAMEORIGIN');
	h.set('X-Content-Type-Options', 'nosniff');
	h.set('Referrer-Policy', panel ? 'no-referrer' : 'strict-origin-when-cross-origin');
	h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
	if (esDespliegue) h.set('Strict-Transport-Security', 'max-age=31536000');
}

export const onRequest = defineMiddleware(async (ctx, next) => {
	ctx.locals.usuario = null;
	ctx.locals.sesion = null;
	const p = ctx.url.pathname;

	if (!ctx.isPrerendered) {
		// Configuración insegura en producción: no atender (el healthcheck también falla)
		if (configuracion.errores.length) {
			return new Response('Servicio no disponible: revisa los registros del servidor ([seguridad]).', { status: 503, headers: { 'Cache-Control': 'no-store' } });
		}
		// Solo se atiende lo que llega a través de Cloudflare. El healthcheck de Railway entra por la red interna.
		if (p !== '/api/salud' && !desdeCloudflare(ctx.request)) {
			return new Response('Acceso no permitido', { status: 403, headers: { 'Cache-Control': 'no-store' } });
		}
	}

	const res = await responder(ctx, next, p);
	try {
		cabecerasSeguridad(res, privada(p));
	} catch {
		/* algunas respuestas (Response.redirect) tienen cabeceras inmutables */
	}
	return res;
});

async function responder(ctx: Parameters<Parameters<typeof defineMiddleware>[0]>[0], next: () => Promise<Response>, p: string) {
	// Una sola URL por página: /noticias/x → /noticias/x/ (la API, los archivos con extensión y
	// las páginas de error, a las que se llega con Astro.rewrite('/404'), no cambian)
	if (!ctx.isPrerendered && (ctx.request.method === 'GET' || ctx.request.method === 'HEAD') && !p.endsWith('/') && p !== '/404' && p !== '/500' && !p.startsWith('/api/') && !p.startsWith('/_') && !/\.[a-z0-9]+$/i.test(p)) {
		return new Response(null, { status: 301, headers: { Location: `${p}/${ctx.url.search}`, 'Cache-Control': 'public, max-age=3600' } });
	}

	// Las páginas prerenderizadas no tienen cabeceras de request: no tocar la sesión
	if (ctx.isPrerendered || !privada(p)) return next();

	const { auth } = await import('./lib/auth.ts');
	const s = await auth.api.getSession({ headers: ctx.request.headers });
	ctx.locals.usuario = s?.user ?? null;
	ctx.locals.sesion = s?.session ?? null;

	// Ingreso y activación de cuenta (con el enlace de un solo uso) se ven sin sesión
	const sinSesion = ['/admin/login', '/admin/activar'].includes(ctx.url.pathname.replace(/\/$/, ''));
	if (!s && !sinSesion) {
		if (ctx.url.pathname.startsWith('/api/')) return Response.json({ error: 'No autorizado' }, { status: 401 });
		return ctx.redirect(`/admin/login?volver=${encodeURIComponent(ctx.url.pathname)}`);
	}

	const res = await next();
	// Nada del panel se guarda en el CDN ni en el navegador
	res.headers.set('Cache-Control', 'private, no-store');
	res.headers.set('X-Robots-Tag', 'noindex');
	return res;
}
