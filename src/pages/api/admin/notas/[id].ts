/** Guardar (y publicar/despublicar) o borrar una nota. Cada cambio purga sus URLs en el CDN. */
import type { APIRoute } from 'astro';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'astro/zod';
import { db, tablas } from '../../../../db/index';
import { error, exigir, json, leerJson } from '../../../../lib/admin';
import { NotaEntrada } from '../../../../lib/validacion';
import { renderCuerpo } from '../../../../lib/nucleo/render';
import { medios } from '../../../../lib/medios';
import { purgar, rutas } from '../../../../lib/cache';

export const prerender = false;
const { noticias } = tablas;

const buscar = (id: string) => (z.uuid().safeParse(id).success ? db.query.noticias.findFirst({ where: eq(noticias.id, id) }) : Promise.resolve(undefined));

export const PUT: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'notas');
	if (no) return no;
	const actual = await buscar(ctx.params.id!);
	if (!actual) return error('La nota no existe', 404);

	const p = NotaEntrada.safeParse(await leerJson(ctx.request));
	if (!p.success) {
		const i = p.error.issues[0];
		return json({ error: i?.message ?? 'Revisa los datos e inténtalo de nuevo.', campo: i?.path[0] }, 400);
	}
	const d = p.data;

	const choque = await db.query.noticias.findFirst({ where: and(eq(noticias.slug, d.slug), ne(noticias.id, actual.id)), columns: { id: true } });
	if (choque) return json({ error: 'Ya existe otra nota con ese enlace. Cámbialo.', campo: 'slug' }, 409);

	const [guardada] = await db
		.update(noticias)
		.set({ ...d, cuerpoHtml: renderCuerpo(d.cuerpo, medios) })
		.where(eq(noticias.id, actual.id))
		.returning();

	// Purga si la nota es (o era) pública: la nueva URL, y la vieja si cambió el enlace
	const paths: string[] = [];
	if (guardada!.publicacion === 'publicada' || actual.publicacion === 'publicada') paths.push(...rutas.nota(guardada!.slug));
	if (actual.publicacion === 'publicada' && actual.slug !== guardada!.slug) paths.push(...rutas.nota(actual.slug));
	await purgar(paths);

	return json({ ok: true, modificado: guardada!.modificado, slug: guardada!.slug, publicacion: guardada!.publicacion });
};

export const DELETE: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'notas');
	if (no) return no;
	const actual = await buscar(ctx.params.id!);
	if (!actual) return error('La nota no existe', 404);
	await db.delete(noticias).where(eq(noticias.id, actual.id));
	if (actual.publicacion === 'publicada') await purgar(rutas.nota(actual.slug));
	return json({ ok: true });
};
