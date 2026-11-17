/**
 * Formularios públicos: contacto, denuncia y publicar en el mapa.
 * Cada envío pasa por honeypot, Turnstile y rate limit antes de guardarse.
 */
import { ActionError, defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro/zod';
import { CORREO_DESTINO, SITE_URL } from 'astro:env/server';
import { randomUUID } from 'node:crypto';
import { db, tablas } from '../db/index.ts';
import { site } from '../data/site.ts';
import { codigosProvincia, dentroDeEcuador, nombreProvincia } from '../data/provincias.ts';
import { enviarCorreo } from '../lib/correo.ts';
import { medios } from '../lib/medios.ts';
import { detectarTipo, PREFIJO_PRIVADO } from '../lib/nucleo/medios.ts';
import { purgar, rutas } from '../lib/cache.ts';
import { FotoInvalida, guardarFotoMascota } from '../lib/adopcion.ts';
import { slugMascota, situaciones, especies as especiesMascota, etiquetaEspecie, edadDesde, fechaCorta } from '../lib/mascotas.ts';
import { dentroDelLimite, hashIp, ipDe, verificarTurnstile } from '../lib/seguridad.ts';

const MAX_ADJUNTO = 50 * 1024 * 1024;

/** Campos que agregan Turnstile y el honeypot a todos los formularios */
const antispam = {
	'cf-turnstile-response': z.string().optional(),
	/** Campo oculto: una persona nunca lo llena */
	sitio_web: z.string().optional(),
};

async function filtrar(ctx: ActionAPIContext, accion: string, input: { 'cf-turnstile-response'?: string; sitio_web?: string }) {
	if (input.sitio_web) throw new ActionError({ code: 'BAD_REQUEST', message: 'No pudimos procesar el envío.' });
	let address: string | undefined;
	try {
		address = ctx.clientAddress;
	} catch {
		/* sin dirección en algunos entornos */
	}
	const ip = ipDe(ctx.request, address);
	const ipHash = hashIp(ip);
	if (!(await dentroDelLimite(accion, ipHash))) {
		throw new ActionError({ code: 'TOO_MANY_REQUESTS', message: 'Recibimos varios envíos seguidos desde tu conexión. Espera unos minutos e inténtalo de nuevo.' });
	}
	if (!(await verificarTurnstile(input['cf-turnstile-response'], ip))) {
		throw new ActionError({ code: 'FORBIDDEN', message: 'No pudimos comprobar que no eres un robot. Recarga la página e inténtalo de nuevo.' });
	}
	return ipHash;
}

const buzon = (asunto: string) =>
	CORREO_DESTINO ??
	({ publicidad: site.correos.publicidad, correccion: site.correos.correcciones, datos: site.correos.datos } as Record<string, string>)[asunto] ??
	site.correos.redaccion;

export const server = {
	contacto: defineAction({
		accept: 'form',
		input: z.object({
			nombre: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
			correo: z.email('Escribe un correo válido para poder responderte.').max(200),
			asunto: z.enum(['redaccion', 'publicidad', 'correccion', 'datos', 'otro']),
			mensaje: z.string().trim().min(15, 'Cuéntanos un poco más: al menos una frase completa.').max(5000),
			acepto: z.boolean().refine((v) => v, 'Necesitamos tu autorización para responderte.'),
			...antispam,
		}),
		handler: async (input, ctx) => {
			const ipHash = await filtrar(ctx, 'contacto', input);
			await db.insert(tablas.mensajes).values({ nombre: input.nombre, correo: input.correo, asunto: input.asunto, mensaje: input.mensaje, ipHash });
			await Promise.all([
				enviarCorreo({
					para: buzon(input.asunto),
					asunto: `[Contacto · ${input.asunto}] ${input.nombre}`,
					texto: `${input.nombre} <${input.correo}> escribió:\n\n${input.mensaje}\n\n`,
					responderA: input.correo,
				}),
				enviarCorreo({
					para: input.correo,
					asunto: 'Recibimos tu mensaje · Banana News',
					// Sin datos del formulario: así nadie puede usar este aviso para mandar texto propio a terceros
						texto: 'Hola:\n\nRecibimos tu mensaje y te responderemos lo mas pronto posible. Si no escribiste a Banana News, ignora este correo.\n\n— Banana News',
				}),
			]);
			return { ok: true };
		},
	}),

	denuncia: defineAction({
		accept: 'form',
		input: z.object({
			relato: z.string().trim().min(15, 'Cuéntanos qué pasó con al menos una frase completa.').max(5000),
			lugar: z.string().trim().min(2, 'Indica dónde ocurrió: ciudad, barrio o dirección.').max(200),
			adjunto: z
				.instanceof(File)
				.optional()
				.refine((f) => !f || f.size === 0 || f.size <= MAX_ADJUNTO, 'El archivo pesa más de 50 MB.')
				.refine((f) => !f || f.size === 0 || /^(image|video)\//.test(f.type), 'Solo se admiten fotos.'),
				// El tipo real se comprueba por los bytes del archivo en el handler
			contacto: z.string().trim().max(200).optional(),
			...antispam,
		}),
		handler: async (input, ctx) => {
			const ipHash = await filtrar(ctx, 'denuncia', input);
			let adjuntoKey: string | null = null;
			if (input.adjunto && input.adjunto.size > 0) {
				const bytes = new Uint8Array(await input.adjunto.arrayBuffer());
				// Nunca confiar en el tipo ni en la extensión que manda el navegador (un SVG o HTML podría ejecutar código)
				const real = detectarTipo(bytes);
				if (!real) throw new ActionError({ code: 'BAD_REQUEST', message: 'Solo se admiten fotos (JPG, PNG, WebP, HEIC).' });
				adjuntoKey = `${PREFIJO_PRIVADO}${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${real.ext}`;
				await medios.guardar(adjuntoKey, bytes, real.tipo);
			}
			const contacto = input.contacto || null;
			await db.insert(tablas.denuncias).values({
				relato: input.relato,
				lugar: input.lugar,
				adjuntoKey,
				anonimo: !contacto,
				contacto,
				ipHash,
			});
			await Promise.all([
				purgar(rutas.portada()),
			]);
			return { ok: true };
		},
	}),

	publicarMapa: defineAction({
		accept: 'form',
		input: z.object({
			titular: z.string().trim().min(8, 'Escribe un titular de al menos 8 caracteres.').max(160),
			seccion: z.enum(['Ciudad', 'Política', 'Economía', 'Ambiente', 'Última hora']),
			bajada: z.string().trim().max(400).optional(),
			lat: z.coerce.number(),
			lon: z.coerce.number(),
			provincia: z.string().refine((c) => codigosProvincia.includes(c), 'Elige una provincia de Ecuador.'),
			canton: z.string().trim().max(120).optional(),
			...antispam,
		}),
		handler: async (input, ctx) => {
			if (!dentroDeEcuador(input.lat, input.lon)) {
				throw new ActionError({ code: 'BAD_REQUEST', message: 'Primero elige un punto dentro de Ecuador en el mapa.' });
			}
			const ipHash = await filtrar(ctx, 'mapa', input);
			const ciudad = input.canton || nombreProvincia(input.provincia);
			await db.insert(tablas.reportesMapa).values({
				titular: input.titular,
				seccion: input.seccion,
				bajada: input.bajada ?? '',
				lat: input.lat,
				lon: input.lon,
				provincia: input.provincia,
				canton: input.canton ?? null,
				ciudad,
				ipHash,
			});
			await Promise.all([
				purgar(rutas.mapa()),
			]);
			return { ok: true };
		},
	}),

	/** Ficha de adopción: se guarda como `pendiente` y avisa a la redacción; se publica desde el panel. */
	publicarMascota: defineAction({
		accept: 'form',
		input: z.object({
			nombre: z.string().trim().min(2, 'Escribe el nombre de la mascota.').max(60),
			especie: z.enum(especiesMascota.map((e) => e.id) as [string, ...string[]], 'Elige la especie.'),
			sexo: z.enum(['Hembra', 'Macho'], 'Indica el sexo.'),
			nacimiento: z
				.string()
				.regex(/^\d{4}-\d{2}-\d{2}$/, 'Indica la fecha de nacimiento (aproximada si no la sabes).')
				.refine((f) => !Number.isNaN(Date.parse(f)) && f <= new Date().toISOString().slice(0, 10) && f >= '1990-01-01', 'La fecha de nacimiento no es válida.'),
			ciudad: z.string().trim().min(2, 'Indica la ciudad donde se encuentra.').max(120),
			provincia: z.string().refine((c) => codigosProvincia.includes(c), 'Elige una provincia de Ecuador.'),
			situacion: z.enum(situaciones, 'Indica su situación actual.'),
			peso: z.string().trim().max(40).optional(),
			color: z.string().trim().max(80).optional(),
			chip: z.enum(['Sí', 'No', 'No sé']).optional(),
			condiciones: z.string().trim().max(500).optional(),
			descripcion: z.string().trim().min(30, 'Cuéntanos más sobre su carácter: al menos una o dos frases.').max(1500),
			contactoNombre: z.string().trim().min(2, 'Escribe tu nombre o el de tu organización.').max(120),
			contactoCorreo: z.email('Escribe un correo válido para que te escriban los interesados.').max(200),
			contactoTelefono: z
				.string()
				.trim()
				.max(30)
				.regex(/^[\d+()\s-]*$/, 'El teléfono solo puede llevar números, espacios, + y guiones.')
				.optional(),
			foto: z
				.instanceof(File, { message: 'Sube una foto de la mascota.' })
				.refine((f) => f.size > 0, 'Sube una foto de la mascota.')
				.refine((f) => f.size <= 8 * 1024 * 1024, 'La foto pesa más de 8 MB.'),
			acepto: z.boolean().refine((v) => v, 'Necesitamos tu autorización para publicar estos datos.'),
			...antispam,
		}),
		handler: async (input, ctx) => {
			const ipHash = await filtrar(ctx, 'mascota', input);
			const id = randomUUID();
			let fotoKey: string;
			try {
				fotoKey = await guardarFotoMascota(input.foto, id);
			} catch (e) {
				if (e instanceof FotoInvalida) throw new ActionError({ code: 'BAD_REQUEST', message: e.message });
				throw e;
			}
			try {
				await db.insert(tablas.mascotas).values({
					id,
					slug: slugMascota(input.nombre, id),
					nombre: input.nombre,
					especie: input.especie as 'canina' | 'felina' | 'aves',
					sexo: input.sexo,
					nacimiento: input.nacimiento,
					peso: input.peso || null,
					color: input.color || null,
					chip: input.chip ?? null,
					condiciones: input.condiciones || null,
					descripcion: input.descripcion,
					situacion: input.situacion,
					ciudad: input.ciudad,
					provincia: input.provincia,
					fotoKey,
					contactoNombre: input.contactoNombre,
					contactoCorreo: input.contactoCorreo,
					contactoTelefono: input.contactoTelefono || null,
					autorizaPublicar: true,
					ipHash,
				});
			} catch (e) {
				await medios.borrar(fotoKey).catch(() => {});
				throw e;
			}
			const una = (t: string) => t.replace(/[\r\n]+/g, ' ');
			const texto = [
				`Nueva ficha de adopción pendiente de revisión`,
				``,
				`MASCOTA`,
				`Nombre: ${una(input.nombre)}`,
				`Especie: ${etiquetaEspecie(input.especie as never)}`,
				`Sexo: ${input.sexo}`,
				`Nacimiento: ${fechaCorta(input.nacimiento)} (${edadDesde(input.nacimiento)})`,
				`Ubicación: ${una(input.ciudad)}, ${nombreProvincia(input.provincia)}`,
				`Situación actual: ${input.situacion}`,
				`Peso: ${una(input.peso || '—')}`,
				`Color: ${una(input.color || '—')}`,
				`Chip: ${input.chip ?? '—'}`,
				`Condiciones médicas: ${una(input.condiciones || 'Ninguna conocida')}`,
				``,
				`DESCRIPCIÓN`,
				input.descripcion,
				``,
				`CONTACTO PARA LA ADOPCIÓN (se publicará en la ficha con su autorización)`,
				`Nombre: ${una(input.contactoNombre)}`,
				`Correo: ${input.contactoCorreo}`,
				`Teléfono: ${una(input.contactoTelefono || '—')}`,
			].join('\n');
			await Promise.all([
				enviarCorreo({
					para: buzon('redaccion'),
					asunto: `[Adopción] ${una(input.nombre)} · ${etiquetaEspecie(input.especie as never)}`,
					texto: texto + `\n\nRevisar en el panel: ${new URL('/admin/adopcion', SITE_URL).href}`,
					responderA: input.contactoCorreo,
				}),
				enviarCorreo({
					para: input.contactoCorreo,
					asunto: 'Recibimos la ficha de tu mascota · Banana News',
					// Sin datos del formulario: así nadie puede usar este aviso para mandar texto propio a terceros
					texto: 'Hola:\n\nRecibimos la ficha de la mascota. La revisaremos y te escribiremos antes de publicarla. Si no enviaste este formulario, ignora este correo.\n\n— Banana News',
				}),
			]);
			return { ok: true };
		},
	}),
};
