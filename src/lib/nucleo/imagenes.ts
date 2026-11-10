/** Optimización de imágenes subidas: genera AVIF y WebP en varios anchos (sin dependencias de Astro). */
import sharp from 'sharp';
import { anchosDe, claveVariante, detectarTipo, esOptimizada, FORMATOS_IMAGEN, type Medios } from './medios.ts';

export class ImagenInvalida extends Error {}

/**
 * Lee el original ya subido, comprueba que sea una imagen de verdad y escribe sus variantes.
 * Devuelve las dimensiones reales (ya con la rotación EXIF aplicada).
 * Los GIF no se tocan (podrían estar animados) y se sirven tal cual.
 */
export async function optimizarImagen(medios: Medios, key: string) {
	const original = await medios.leer(key);
	if (!original?.byteLength) throw new ImagenInvalida('No encontramos el archivo subido.');
	const real = detectarTipo(original);
	if (!real?.tipo.startsWith('image/') || real.tipo === 'image/heic') throw new ImagenInvalida('El archivo no es una imagen válida.');

	if (real.tipo === 'image/gif' || !esOptimizada(key)) {
		const { width, height } = await sharp(original).metadata();
		return { ancho: width ?? null, alto: height ?? null, variantes: false };
	}

	const base = sharp(original, { failOn: 'error' }).rotate();
	const { data: rotada, info } = await base.clone().toBuffer({ resolveWithObject: true });
	for (const w of anchosDe(info.width)) {
		const redim = () => sharp(rotada).resize({ width: w, withoutEnlargement: true });
		const archivos = {
			avif: await redim().avif({ quality: 55, effort: 4 }).toBuffer(),
			webp: await redim().webp({ quality: 78 }).toBuffer(),
		};
		for (const f of FORMATOS_IMAGEN) await medios.guardar(claveVariante(key, w, f), archivos[f], `image/${f}`, true);
	}
	return { ancho: info.width, alto: info.height, variantes: true };
}
