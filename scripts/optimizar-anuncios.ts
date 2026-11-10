/**
 * Convierte los PNG de public/ad a AVIF y WebP (mismo nombre, sin agrandar).
 * Los archivos se nombran por su medida real (la del PNG), no por el nombre con el que llegaron.
 *
 *   node scripts/optimizar-anuncios.ts
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const DIR = 'public/ad';
const redondear = (n: number) => Math.round(n / 10) * 10;

for (const archivo of (await readdir(DIR)).filter((f) => /\.png$/i.test(f))) {
	const origen = join(DIR, archivo);
	const { width, height } = await sharp(origen).metadata();
	const nombre = `${redondear(width!)}x${redondear(height!)}`;
	await sharp(origen).avif({ quality: 60, effort: 6 }).toFile(join(DIR, `${nombre}.avif`));
	await sharp(origen).webp({ quality: 85 }).toFile(join(DIR, `${nombre}.webp`));
	console.log(`${archivo} (${width}×${height}) → ${nombre}.avif / ${nombre}.webp`);
}
