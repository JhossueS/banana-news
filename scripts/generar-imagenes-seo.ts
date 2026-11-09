/**
 * Genera las imágenes de marca para buscadores y redes a partir de los trazos de src/components/Logo.astro:
 *  - public/og-default.png  (1200 × 630) tarjeta para redes cuando una página no tiene foto
 *  - public/logo-512.png    (512 × 512)  logo del publisher en los datos estructurados e icono táctil
 * Uso: node scripts/generar-imagenes-seo.ts
 */
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const logo = await readFile('src/components/Logo.astro', 'utf8');
const trazos = (layout: string) => {
	const m = new RegExp(`layout === '${layout}' && <Fragment set:html=\\{\`([\\s\\S]*?)\`\\}`).exec(logo);
	if (!m) throw new Error(`No encontré el logo «${layout}» en Logo.astro`);
	return m[1];
};

const AMARILLO = '#FFD52B';
const NEGRO = '#171717';

// Tarjeta OG: logo en bloque (780 × 172 de caja) centrado sobre amarillo, con el lema debajo
const ancho = 860;
const alto = Math.round((ancho * 172) / 780);
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
	<rect width="1200" height="630" fill="${AMARILLO}"/>
	<rect x="0" y="600" width="1200" height="30" fill="${NEGRO}"/>
	<svg x="${(1200 - ancho) / 2}" y="170" width="${ancho}" height="${alto}" viewBox="150 453 780 172" fill="${NEGRO}">${trazos('bloque')}</svg>
	<text x="600" y="470" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-size="44" font-weight="800" fill="${NEGRO}">LA NOTICIA SIN CÁSCARA · ECUADOR</text>
</svg>`;
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile('public/og-default.png');

// Logo cuadrado: banana amarilla sobre negro, como el favicon
const cuadrado = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
	<rect width="512" height="512" fill="${NEGRO}"/>
	<svg x="64" y="64" width="384" height="384" viewBox="280 291 520 498" fill="${AMARILLO}">${trazos('isotipo')}</svg>
</svg>`;
await sharp(Buffer.from(cuadrado)).png({ compressionLevel: 9 }).toFile('public/logo-512.png');

console.log('Listo: public/og-default.png y public/logo-512.png');
