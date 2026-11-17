/** SEO de adopción: títulos, descripciones y datos estructurados. */
import { absoluta, recortar, tituloSeo } from './seo.ts';
import { edadDesde, tipoMascota, type Mascota } from './mascotas.ts';

export const rutaMascota = (m: { slug: string }) => `/adopcion/${m.slug}/`;

/** «Adopta a Luna, perra de 2 años en Quito» */
export const tituloFicha = (m: Mascota) => tituloSeo(`Adopta a ${m.nombre}, ${tipoMascota(m.especie, m.sexo)} de ${edadDesde(m.nacimiento)} en ${m.ciudad}`);

export const descripcionFicha = (m: Mascota) =>
	recortar(
		`${m.nombre} es ${m.especie === 'aves' || m.sexo === 'Macho' ? 'un' : 'una'} ${tipoMascota(m.especie, m.sexo)} de ${edadDesde(m.nacimiento)} que busca hogar en ${m.ciudad}, ${m.provincia}. ${m.descripcion}`,
		155,
	);

const SITIO = () => ({ '@id': absoluta('/#sitio') });

/** Página de listado (general o por especie): colección con la lista de fichas */
export function listadoSchema({ ruta, nombre, descripcion, mascotas }: { ruta: string; nombre: string; descripcion: string; mascotas: Mascota[] }) {
	return [
		{
			'@type': 'CollectionPage',
			'@id': absoluta(ruta),
			url: absoluta(ruta),
			name: nombre,
			description: descripcion,
			inLanguage: 'es-EC',
			isPartOf: SITIO(),
			mainEntity: {
				'@type': 'ItemList',
				numberOfItems: mascotas.length,
				itemListElement: mascotas.map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluta(rutaMascota(m)), name: m.nombre })),
			},
		},
	];
}

/** Ficha de una mascota. No hay un tipo de rich result para adopciones: se describe honestamente como página con su imagen principal */
export function fichaSchema(m: Mascota) {
	const url = absoluta(rutaMascota(m));
	return [
		{
			'@type': 'WebPage',
			'@id': url,
			url,
			name: tituloFicha(m),
			description: descripcionFicha(m),
			inLanguage: 'es-EC',
			isPartOf: SITIO(),
			...(m.publicado ? { datePublished: m.publicado.toISOString() } : {}),
			...(m.modificado ? { dateModified: m.modificado.toISOString() } : {}),
			...(m.foto ? { primaryImageOfPage: { '@type': 'ImageObject', url: absoluta(m.foto.src), caption: m.foto.alt } } : {}),
			about: { '@type': 'Thing', name: `${m.nombre}, ${tipoMascota(m.especie, m.sexo)} en adopción`, description: m.descripcion },
			contentLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: m.ciudad, addressRegion: m.provincia, addressCountry: 'EC' } },
		},
	];
}
