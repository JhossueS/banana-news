/** Editar texto alternativo / crédito, comprobar el estado del video o borrar un medio. */
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'astro/zod';
import { db, tablas } from '../../../../db/index';
import { error, exigir, json, leerJson } from '../../../../lib/admin';
import { medioVista } from '../../../../lib/vistas-admin';
import { medios as almacen } from '../../../../lib/medios';

export const prerender = false;
const { medios } = tablas;

const buscar = (id: string) => (z.uuid().safeParse(id).success ? db.query.medios.findFirst({ where: eq(medios.id, id) }) : Promise.resolve(undefined));

/** ?comprobar=1 pregunta a Stream si el video ya está listo */
export const GET: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'medios');
	if (no) return no;
	let m = await buscar(ctx.params.id!);
	if (!m) return error('No existe', 404);
	if (m.streamUid && !m.listo && ctx.url.searchParams.has('comprobar')) {
		const e = await almacen.videoListo(m.streamUid);
		if (typeof e === 'object' && e.listo) {
			[m] = await db.update(medios).set({ listo: true, ancho: e.ancho ?? m.ancho, alto: e.alto ?? m.alto }).where(eq(medios.id, m.id)).returning();
		}
	}
	return json(medioVista(m!));
};

const Cambios = z.object({ alt: z.string().trim().max(300).optional(), credito: z.string().trim().max(200).optional() });

export const PATCH: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'medios');
	if (no) return no;
	const m = await buscar(ctx.params.id!);
	if (!m) return error('No existe', 404);
	const p = Cambios.safeParse(await leerJson(ctx.request));
	if (!p.success) return error('Datos inválidos');
	const [act] = await db.update(medios).set(p.data).where(eq(medios.id, m.id)).returning();
	return json(medioVista(act!));
};

export const DELETE: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'medios');
	if (no) return no;
	const m = await buscar(ctx.params.id!);
	if (!m) return error('No existe', 404);
	const enUso = await db.query.noticias.findFirst({ where: eq(tablas.noticias.imagenId, m.id), columns: { titulo: true } });
	if (enUso) return error(`Es la imagen principal de «${enUso.titulo}». Cámbiala antes de borrarla.`, 409);
	await db.delete(medios).where(eq(medios.id, m.id));
	if (m.r2Key) await almacen.borrar(m.r2Key).catch((e) => console.error('[medios] no se pudo borrar el archivo', e));
	return json({ ok: true });
};
