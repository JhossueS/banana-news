/** Healthcheck para Railway: responde 200 si la app y la base de datos responden. */
import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index';

export const prerender = false;

export const GET: APIRoute = async () => {
	try {
		await db.execute(sql`select 1`);
		return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
	} catch {
		return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
	}
};
