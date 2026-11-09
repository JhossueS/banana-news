import type { APIRoute } from 'astro';
import { puntosMapa } from '../../../lib/noticias';
import { cachePublico } from '../../../lib/cache';

export const prerender = false;

export const GET: APIRoute = async () => {
	const res = Response.json(await puntosMapa());
	cachePublico(res.headers, 30, 600);
	return res;
};
