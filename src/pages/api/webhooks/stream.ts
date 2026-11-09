/**
 * Webhook de Cloudflare Stream: marca el video como listo cuando termina de procesarse.
 * Firma: cabecera `Webhook-Signature: time=<ts>,sig1=<hmac-sha256(time + "." + body)>`.
 */
import type { APIRoute } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { CF_STREAM_WEBHOOK_SECRET } from 'astro:env/server';
import { db, tablas } from '../../../db/index';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	if (!CF_STREAM_WEBHOOK_SECRET) return new Response('Webhook no configurado', { status: 404 });
	const body = await request.text();
	const firma = Object.fromEntries((request.headers.get('webhook-signature') ?? '').split(',').map((p) => p.split('=') as [string, string]));
	const time = Number(firma.time);
	if (!firma.sig1 || !time || Math.abs(Date.now() / 1000 - time) > 300) return new Response('Firma inválida', { status: 401 });
	const esperado = createHmac('sha256', CF_STREAM_WEBHOOK_SECRET).update(`${firma.time}.${body}`).digest('hex');
	const a = Buffer.from(esperado);
	const b = Buffer.from(firma.sig1);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response('Firma inválida', { status: 401 });

	const ev = JSON.parse(body) as { uid?: string; readyToStream?: boolean; input?: { width?: number; height?: number } };
	if (ev.uid && ev.readyToStream) {
		await db
			.update(tablas.medios)
			.set({ listo: true, ancho: ev.input?.width ?? null, alto: ev.input?.height ?? null })
			.where(eq(tablas.medios.streamUid, ev.uid));
	}
	return new Response('ok');
};
