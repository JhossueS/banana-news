/** Crea un borrador vacío y devuelve su id (el editor lo abre enseguida). */
import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { db, tablas } from '../../../../db/index';
import { exigir, json } from '../../../../lib/admin';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'notas');
	if (no) return no;
	const [n] = await db
		.insert(tablas.noticias)
		.values({
			slug: `borrador-${randomBytes(4).toString('hex')}`,
			titulo: 'Nota sin título',
			bajada: '',
			seccion: 'Ciudad',
			autor: 'Redacción Banana News',
			autorId: ctx.locals.usuario!.id,
			lugar: '',
			cuerpo: { type: 'doc', content: [{ type: 'paragraph' }] },
		})
		.returning({ id: tablas.noticias.id });
	return json({ id: n!.id }, 201);
};
