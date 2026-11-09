import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { z } from 'astro/zod';
import { db, tablas } from '../../../db/index';
import { error, exigir, json, leerJson } from '../../../lib/admin';

export const prerender = false;

const Entrada = z.object({ id: z.uuid(), estado: z.enum(['nuevo', 'respondido']).optional(), borrar: z.boolean().optional() });

export const POST: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'mensajes');
	if (no) return no;
	const p = Entrada.safeParse(await leerJson(ctx.request));
	if (!p.success) return error('Datos inválidos');
	const t = tablas.mensajes;
	if (p.data.borrar) await db.delete(t).where(eq(t.id, p.data.id));
	else if (p.data.estado) await db.update(t).set({ estado: p.data.estado }).where(eq(t.id, p.data.id));
	return json({ ok: true });
};
