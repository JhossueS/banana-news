/**
 * Paso 1 de una subida: el panel pide dónde subir el archivo.
 * - Imagen (o video sin Stream): URL presignada de R2 para un PUT directo desde el navegador.
 * - Video con Stream: URL de subida directa de un solo uso (POST multipart desde el navegador).
 */
import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { z } from 'astro/zod';
import { error, exigir, json, leerJson } from '../../../../lib/admin';
import { medios } from '../../../../lib/medios';
import { PREFIJO_PUBLICO } from '../../../../lib/nucleo/medios';

export const prerender = false;

const Entrada = z.object({
	tipo: z.enum(['imagen', 'video']),
	nombre: z.string().max(300),
	contentType: z.string().max(100),
	tamano: z.number().int().positive(),
});

const MAX_IMAGEN = 25 * 1024 * 1024;
const MAX_VIDEO = 2 * 1024 * 1024 * 1024;

export const POST: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'medios');
	if (no) return no;
	const p = Entrada.safeParse(await leerJson(ctx.request));
	if (!p.success) return error('Revisa los datos e inténtalo de nuevo.');
	const { tipo, nombre, contentType, tamano } = p.data;

	if (tipo === 'imagen' && (!/^image\/(jpeg|png|webp|avif|gif)$/.test(contentType) || tamano > MAX_IMAGEN)) {
		return error('Sube una imagen JPG, PNG, WebP, AVIF o GIF de hasta 25 MB.');
	}
	if (tipo === 'video' && !medios.stream) return error('Subir videos estará disponible próximamente. Por ahora usa el botón «+ YouTube» del editor.');
	if (tipo === 'video' && (!contentType.startsWith('video/') || tamano > MAX_VIDEO)) return error('Sube un video de hasta 2 GB.');

	if (tipo === 'video' && medios.stream) {
		// La subida simple de Stream admite hasta 200 MB
		if (tamano > 200 * 1024 * 1024) return error('Con la subida directa, el video puede pesar hasta 200 MB.');
		const { uploadURL, uid } = await medios.crearSubidaStream();
		return json({ modo: 'stream', url: uploadURL, uid });
	}

	const ext = (nombre.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || (tipo === 'imagen' ? 'jpg' : 'mp4');
	const mes = new Date().toISOString().slice(0, 7).replace('-', '/');
	const key = `${PREFIJO_PUBLICO}${mes}/${randomUUID()}.${ext}`;
	return json({ modo: 'put', url: await medios.urlSubida(key, contentType), key, contentType });
};
