/**
 * Datos del medio que aparecen en las páginas institucionales y legales.
 * Los valores entre corchetes son marcadores: reemplázalos por los reales antes de publicar.
 */
export const site = {
	nombre: 'Banana News',
	razonSocial: '[RAZÓN SOCIAL]',
	ruc: '[RUC]',
	domicilio: '[DIRECCIÓN], Quito, Ecuador',
	ciudad: 'Quito',
	correos: {
		redaccion: 'redaccion@[tu-dominio]',
		publicidad: 'publicidad@[tu-dominio]',
		correcciones: 'correcciones@[tu-dominio]',
		datos: 'datos@[tu-dominio]',
	},
	telefono: '[TELÉFONO]',
	horario: 'Lunes a viernes, de 09:00 a 18:00',
} as const;

/** Páginas institucionales y legales, en el orden en que se muestran */
export const paginasMedio = [
	{ href: '/quienes-somos/', label: 'Quiénes somos' },
	{ href: '/publicidad/', label: 'Publicidad' },
	{ href: '/contacto/', label: 'Contacto' },
] as const;

export const paginasLegales = [
	{ href: '/terminos-y-condiciones/', label: 'Términos y condiciones' },
	{ href: '/aviso-legal/', label: 'Aviso legal' },
] as const;
