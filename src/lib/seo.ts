/** Utilidades de SEO: URLs absolutas, secciones, autores y JSON-LD. */
import { SITE_URL } from 'astro:env/server';
import { seccion as enumSeccion } from '../db/schema.ts';
import { redesActivas, site } from '../data/site.ts';

export const NOMBRE_SITIO = 'Banana News';
export const LEMA = 'La noticia sin cáscara';
/** Imagen 1200 × 630 para redes cuando la página no tiene foto propia */
export const OG_DEFECTO = '/og-default.png';
/** Logotipo cuadrado para el publisher de los datos estructurados */
export const LOGO = '/logo-512.png';

/** URL absoluta con el dominio público (SITE_URL), nunca el host interno del servidor */
export const absoluta = (ruta: string) => new URL(ruta, SITE_URL).href;

/** «Economía» → «economia» */
export const slugificar = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

export type Seccion = (typeof enumSeccion.enumValues)[number];

const descripciones: Record<Seccion, string> = {
	Ciudad: 'Noticias de Quito, Guayaquil, Cuenca y las ciudades de Ecuador: movilidad, servicios, seguridad y vida urbana.',
	Política: 'Noticias de política en Ecuador: Asamblea Nacional, Gobierno, elecciones y decisiones que te afectan, explicadas sin ruido.',
	Economía: 'Noticias de economía en Ecuador: empleo, precios, impuestos, empresas y finanzas públicas, explicadas con claridad.',
	Ecuador: 'Noticias de Ecuador: lo que pasa en las 24 provincias, verificado y contado sin cáscara.',
	Ambiente: 'Noticias de ambiente en Ecuador: volcanes, clima, Amazonía, Galápagos y recursos naturales.',
};

export const secciones = enumSeccion.enumValues.map((nombre) => ({
	nombre,
	slug: slugificar(nombre),
	href: `/seccion/${slugificar(nombre)}/`,
	descripcion: descripciones[nombre],
}));

export const seccionPorSlug = (slug: string) => secciones.find((s) => s.slug === slug);
export const hrefSeccion = (nombre: string) => `/seccion/${slugificar(nombre)}/`;
export const hrefAutor = (autor: string) => `/autor/${slugificar(autor)}/`;

/** Firmas institucionales («Redacción Banana News») se describen como organización, no como persona */
export const esFirmaInstitucional = (autor: string) => /redacci[oó]n|banana news/i.test(autor);

/** JSON seguro dentro de <script>: nadie puede cerrar la etiqueta desde un titular */
export const jsonLd = (datos: unknown) => JSON.stringify(datos).replace(/</g, '\\u003c');

export const organizacion = () => ({
	'@type': 'NewsMediaOrganization',
	'@id': absoluta('/#organizacion'),
	name: NOMBRE_SITIO,
	url: absoluta('/'),
	logo: { '@type': 'ImageObject', url: absoluta(LOGO), width: 512, height: 512 },
	publishingPrinciples: absoluta('/quienes-somos/'),
	correctionsPolicy: absoluta('/quienes-somos/'),
	email: site.correos.redaccion,
	address: { '@type': 'PostalAddress', addressLocality: site.ciudad, addressCountry: 'EC' },
	sameAs: redesActivas.map((r) => r.url),
});

/** Escapa texto para XML (sitemaps y RSS) */
export const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
