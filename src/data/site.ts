/** Datos del medio que aparecen en las páginas institucionales y legales. */
const CORREO = 'contacto@banananews.news';

export const site = {
	nombre: 'Banana News',
	domicilio: 'Quito, Ecuador',
	ciudad: 'Quito',
	/** Un solo buzón para todo; se separan por asunto por si algún día se dividen */
	correos: {
		redaccion: CORREO,
		publicidad: CORREO,
		correcciones: CORREO,
		datos: CORREO,
	},
	horario: 'Lunes a viernes, de 09:00 a 18:00',
	/** Perfiles oficiales. Vacíos = no se muestran en el pie ni en los datos estructurados (sameAs) */
	redes: {
		Instagram: 'https://www.instagram.com/banananewstv/',
		Facebook: 'https://www.facebook.com/banana.news.tv24',
		TikTok: 'https://www.tiktok.com/@banana.newstv',
		X: 'https://x.com/BananaNewsTV',
		youtube: 'https://www.youtube.com/@BananaNews-tv',
	} as Record<string, string>,
	/** Página o portal de ofertas de empleo. Vacío = la portada muestra «Próximamente» con la banana buscando */
	empleosUrl: '',
} as const;

export const redesActivas = Object.entries(site.redes)
	.filter(([, url]) => url)
	.map(([nombre, url]) => ({ nombre, url }));

/** Páginas institucionales y legales, en el orden en que se muestran */
export const paginasMedio = [
	{ href: '/quienes-somos/', label: 'Quiénes somos' },
	{ href: '/publicidad/', label: 'Publicidad' },
	{ href: '/contacto/', label: 'Contacto' },
] as const;

export const paginasLegales = [
	{ href: '/terminos-y-condiciones/', label: 'Términos y condiciones' },
	{ href: '/aviso-legal/', label: 'Aviso legal' },
	{ href: '/politica-de-cookies/', label: 'Política de cookies' },
] as const;
