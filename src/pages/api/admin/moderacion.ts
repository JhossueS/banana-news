/**
 * Moderación de aportes de lectores.
 * mapa:     verificar | rechazar | reabrir | enlazar (a una nota) | borrar
 * denuncia: verificar | rechazar | reabrir | ubicar (crea un punto en el mapa) | borrar
 */
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'astro/zod';
import { db, tablas } from '../../../db/index';
import { error, exigir, json, leerJson } from '../../../lib/admin';
import { purgar, rutas } from '../../../lib/cache';
import { codigosProvincia, dentroDeEcuador, nombreProvincia } from '../../../data/provincias';
import { medios } from '../../../lib/medios';

export const prerender = false;

const Entrada = z.discriminatedUnion('tipo', [
	z.object({
		tipo: z.literal('mapa'),
		id: z.uuid(),
		accion: z.enum(['verificar', 'rechazar', 'reabrir', 'enlazar', 'borrar']),
		notaId: z.uuid().nullable().optional(),
	}),
	z.object({
		tipo: z.literal('denuncia'),
		id: z.uuid(),
		accion: z.enum(['verificar', 'rechazar', 'reabrir', 'ubicar', 'borrar']),
		lat: z.number().optional(),
		lon: z.number().optional(),
		provincia: z.string().optional(),
		ciudad: z.string().trim().max(120).optional(),
	}),
]);

const estadoDe = { verificar: 'verificado', rechazar: 'rechazado', reabrir: 'sin-verificar' } as const;

export const POST: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'moderacion');
	if (no) return no;
	const p = Entrada.safeParse(await leerJson(ctx.request));
	if (!p.success) return error(p.error.issues[0]?.message ?? 'Revisa los datos e inténtalo de nuevo.');
	const d = p.data;

	if (d.tipo === 'mapa') {
		const t = tablas.reportesMapa;
		const r = await db.query.reportesMapa.findFirst({ where: eq(t.id, d.id) });
		if (!r) return error('No encontramos lo que buscas.', 404);
		if (d.accion === 'borrar') await db.delete(t).where(eq(t.id, r.id));
		else if (d.accion === 'enlazar') {
			// Enlazar a una nota publicada la da por verificada
			await db.update(t).set({ notaId: d.notaId ?? null, ...(d.notaId ? { estado: 'verificado' as const } : {}) }).where(eq(t.id, r.id));
		} else await db.update(t).set({ estado: estadoDe[d.accion] }).where(eq(t.id, r.id));
		await purgar(rutas.mapa());
		return json({ ok: true });
	}

	const t = tablas.denuncias;
	const den = await db.query.denuncias.findFirst({ where: eq(t.id, d.id) });
	if (!den) return error('No encontramos lo que buscas.', 404);
	if (d.accion === 'borrar') {
		await db.delete(t).where(eq(t.id, den.id));
		if (den.adjuntoKey) await medios.borrar(den.adjuntoKey).catch(() => {});
	} else if (d.accion === 'ubicar') {
		if (d.lat === undefined || d.lon === undefined || !d.provincia || !codigosProvincia.includes(d.provincia) || !dentroDeEcuador(d.lat, d.lon)) {
			return error('Indica latitud, longitud y provincia dentro de Ecuador.');
		}
		const titular = den.relato.length > 120 ? `${den.relato.slice(0, 117).trimEnd()}…` : den.relato;
		await db.update(t).set({ lat: d.lat, lon: d.lon, provincia: d.provincia }).where(eq(t.id, den.id));
		// El punto hereda el estado de la denuncia
		await db.insert(tablas.reportesMapa).values({
			titular,
			seccion: 'Denuncia',
			lat: d.lat,
			lon: d.lon,
			provincia: d.provincia,
			ciudad: d.ciudad || den.lugar.split(',')[0]?.trim() || nombreProvincia(d.provincia),
			estado: den.estado === 'rechazado' ? 'sin-verificar' : den.estado,
			ipHash: den.ipHash,
		});
		await purgar(rutas.mapa());
	} else await db.update(t).set({ estado: estadoDe[d.accion] }).where(eq(t.id, den.id));
	await purgar(rutas.portada());
	return json({ ok: true });
};
