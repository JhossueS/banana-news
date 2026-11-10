/** Biblioteca de medios: listar (selector del editor) y registrar un archivo ya subido (paso 2). */
import type { APIRoute } from 'astro';
import { desc, eq, ilike, and, or } from 'drizzle-orm';
import { z } from 'astro/zod';
import { db, tablas } from '../../../../db/index';
import { error, exigir, json, leerJson } from '../../../../lib/admin';
import { medioVista } from '../../../../lib/vistas-admin';
import { PREFIJO_PUBLICO } from '../../../../lib/nucleo/medios';
import { ImagenInvalida, optimizarImagen } from '../../../../lib/nucleo/imagenes';
import { medios as almacen } from '../../../../lib/medios';

export const prerender = false;
const { medios } = tablas;

export const GET: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'medios');
	if (no) return no;
	const tipo = ctx.url.searchParams.get('tipo');
	const q = ctx.url.searchParams.get('q')?.trim();
	const filas = await db
		.select()
		.from(medios)
		.where(
			and(
				tipo === 'imagen' || tipo === 'video' ? eq(medios.tipo, tipo) : undefined,
				q ? or(ilike(medios.alt, `%${q}%`), ilike(medios.credito, `%${q}%`)) : undefined,
			),
		)
		.orderBy(desc(medios.creado))
		.limit(120);
	return json(filas.map(medioVista));
};

const Entrada = z
	.object({
		tipo: z.enum(['imagen', 'video']),
		key: z.string().startsWith(PREFIJO_PUBLICO).max(300).refine((k) => !k.split('/').includes('..'), 'Clave inválida').optional(),
		streamUid: z.string().regex(/^[a-f0-9]{32}$/).optional(),
		ancho: z.number().int().positive().max(20000).nullable().optional(),
		alto: z.number().int().positive().max(20000).nullable().optional(),
		alt: z.string().trim().max(300),
		credito: z.string().trim().max(200),
	})
	.refine((d) => !!d.key !== !!d.streamUid, 'Debe tener key o streamUid')
	.refine((d) => d.tipo === 'video' || d.alt.length >= 5, 'Describe la imagen (texto alternativo) en al menos 5 caracteres.')
	.refine((d) => d.credito.length >= 2, 'Indica el crédito (autor o fuente).');

export const POST: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'medios');
	if (no) return no;
	const p = Entrada.safeParse(await leerJson(ctx.request));
	if (!p.success) return error(p.error.issues[0]?.message ?? 'Revisa los datos e inténtalo de nuevo.');
	const d = p.data;
	let { ancho, alto } = d;
	if (d.tipo === 'imagen' && d.key) {
		try {
			// Genera AVIF y WebP; las medidas reales (con EXIF aplicado) mandan sobre las del navegador
			({ ancho, alto } = await optimizarImagen(almacen, d.key));
		} catch (e) {
			await almacen.borrarImagen(d.key, d.ancho).catch(() => {});
			if (e instanceof ImagenInvalida) return error(e.message);
			console.error('[medios] no se pudo optimizar la imagen', e);
			return error('No pudimos procesar la imagen. Prueba con otro archivo.', 422);
		}
	}
	const [m] = await db
		.insert(medios)
		.values({
			tipo: d.tipo,
			r2Key: d.key ?? null,
			streamUid: d.streamUid ?? null,
			ancho: ancho ?? null,
			alto: alto ?? null,
			alt: d.alt,
			credito: d.credito,
			// Stream procesa el video unos minutos; el webhook (o el botón «comprobar») lo marca listo
			listo: !d.streamUid,
			subidoPor: ctx.locals.usuario!.id,
		})
		.returning();
	return json(medioVista(m!), 201);
};
