/** Lecturas públicas: notas publicadas, puntos del mapa y denuncias recientes. */
import { and, count, desc, eq, gt, inArray, ne, isNotNull, sql } from 'drizzle-orm';
import { db, tablas } from '../db/index.ts';
import { medios } from './medios.ts';
import type { ImagenVista, MapNews } from './types.ts';
import { slugificar } from './seo.ts';

const { noticias, reportesMapa, denuncias } = tablas;
type FilaNota = typeof noticias.$inferSelect & { imagen: typeof tablas.medios.$inferSelect | null };

export function imagenVista(m: { r2Key: string | null; ancho: number | null; alto: number | null } | null, alt: string, ancho = 1200): ImagenVista | null {
	if (!m?.r2Key) return null;
	return {
		src: medios.urlImagen(m.r2Key, ancho, m.ancho),
		srcset: medios.srcsetImagen(m.r2Key, m.ancho),
		fuentes: medios.fuentesImagen(m.r2Key, m.ancho)?.sources,
		width: m.ancho ?? undefined,
		height: m.alto ?? undefined,
		alt,
	};
}

function vista(n: FilaNota) {
	const palabras = n.cuerpoHtml.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
	return {
		id: n.id,
		slug: n.slug,
		titulo: n.titulo,
		bajada: n.bajada,
		seccion: n.seccion,
		fecha: n.fecha,
		actualizado: n.actualizado,
		autor: n.autor,
		lugar: n.lugar,
		imagen: imagenVista(n.imagen, n.alt || n.imagen?.alt || ''),
		credito: n.credito || n.imagen?.credito || '',
		claves: n.claves,
		estado: n.estado,
		cuerpoHtml: n.cuerpoHtml,
		palabras,
		minutos: Math.max(1, Math.round(palabras / 220)),
		modificado: n.modificado,
	};
}
export type NotaVista = ReturnType<typeof vista>;

const publicada = eq(noticias.publicacion, 'publicada');

export async function getNoticiaPorSlug(slug: string) {
	const n = await db.query.noticias.findFirst({ where: and(eq(noticias.slug, slug), publicada), with: { imagen: true } });
	return n ? vista(n) : null;
}

export async function listarNoticias({ limit = 20, excluir, seccion }: { limit?: number; excluir?: string; seccion?: string } = {}) {
	const filas = await db.query.noticias.findMany({
		where: and(publicada, excluir ? ne(noticias.id, excluir) : undefined, seccion ? eq(noticias.seccion, seccion as FilaNota['seccion']) : undefined),
		orderBy: desc(noticias.fecha),
		limit,
		with: { imagen: true },
	});
	return filas.map(vista);
}

export const POR_PAGINA = 12;

/** Una página del archivo (todas, por sección o por autor). `pagina` empieza en 1. */
export async function paginaNoticias({ pagina = 1, seccion, autor }: { pagina?: number; seccion?: string; autor?: string } = {}) {
	const filtro = and(
		publicada,
		seccion ? eq(noticias.seccion, seccion as FilaNota['seccion']) : undefined,
		autor ? eq(noticias.autor, autor) : undefined,
	);
	const [filas, [total]] = await Promise.all([
		db.query.noticias.findMany({ where: filtro, orderBy: desc(noticias.fecha), limit: POR_PAGINA, offset: (pagina - 1) * POR_PAGINA, with: { imagen: true } }),
		db.select({ n: count() }).from(noticias).where(filtro),
	]);
	const n = total?.n ?? 0;
	return { notas: filas.map(vista), total: n, paginas: Math.max(1, Math.ceil(n / POR_PAGINA)) };
}

/** Todas las notas publicadas, solo los campos que necesitan los sitemaps y el RSS */
export async function indiceNoticias({ desde, limit = 50000 }: { desde?: Date; limit?: number } = {}) {
	return db
		.select({
			slug: noticias.slug,
			titulo: noticias.titulo,
			bajada: noticias.bajada,
			seccion: noticias.seccion,
			autor: noticias.autor,
			fecha: noticias.fecha,
			actualizado: noticias.actualizado,
			modificado: noticias.modificado,
		})
		.from(noticias)
		.where(and(publicada, desde ? gt(noticias.fecha, desde) : undefined))
		.orderBy(desc(noticias.fecha))
		.limit(limit);
}

/** Firmas con al menos una nota publicada: [{ autor, slug, notas, ultima }] */
export async function autores() {
	const filas = await db
		.select({ autor: noticias.autor, notas: count(), ultima: sql<Date>`max(${noticias.fecha})`.mapWith(noticias.fecha) })
		.from(noticias)
		.where(publicada)
		.groupBy(noticias.autor);
	return filas.map((f) => ({ ...f, slug: slugificar(f.autor) })).filter((f) => f.slug);
}

export async function autorPorSlug(slug: string) {
	return (await autores()).find((a) => a.slug === slug) ?? null;
}

/** Primero las de la misma sección, después las más recientes */
export async function relacionadas(n: NotaVista, limit = 3) {
	const lista = await listarNoticias({ limit: 12, excluir: n.id });
	return lista.sort((a, b) => Number(a.seccion !== n.seccion) - Number(b.seccion !== n.seccion) || b.fecha.valueOf() - a.fecha.valueOf()).slice(0, limit);
}

/** La nota de última hora más reciente de los últimos 2 días, para la barra de la portada */
export async function ultimaHora() {
	const n = await db.query.noticias.findFirst({
		where: and(publicada, inArray(noticias.estado, ['ultima-hora', 'en-vivo', 'alerta']), gt(noticias.fecha, sql`now() - interval '2 days'`)),
		orderBy: desc(noticias.fecha),
	});
	return n ? { titulo: n.titulo, slug: n.slug, estado: n.estado! } : null;
}

const URGENTE = new Set(['ultima-hora', 'en-vivo', 'alerta']);

/** Notas ubicadas (verificadas) + reportes de lectores no rechazados */
export async function puntosMapa(): Promise<MapNews[]> {
	const [notas, reportes] = await Promise.all([
		db
			.select()
			.from(noticias)
			.where(and(publicada, isNotNull(noticias.lat), isNotNull(noticias.lon), isNotNull(noticias.provincia)))
			.orderBy(desc(noticias.fecha))
			.limit(300),
		db.query.reportesMapa.findMany({
			where: ne(reportesMapa.estado, 'rechazado'),
			orderBy: desc(reportesMapa.creado),
			limit: 300,
			with: { nota: { columns: { slug: true, publicacion: true } } },
		}),
	]);
	const deNotas: MapNews[] = notas.map((n) => ({
		id: `n-${n.id}`,
		c: n.provincia!,
		city: n.ciudad || n.lugar.split(',')[0]!.trim(),
		tag: n.seccion,
		title: n.titulo,
		lat: n.lat!,
		lon: n.lon!,
		urgent: !!n.estado && URGENTE.has(n.estado),
		verificada: true,
		nota: n.slug,
	}));
	// Un reporte verificado y enlazado a una nota ya ubicada no se repite
	const ubicadas = new Set(notas.map((n) => n.slug));
	const deReportes: MapNews[] = reportes
		.filter((r) => !(r.nota && r.nota.publicacion === 'publicada' && ubicadas.has(r.nota.slug)))
		.map((r) => ({
			id: `r-${r.id}`,
			c: r.provincia,
			city: r.ciudad || r.canton || '',
			tag: r.seccion,
			title: r.titular,
			lat: r.lat,
			lon: r.lon,
			urgent: false,
			verificada: r.estado === 'verificado',
			nota: r.nota?.publicacion === 'publicada' ? r.nota.slug : undefined,
		}));
	return [...deNotas, ...deReportes];
}

/** Denuncias que se muestran en la portada: sin datos personales */
export async function denunciasRecientes(limit = 3) {
	const filas = await db
		.select({ id: denuncias.id, relato: denuncias.relato, lugar: denuncias.lugar, estado: denuncias.estado, creado: denuncias.creado })
		.from(denuncias)
		.where(ne(denuncias.estado, 'rechazado'))
		.orderBy(desc(denuncias.creado))
		.limit(limit);
	return filas.map((d) => ({
		...d,
		titulo: d.relato.length > 110 ? `${d.relato.slice(0, 107).trimEnd()}…` : d.relato,
	}));
}
