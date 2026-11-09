/**
 * Comprobaciones al arrancar en producción. Una configuración insegura no debe llegar a atender visitantes:
 * el middleware responde 503 (y el healthcheck falla, así Railway no activa el despliegue).
 * Solo aplica a un despliegue real (build de producción con SITE_URL en https), no a `astro preview` local.
 */
import * as env from 'astro:env/server';
import { TURNSTILE_SITE_KEY } from 'astro:env/client';

export const esDespliegue = import.meta.env.PROD && env.SITE_URL.startsWith('https://');

/** Claves de prueba de Cloudflare Turnstile: empiezan por 1x0000, 2x0000 o 3x0000 */
const esClavePrueba = (k: string) => /^[123]x0000/.test(k);

function revisar() {
	const errores: string[] = [];
	const avisos: string[] = [];
	if (!esDespliegue) return { errores, avisos };

	if (esClavePrueba(env.TURNSTILE_SECRET) || esClavePrueba(TURNSTILE_SITE_KEY)) {
		errores.push('TURNSTILE_SITE_KEY / TURNSTILE_SECRET son las claves de prueba: cualquier envío pasaría el antispam.');
	}
	if (env.IP_SALT === 'bn-dev-salt' || env.IP_SALT.length < 16) {
		errores.push('IP_SALT no está definida (o es corta): genera una con `openssl rand -base64 32`.');
	}
	if (env.R2_BUCKET && env.MEDIA_BASE_URL && !env.R2_BUCKET_PRIVADO) {
		errores.push('Falta R2_BUCKET_PRIVADO: con MEDIA_BASE_URL el bucket principal es público y los adjuntos de denuncias quedarían expuestos.');
	}
	if (env.R2_BUCKET_PRIVADO && env.R2_BUCKET_PRIVADO === env.R2_BUCKET) {
		errores.push('R2_BUCKET_PRIVADO debe ser un bucket distinto de R2_BUCKET.');
	}
	if (!env.ORIGEN_SECRETO) {
		avisos.push('ORIGEN_SECRETO no está definido: se puede entrar directo a *.up.railway.app saltándose Cloudflare (y falsificar la IP del rate limit).');
	}
	return { errores, avisos };
}

export const configuracion = revisar();

for (const a of configuracion.avisos) console.warn(`[seguridad] ${a}`);
for (const e of configuracion.errores) console.error(`[seguridad] CONFIGURACIÓN INSEGURA: ${e}`);
