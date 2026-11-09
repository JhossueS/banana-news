/**
 * Sirve los archivos públicos (medios/…) cuando no hay dominio público del bucket (MEDIA_BASE_URL):
 * primero desde .data/media (desarrollo) y si no está, desde R2.
 * Con MEDIA_BASE_URL definido las imágenes salen directo del bucket y esta ruta no se usa.
 * Los adjuntos de denuncias (denuncias/…) nunca se sirven aquí.
 */
import { posix } from 'node:path';
import type { APIRoute } from 'astro';
import { medios } from '../../../lib/medios';
import { PREFIJO_PUBLICO } from '../../../lib/nucleo/medios';

export const prerender = false;

const TIPOS: Record<string, string> = {
	jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif',
	mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
};

export const GET: APIRoute = async ({ params }) => {
	// Normalizar ANTES de validar el prefijo: «medios/../denuncias/x» no debe llegar a los adjuntos privados
	const key = posix.normalize(params.key ?? '');
	if (!key.startsWith(PREFIJO_PUBLICO) || key.includes('..')) return new Response('No existe', { status: 404 });
	const ext = key.split('.').pop()?.toLowerCase() ?? '';
	// Las claves llevan un UUID: el contenido de una clave nunca cambia → caché de un año
	const responder = (cuerpo: Uint8Array<ArrayBuffer>, tipo?: string) =>
		new Response(cuerpo, { headers: { 'Content-Type': TIPOS[ext] ?? tipo ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' } });
	try {
		return responder(new Uint8Array(await medios.leerLocal(key)));
	} catch {
		/* no está en local: probar R2 */
	}
	try {
		const r = await medios.leerR2(key);
		if (r) return responder(new Uint8Array(r.cuerpo), r.tipo);
	} catch (e) {
		console.error('[media] No se pudo leer de R2:', (e as Error).message);
		return new Response('Almacenamiento no disponible', { status: 502, headers: { 'Cache-Control': 'no-store' } });
	}
	return new Response('No existe', { status: 404 });
};
