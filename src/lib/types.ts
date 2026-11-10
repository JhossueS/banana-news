/** Punto del mapa de noticias. `c` es el código INEC de la provincia. */
export interface MapNews {
	id: string;
	c: string;
	city: string;
	tag: string;
	title: string;
	lat: number;
	lon: number;
	urgent: boolean;
	/** false = enviado por un lector y aún sin verificar */
	verificada: boolean;
	/** slug de la nota completa, si existe */
	nota?: string;
}

/** Imagen lista para pintar: URL base y srcset ya resueltos */
export interface ImagenVista {
	src: string;
	srcset?: string;
	/** <source> por formato (AVIF, WebP) para <picture>; sin ellas, un <img> simple */
	fuentes?: { type: string; srcset: string }[];
	width?: number;
	height?: number;
	alt: string;
}
