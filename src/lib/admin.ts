/** Utilidades para los endpoints del panel */
import type { APIContext } from 'astro';
import { puede, type Area } from './roles.ts';

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
export const error = (mensaje: string, status = 400) => json({ error: mensaje }, status);

/** Devuelve una respuesta de error si el usuario no puede entrar al área */
export function exigir(ctx: Pick<APIContext, 'locals'>, area: Area): Response | null {
	const u = ctx.locals.usuario;
	if (!u) return error('No autorizado', 401);
	if (!puede(u.rol, area)) return error('No tienes permiso para esta acción', 403);
	return null;
}

export async function leerJson<T = unknown>(request: Request): Promise<T | null> {
	try {
		return (await request.json()) as T;
	} catch {
		return null;
	}
}
