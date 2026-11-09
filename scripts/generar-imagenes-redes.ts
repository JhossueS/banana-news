/**
 * Genera las fotos de perfil para redes (YouTube) a partir del trazo del isotipo de src/components/Logo.astro.
 * YouTube: PNG 800 × 800, se muestra recortado en CÍRCULO y a tamaño muy pequeño (hasta ~98 px),
 * así que solo va la banana, centrada y con margen para que el círculo no la corte.
 *  - marca/redes/youtube-perfil-amarillo.png  banana negra sobre amarillo (la más visible en el feed)
 *  - marca/redes/youtube-perfil-negro.png     banana amarilla sobre negro (como el favicon)
 *  - marca/redes/youtube-perfil-vista.png     vista previa de ambas recortadas en círculo
 * Uso: node scripts/generar-imagenes-redes.ts
 */
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const logo = await readFile('src/components/Logo.astro', 'utf8');
const m = /layout === 'isotipo' && <Fragment set:html=\{`([\s\S]*?)`\}/.exec(logo);
if (!m) throw new Error('No encontré el isotipo en Logo.astro');
const banana = m[1];

const AMARILLO = '#FFD52B';
const NEGRO = '#171717';
const LADO = 800;
// Caja del isotipo (viewBox de Logo.astro): 520 × 498. Ocupa ~62 % del lado para quedar dentro del círculo.
const ANCHO = Math.round(LADO * 0.62);
const ALTO = Math.round((ANCHO * 498) / 520);

const perfil = (fondo: string, tinta: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}" viewBox="0 0 ${LADO} ${LADO}">
	<rect width="${LADO}" height="${LADO}" fill="${fondo}"/>
	<svg x="${(LADO - ANCHO) / 2}" y="${(LADO - ALTO) / 2}" width="${ANCHO}" height="${ALTO}" viewBox="280 291 520 498" fill="${tinta}">${banana}</svg>
</svg>`;

await mkdir('marca/redes', { recursive: true });
const variantes = [
	['marca/redes/youtube-perfil-amarillo.png', perfil(AMARILLO, NEGRO)],
	['marca/redes/youtube-perfil-negro.png', perfil(NEGRO, AMARILLO)],
] as const;
for (const [ruta, svg] of variantes) await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(ruta);

// Vista previa: cada variante recortada en círculo a 400 px y a 98 px (tamaño real en el canal)
const circulo = (d: number) => Buffer.from(`<svg width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}"/></svg>`);
const recorte = async (ruta: string, d: number) =>
	sharp(ruta).resize(d, d).composite([{ input: circulo(d), blend: 'dest-in' }]).png().toBuffer();
const capas = [];
for (const [i, [ruta]] of variantes.entries()) {
	capas.push({ input: await recorte(ruta, 400), left: 40 + i * 460, top: 40 });
	capas.push({ input: await recorte(ruta, 98), left: 40 + i * 460 + 151, top: 480 });
}
await sharp({ create: { width: 960, height: 620, channels: 4, background: '#FFFFFF' } }).composite(capas).png().toFile('marca/redes/youtube-perfil-vista.png');

console.log('Listo: marca/redes/youtube-perfil-amarillo.png, youtube-perfil-negro.png y youtube-perfil-vista.png');
