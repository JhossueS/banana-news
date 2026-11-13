/** Anuncios de prueba (public/ad). Generados con `node scripts/optimizar-anuncios.ts`; mismo formato que las imágenes del CMS. */
import type { ImagenVista } from '../lib/types';

const anuncio = (nombre: string, width: number, height: number, alt: string): ImagenVista => ({
	src: `/ad/${nombre}.webp`,
	srcset: `/ad/${nombre}.webp ${width}w`,
	fuentes: [
		{ type: 'image/avif', srcset: `/ad/${nombre}.avif ${width}w` },
		{ type: 'image/webp', srcset: `/ad/${nombre}.webp ${width}w` },
	],
	width,
	height,
	alt,
});

const ALT = 'Tu anuncio aquí';

/** Cuenta de AdSense (ca-pub-…) */
export const ADSENSE_CLIENTE = 'ca-pub-4388895714021060';

/**
 * Número `data-ad-slot` de cada bloque de anuncio creado en AdSense
 * (Anuncios → Por bloque de anuncio → Anuncios de display, a la medida del formato).
 * Vacío = el espacio muestra solo la imagen propia.
 */
export const bloquesAdsense: Record<FormatoAnuncio, string> = {
	rectangulo: '',
	'media-pagina': '',
	'banner-movil': '',
};

export const anuncios = {
	/** Columna lateral de cada nota */
	rectangulo: anuncio('300x250', 300, 250, ALT),
	/** Portada, escritorio, junto a las denuncias */
	'media-pagina': anuncio('300x600', 300, 600, ALT),
	/** Portada, móvil, antes de las denuncias */
	'banner-movil': anuncio('320x100', 320, 100, ALT),
} as const;

export type FormatoAnuncio = keyof typeof anuncios;
