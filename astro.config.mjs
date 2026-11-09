// @ts-check
import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';

const secreto = (optional = true) => envField.string({ context: 'server', access: 'secret', optional });
/** Config de servidor leída al ARRANCAR (en astro:env, `public` se fija al hacer el build) */
const runtime = (opts = {}) => envField.string({ context: 'server', access: 'secret', ...opts });

// Dominio público: Astro solo confía en X-Forwarded-Host/Proto (Railway, Cloudflare) si coincide con estos patrones
const sitio = new URL(process.env.SITE_URL || 'http://localhost:4321');
const allowedDomains = [
	{ hostname: sitio.hostname, protocol: sitio.protocol.replace(':', '') },
	{ hostname: 'localhost' },
	{ hostname: '127.0.0.1' },
];

// https://astro.build/config
export default defineConfig({
	// Dominio canónico (canonical, og:url, sitemaps). Railway pasa SITE_URL también al build.
	site: sitio.origin,
	// Estáticas por defecto; las dinámicas declaran `export const prerender = false`.
	output: 'static',
	adapter: node({ mode: 'standalone' }),
	security: {
		checkOrigin: true,
		allowedDomains,
		// Las denuncias admiten adjuntos de hasta 50 MB (más el resto del formulario)
		actionBodySizeLimit: 52 * 1024 * 1024,
	},
	env: {
		schema: {
			/* Base de datos y sesiones */
			DATABASE_URL: secreto(),
			BETTER_AUTH_SECRET: secreto(),
			SITE_URL: runtime({ default: 'http://localhost:4321' }),
			/** Sal para el hash de IP de los envíos de lectores */
			IP_SALT: envField.string({ context: 'server', access: 'secret', default: 'bn-dev-salt' }),

			/* Cloudflare R2 (sin estas variables, los archivos se guardan en .data/media) */
			R2_ACCOUNT_ID: secreto(),
			R2_ACCESS_KEY_ID: secreto(),
			R2_SECRET_ACCESS_KEY: secreto(),
			R2_BUCKET: secreto(),
			/** Bucket SIN dominio público para los adjuntos de denuncias (recomendado en producción) */
			R2_BUCKET_PRIVADO: secreto(),
			/** Dominio público del bucket, p. ej. https://media.bananas.news */
			MEDIA_BASE_URL: runtime({ optional: true }),
			/** Usa Cloudflare Image Transformations (/cdn-cgi/image/…) para los srcset */
			MEDIA_TRANSFORMACIONES: envField.boolean({ context: 'server', access: 'secret', default: false }),

			/* Cloudflare Stream (sin estas variables, los videos se guardan como archivo) */
			CF_ACCOUNT_ID: secreto(),
			CF_STREAM_TOKEN: secreto(),
			CF_STREAM_WEBHOOK_SECRET: secreto(),
			/** Subdominio customer-XXXX.cloudflarestream.com */
			CF_STREAM_CUSTOMER_CODE: runtime({ optional: true }),

			/** Secreto que Cloudflare agrega a cada petición (cabecera x-bn-origen): sin él, el origen rechaza
			    la petición. Impide entrar directo a *.up.railway.app saltándose Cloudflare. */
			ORIGEN_SECRETO: secreto(),

			/** Código para crear la primera cuenta de administrador en /admin/configurar/ (mín. 24 caracteres).
			    Solo sirve mientras no existe ninguna cuenta. */
			SETUP_TOKEN: secreto(),

			/* Purga de caché del CDN */
			CF_ZONE_ID: secreto(),
			CF_API_TOKEN: secreto(),

			/* Turnstile: por defecto las claves de prueba de Cloudflare (siempre pasan).
			   La site key va al navegador: se fija en el BUILD (Railway pasa las variables al build). */
			TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public', default: '1x00000000000000000000AA' }),
			TURNSTILE_SECRET: envField.string({ context: 'server', access: 'secret', default: '1x0000000000000000000000000000000AA' }),

			/* Correo (Resend). Sin clave, los correos se escriben en el log */
			RESEND_API_KEY: secreto(),
			CORREO_REMITENTE: runtime({ default: 'Banana News <no-responder@example.com>' }),
			/** Si se define, todos los avisos internos van a este buzón (útil en pruebas) */
			CORREO_DESTINO: runtime({ optional: true }),
		},
	},
});
