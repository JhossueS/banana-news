/** Lecturas de fichas de adopción publicadas. */
import { and, desc, eq, ne } from 'drizzle-orm';
import sharp from 'sharp';
import { db, tablas } from '../db/index.ts';
import { medios } from './medios.ts';
import { nombreProvincia } from '../data/provincias.ts';
import { detectarTipo } from './nucleo/medios.ts';
import type { Especie, Mascota } from './mascotas.ts';

type Fila = typeof tablas.mascotas.$inferSelect;

export function vistaMascota(f: Fila): Mascota {
	return {
		id: f.id,
		slug: f.slug,
		nombre: f.nombre,
		especie: f.especie,
		sexo: f.sexo,
		nacimiento: f.nacimiento,
		ciudad: f.ciudad,
		provincia: nombreProvincia(f.provincia) || f.provincia,
		situacion: f.situacion,
		peso: f.peso,
		color: f.color,
		chip: f.chip,
		condicionMedica: f.condiciones,
		descripcion: f.descripcion,
		contacto: { nombre: f.contactoNombre, correo: f.contactoCorreo, telefono: f.contactoTelefono },
		foto: f.fotoKey ? { src: medios.urlImagen(f.fotoKey, 800), alt: `Foto de ${f.nombre}` } : null,
		publicado: f.publicadoEn,
		modificado: f.revisadoEn ?? f.publicadoEn,
	};
}

export async function mascotasPublicadas(limit = 60, especie?: Especie): Promise<Mascota[]> {
	const filas = await db
		.select()
		.from(tablas.mascotas)
		.where(and(eq(tablas.mascotas.estado, 'publicada'), especie ? eq(tablas.mascotas.especie, especie) : undefined))
		.orderBy(desc(tablas.mascotas.publicadoEn))
		.limit(limit);
	return filas.map(vistaMascota);
}

export const MAX_FOTO = 8 * 1024 * 1024;
export class FotoInvalida extends Error {}

/**
 * Valida la foto por sus bytes (nunca por lo que diga el navegador), la reduce a WebP de 1600 px,
 * le quita los metadatos (p. ej. el GPS) y la guarda. Devuelve la clave en el almacenamiento.
 */
export async function guardarFotoMascota(archivo: File, id: string): Promise<string> {
	if (archivo.size > MAX_FOTO) throw new FotoInvalida('La foto pesa más de 8 MB.');
	const bytes = new Uint8Array(await archivo.arrayBuffer());
	const real = detectarTipo(bytes);
	if (!real || !['image/jpeg', 'image/png', 'image/webp'].includes(real.tipo)) throw new FotoInvalida('La foto debe ser JPG, PNG o WebP.');
	let foto: Buffer;
	try {
		foto = await sharp(bytes, { failOn: 'error' }).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
	} catch {
		throw new FotoInvalida('No pudimos leer la foto. Prueba con otra imagen.');
	}
	const key = `medios/mascotas/${id}.webp`;
	await medios.guardar(key, new Uint8Array(foto), 'image/webp', true);
	return key;
}

/** Una ficha por su slug: publicada o ya adoptada (la adoptada se muestra, pero sin indexar). Otros estados: null */
export async function mascotaPorSlug(slug: string): Promise<{ mascota: Mascota; adoptada: boolean } | null> {
	const [f] = await db.select().from(tablas.mascotas).where(eq(tablas.mascotas.slug, slug)).limit(1);
	if (!f || (f.estado !== 'publicada' && f.estado !== 'adoptada')) return null;
	return { mascota: vistaMascota(f), adoptada: f.estado === 'adoptada' };
}

/** Otras fichas publicadas de la misma especie, para enlazar entre sí */
export async function mascotasRelacionadas(especie: Especie, excluirId: string, limit = 3): Promise<Mascota[]> {
	const filas = await db
		.select()
		.from(tablas.mascotas)
		.where(and(eq(tablas.mascotas.estado, 'publicada'), eq(tablas.mascotas.especie, especie), ne(tablas.mascotas.id, excluirId)))
		.orderBy(desc(tablas.mascotas.publicadoEn))
		.limit(limit);
	return filas.map(vistaMascota);
}

/** Entradas del sitemap: fichas publicadas con su foto */
export async function indiceMascotas() {
	return db
		.select({ slug: tablas.mascotas.slug, nombre: tablas.mascotas.nombre, fotoKey: tablas.mascotas.fotoKey, publicado: tablas.mascotas.publicadoEn, revisado: tablas.mascotas.revisadoEn })
		.from(tablas.mascotas)
		.where(eq(tablas.mascotas.estado, 'publicada'))
		.orderBy(desc(tablas.mascotas.publicadoEn));
}
