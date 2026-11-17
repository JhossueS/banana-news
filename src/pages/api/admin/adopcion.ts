/**
 * Gestión de fichas de adopción.
 * aprobar | rechazar (con motivo) | adoptada | reabrir | editar | borrar
 */
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'astro/zod';
import { db, tablas } from '../../../db/index';
import { error, exigir, json, leerJson } from '../../../lib/admin';
import { purgar, rutas } from '../../../lib/cache';
import { codigosProvincia } from '../../../data/provincias';
import { especies, situaciones } from '../../../lib/mascotas';
import { medios } from '../../../lib/medios';

export const prerender = false;

const opcional = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);

const Entrada = z.discriminatedUnion('accion', [
	z.object({ accion: z.literal('aprobar'), id: z.uuid() }),
	z.object({ accion: z.literal('rechazar'), id: z.uuid(), motivo: z.string().trim().min(3, 'Indica el motivo del rechazo.').max(300) }),
	z.object({ accion: z.literal('adoptada'), id: z.uuid() }),
	z.object({ accion: z.literal('reabrir'), id: z.uuid() }),
	z.object({ accion: z.literal('borrar'), id: z.uuid() }),
	z.object({
		accion: z.literal('editar'),
		id: z.uuid(),
		nombre: z.string().trim().min(2, 'Escribe el nombre.').max(60),
		especie: z.enum(especies.map((e) => e.id) as [string, ...string[]]),
		sexo: z.enum(['Hembra', 'Macho']),
		nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de nacimiento no es válida.'),
		ciudad: z.string().trim().min(2, 'Indica la ciudad.').max(120),
		provincia: z.string().refine((c) => codigosProvincia.includes(c), 'Elige una provincia.'),
		situacion: z.enum(situaciones),
		peso: opcional(40),
		color: opcional(80),
		chip: z.enum(['Sí', 'No', 'No sé']).nullish().transform((v) => v ?? null),
		condiciones: opcional(500),
		descripcion: z.string().trim().min(30, 'La descripción necesita al menos 30 caracteres.').max(1500),
		contactoNombre: z.string().trim().min(2, 'Escribe el nombre del contacto.').max(120),
		contactoCorreo: z.email('El correo no es válido.').max(200),
		contactoTelefono: opcional(30),
	}),
]);

export const POST: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'adopcion');
	if (no) return no;
	const p = Entrada.safeParse(await leerJson(ctx.request));
	if (!p.success) return error(p.error.issues[0]?.message ?? 'Revisa los datos e inténtalo de nuevo.');
	const d = p.data;
	const t = tablas.mascotas;
	const m = await db.query.mascotas.findFirst({ where: eq(t.id, d.id) });
	if (!m) return error('No encontramos la ficha.', 404);
	const revisor = { revisadoPor: ctx.locals.usuario!.id, revisadoEn: new Date() };

	switch (d.accion) {
		case 'aprobar':
			await db.update(t).set({ estado: 'publicada', motivoRechazo: null, publicadoEn: m.publicadoEn ?? new Date(), ...revisor }).where(eq(t.id, m.id));
			break;
		case 'rechazar':
			await db.update(t).set({ estado: 'rechazada', motivoRechazo: d.motivo, ...revisor }).where(eq(t.id, m.id));
			break;
		case 'adoptada':
			await db.update(t).set({ estado: 'adoptada', ...revisor }).where(eq(t.id, m.id));
			break;
		case 'reabrir':
			await db.update(t).set({ estado: 'pendiente', motivoRechazo: null }).where(eq(t.id, m.id));
			break;
		case 'editar': {
			const { accion: _a, id: _i, ...campos } = d;
			await db.update(t).set({ ...campos, especie: campos.especie as 'canina' | 'felina' | 'aves' }).where(eq(t.id, m.id));
			break;
		}
		case 'borrar':
			await db.delete(t).where(eq(t.id, m.id));
			if (m.fotoKey) await medios.borrar(m.fotoKey).catch(() => {});
			break;
	}
	await purgar(rutas.adopcion(m.slug));
	return json({ ok: true });
};
