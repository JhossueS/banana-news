import type { Rol } from '../db/schema.ts';

/** Qué puede hacer cada rol en el panel */
export const permisos = {
	notas: ['admin', 'editor'],
	medios: ['admin', 'editor'],
	moderacion: ['admin', 'moderador', 'editor'],
	mensajes: ['admin', 'editor'],
	usuarios: ['admin'],
} as const satisfies Record<string, readonly Rol[]>;

export type Area = keyof typeof permisos;

export const puede = (rol: string | null | undefined, area: Area) =>
	!!rol && (permisos[area] as readonly string[]).includes(rol);
