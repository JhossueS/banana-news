/** Validación de una nota guardada desde el panel */
import { z } from 'astro/zod';
import { codigosProvincia, dentroDeEcuador } from '../data/provincias.ts';
import { estadoNota, seccion } from '../db/schema.ts';

export const slugValido = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugDe = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
		.replace(/-+$/, '');

const fecha = z.union([z.iso.datetime({ offset: true }), z.iso.datetime({ local: true })]).transform((s) => new Date(s));

export const NotaEntrada = z
	.object({
		titulo: z.string().trim().min(5, 'El título debe tener al menos 5 caracteres.').max(160),
		slug: z.string().trim().max(80).regex(slugValido, 'El enlace solo admite minúsculas, números y guiones.'),
		bajada: z.string().trim().max(400),
		seccion: z.enum(seccion.enumValues),
		fecha,
		actualizado: fecha.nullable(),
		autor: z.string().trim().min(2, 'Indica la firma.').max(120),
		lugar: z.string().trim().max(160),
		imagenId: z.uuid().nullable(),
		alt: z.string().trim().max(300),
		credito: z.string().trim().max(200),
		claves: z.array(z.string().trim().min(1).max(240)).max(6, 'Hasta 6 claves.'),
		estado: z.enum(estadoNota.enumValues).nullable(),
		cuerpo: z.object({ type: z.literal('doc'), content: z.array(z.any()).optional() }).passthrough(),
		lat: z.number().nullable(),
		lon: z.number().nullable(),
		provincia: z
			.string()
			.nullable()
			.refine((c) => c === null || codigosProvincia.includes(c), 'Provincia inválida'),
		ciudad: z.string().trim().max(120),
		publicacion: z.enum(['borrador', 'publicada']),
	})
	.superRefine((d, ctx) => {
		const ubic = [d.lat, d.lon, d.provincia].filter((v) => v !== null).length;
		if (ubic !== 0 && ubic !== 3) ctx.addIssue({ code: 'custom', path: ['provincia'], message: 'Para ubicarla en el mapa completa latitud, longitud y provincia (o deja las tres vacías).' });
		if (d.lat !== null && d.lon !== null && !dentroDeEcuador(d.lat, d.lon)) ctx.addIssue({ code: 'custom', path: ['lat'], message: 'Las coordenadas no están en Ecuador.' });
		if (d.publicacion !== 'publicada') return;
		// Para publicar se exige la nota completa
		if (d.bajada.length < 20) ctx.addIssue({ code: 'custom', path: ['bajada'], message: 'Para publicar, la bajada debe tener al menos 20 caracteres.' });
		if (!d.lugar) ctx.addIssue({ code: 'custom', path: ['lugar'], message: 'Para publicar, indica el lugar.' });
		if (!d.imagenId) ctx.addIssue({ code: 'custom', path: ['imagenId'], message: 'Para publicar, elige la imagen principal.' });
		if (!d.cuerpo.content?.length) ctx.addIssue({ code: 'custom', path: ['cuerpo'], message: 'Para publicar, escribe el texto de la nota.' });
	});

export type NotaEntrada = z.infer<typeof NotaEntrada>;
