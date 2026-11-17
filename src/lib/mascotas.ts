/** Vocabulario y utilidades de las fichas de adopción. Sin base de datos. */
export type Especie = 'canina' | 'felina' | 'aves';

export const especies: {
	id: Especie;
	/** Texto del chip del filtro */
	texto: string;
	etiqueta: string;
	/** Ruta de la página de la especie: /adopcion/<slug>/ */
	slug: string;
	/** Enlace de navegación y título de la página de la especie */
	titulo: string;
	/** Titular de la página de la especie */
	h1: [string, string];
	bajada: string;
	descripcion: string;
}[] = [
	{
		id: 'canina',
		texto: 'Caninas',
		etiqueta: 'Canina',
		slug: 'perros',
		titulo: 'Perros en adopción',
		h1: ['Adopta un', 'perro'],
		bajada: 'Perros que buscan hogar en Ecuador. Conoce su carácter, su salud y a quién escribir.',
		descripcion: 'Perros en adopción en Ecuador: cachorros y adultos de refugios y rescatistas. Conoce su historia y contacta directo para adoptar.',
	},
	{
		id: 'felina',
		texto: 'Felinas',
		etiqueta: 'Felina',
		slug: 'gatos',
		titulo: 'Gatos en adopción',
		h1: ['Adopta un', 'gato'],
		bajada: 'Gatos que buscan hogar en Ecuador. Conoce su carácter, su salud y a quién escribir.',
		descripcion: 'Gatos en adopción en Ecuador: gatitos y adultos de refugios y rescatistas. Conoce su historia y contacta directo para adoptar.',
	},
	{
		id: 'aves',
		texto: 'Aves',
		etiqueta: 'Ave',
		slug: 'aves',
		titulo: 'Aves en adopción',
		h1: ['Adopta un', 'ave'],
		bajada: 'Aves que buscan hogar en Ecuador. Conoce sus cuidados, su salud y a quién escribir.',
		descripcion: 'Aves en adopción en Ecuador: periquitos, canarios y otras aves que buscan un hogar. Conoce su historia y contacta directo.',
	},
];
export const especiePorSlug = (slug: string) => especies.find((e) => e.slug === slug);

/** «perra», «gato», «ave»: el sustantivo con el género de la ficha, para títulos y descripciones */
export const tipoMascota = (especie: Especie, sexo: string) =>
	especie === 'aves' ? 'ave' : especie === 'canina' ? (sexo === 'Hembra' ? 'perra' : 'perro') : sexo === 'Hembra' ? 'gata' : 'gato';
export const etiquetaEspecie = (id: Especie) => especies.find((e) => e.id === id)?.etiqueta ?? id;

export const situaciones = ['En refugio', 'En hogar temporal', 'Rescatada, en la calle', 'Con su familia actual'] as const;

const hoyEcuador = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());

/** Edad legible a partir de una fecha ISO (AAAA-MM-DD): «2 años», «8 meses», «3 semanas» */
export function edadDesde(nacimiento: string, hoy = hoyEcuador()): string {
	const [y, m, d] = nacimiento.split('-').map(Number);
	const [hy, hm, hd] = hoy.split('-').map(Number);
	let meses = (hy - y) * 12 + (hm - m) - (hd < d ? 1 : 0);
	if (meses < 0) meses = 0;
	if (meses >= 12) {
		const a = Math.floor(meses / 12);
		return a === 1 ? '1 año' : `${a} años`;
	}
	if (meses >= 1) return meses === 1 ? '1 mes' : `${meses} meses`;
	const dias = Math.max(0, Math.round((Date.UTC(hy, hm - 1, hd) - Date.UTC(y, m - 1, d)) / 86400000));
	const semanas = Math.floor(dias / 7);
	return semanas >= 1 ? (semanas === 1 ? '1 semana' : `${semanas} semanas`) : 'Recién nacida';
}

/** «12 mar 2024» */
export function fechaCorta(iso: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
		.format(new Date(Date.UTC(y, m - 1, d)))
		.replace(/\./g, '');
}

/** Ficha lista para mostrar (viene de la tabla `mascotas`) */
export interface Mascota {
	id: string;
	slug: string;
	nombre: string;
	especie: Especie;
	sexo: string;
	/** AAAA-MM-DD */
	nacimiento: string;
	ciudad: string;
	provincia: string;
	situacion: string;
	peso?: string | null;
	color?: string | null;
	/** 'Sí' | 'No' | 'No sé' */
	chip?: string | null;
	/** Vacío = sin condiciones conocidas */
	condicionMedica?: string | null;
	descripcion: string;
	contacto: { nombre: string; correo: string; telefono?: string | null };
	foto?: { src: string; alt: string } | null;
	publicado?: Date | null;
	modificado?: Date | null;
}

export const slugMascota = (nombre: string, id: string) =>
	`${nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mascota'}-${id.slice(0, 4)}`;
