import { relations } from 'drizzle-orm';
import {
	boolean,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';

/* ─── Enums ─────────────────────────────────────────────── */

export const rol = pgEnum('rol', ['admin', 'editor', 'moderador']);
export const seccion = pgEnum('seccion', ['Ciudad', 'Política', 'Economía', 'Ecuador', 'Ambiente']);
export const estadoNota = pgEnum('estado_nota', ['ultima-hora', 'en-vivo', 'analisis', 'verificado', 'contexto', 'alerta']);
export const publicacion = pgEnum('publicacion', ['borrador', 'publicada']);
/** Estado de lo que envían los lectores: se muestra al instante como «sin verificar» */
export const estadoAporte = pgEnum('estado_aporte', ['sin-verificar', 'verificado', 'rechazado']);
export const tipoMedio = pgEnum('tipo_medio', ['imagen', 'video']);
export const estadoMensaje = pgEnum('estado_mensaje', ['nuevo', 'respondido']);

const creado = () => timestamp('creado', { withTimezone: true }).notNull().defaultNow();
const modificado = () =>
	timestamp('modificado', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date());

/* ─── Better Auth (las claves TS siguen los nombres que espera Better Auth) ─── */

export const user = pgTable('auth_user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	rol: rol('rol').notNull().default('editor'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
	'auth_session',
	{
		id: text('id').primaryKey(),
		token: text('token').notNull().unique(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index('auth_session_user_idx').on(t.userId)],
);

export const account = pgTable(
	'auth_account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index('auth_account_user_idx').on(t.userId)],
);

export const verification = pgTable('auth_verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ─── Contenido ─────────────────────────────────────────── */

export const medios = pgTable('medios', {
	id: uuid('id').primaryKey().defaultRandom(),
	tipo: tipoMedio('tipo').notNull(),
	/** Clave del objeto en R2 (imágenes) */
	r2Key: text('r2_key'),
	/** UID del video en Cloudflare Stream */
	streamUid: text('stream_uid'),
	ancho: integer('ancho'),
	alto: integer('alto'),
	alt: text('alt').notNull().default(''),
	credito: text('credito').notNull().default(''),
	/** false mientras Stream procesa el video */
	listo: boolean('listo').notNull().default(true),
	subidoPor: text('subido_por').references(() => user.id, { onDelete: 'set null' }),
	creado: creado(),
});

export const noticias = pgTable(
	'noticias',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slug: text('slug').notNull(),
		titulo: text('titulo').notNull(),
		bajada: text('bajada').notNull(),
		seccion: seccion('seccion').notNull(),
		fecha: timestamp('fecha', { withTimezone: true }).notNull().defaultNow(),
		actualizado: timestamp('actualizado', { withTimezone: true }),
		/** Firma visible («Redacción Banana News»); `autorId` es quien la cargó */
		autor: text('autor').notNull(),
		autorId: text('autor_id').references(() => user.id, { onDelete: 'set null' }),
		lugar: text('lugar').notNull(),
		imagenId: uuid('imagen_id').references(() => medios.id, { onDelete: 'set null' }),
		alt: text('alt').notNull().default(''),
		credito: text('credito').notNull().default(''),
		claves: jsonb('claves').$type<string[]>().notNull().default([]),
		estado: estadoNota('estado'),
		/** Documento TipTap (fuente de verdad del editor) */
		cuerpo: jsonb('cuerpo').$type<Record<string, unknown>>().notNull().default({}),
		/** HTML sanitizado, generado al guardar */
		cuerpoHtml: text('cuerpo_html').notNull().default(''),
		/** Ubicación opcional para el mapa (código INEC de provincia en `provincia`) */
		lat: doublePrecision('lat'),
		lon: doublePrecision('lon'),
		provincia: text('provincia'),
		ciudad: text('ciudad'),
		publicacion: publicacion('publicacion').notNull().default('borrador'),
		creado: creado(),
		modificado: modificado(),
	},
	(t) => [
		uniqueIndex('noticias_slug_idx').on(t.slug),
		index('noticias_publicadas_idx').on(t.publicacion, t.fecha),
	],
);

/* ─── Aportes de lectores ───────────────────────────────── */

export const reportesMapa = pgTable(
	'reportes_mapa',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		titular: text('titular').notNull(),
		seccion: text('seccion').notNull(),
		bajada: text('bajada').notNull().default(''),
		lat: doublePrecision('lat').notNull(),
		lon: doublePrecision('lon').notNull(),
		provincia: text('provincia').notNull(),
		canton: text('canton'),
		ciudad: text('ciudad').notNull().default(''),
		estado: estadoAporte('estado').notNull().default('sin-verificar'),
		notaId: uuid('nota_id').references(() => noticias.id, { onDelete: 'set null' }),
		ipHash: text('ip_hash'),
		creado: creado(),
	},
	(t) => [index('reportes_mapa_estado_idx').on(t.estado, t.creado)],
);

export const denuncias = pgTable(
	'denuncias',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		relato: text('relato').notNull(),
		lugar: text('lugar').notNull(),
		lat: doublePrecision('lat'),
		lon: doublePrecision('lon'),
		provincia: text('provincia'),
		/** Clave en R2 bajo el prefijo privado `denuncias/` */
		adjuntoKey: text('adjunto_key'),
		anonimo: boolean('anonimo').notNull().default(true),
		contacto: text('contacto'),
		estado: estadoAporte('estado').notNull().default('sin-verificar'),
		ipHash: text('ip_hash'),
		creado: creado(),
	},
	(t) => [index('denuncias_estado_idx').on(t.estado, t.creado)],
);

export const mensajes = pgTable(
	'mensajes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		nombre: text('nombre').notNull(),
		correo: text('correo').notNull(),
		asunto: text('asunto').notNull(),
		mensaje: text('mensaje').notNull(),
		estado: estadoMensaje('estado').notNull().default('nuevo'),
		ipHash: text('ip_hash'),
		creado: creado(),
	},
	(t) => [index('mensajes_estado_idx').on(t.estado, t.creado)],
);

/** Ventanas de rate limit por acción e IP (hash) */
export const rateLimits = pgTable('rate_limits', {
	clave: text('clave').primaryKey(),
	contador: integer('contador').notNull().default(0),
	ventanaHasta: timestamp('ventana_hasta', { withTimezone: true }).notNull(),
});

/* ─── Relaciones ────────────────────────────────────────── */

export const noticiasRelations = relations(noticias, ({ one }) => ({
	imagen: one(medios, { fields: [noticias.imagenId], references: [medios.id] }),
	autorUsuario: one(user, { fields: [noticias.autorId], references: [user.id] }),
}));

export const reportesMapaRelations = relations(reportesMapa, ({ one }) => ({
	nota: one(noticias, { fields: [reportesMapa.notaId], references: [noticias.id] }),
}));

export type Rol = (typeof rol.enumValues)[number];
