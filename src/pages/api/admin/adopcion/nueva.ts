/** Alta de una ficha de adopción desde el panel (multipart: datos + foto opcional). */
import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { z } from 'astro/zod';
import { db, tablas } from '../../../../db/index';
import { error, exigir, json } from '../../../../lib/admin';
import { purgar, rutas } from '../../../../lib/cache';
import { codigosProvincia } from '../../../../data/provincias';
import { especies, situaciones, slugMascota } from '../../../../lib/mascotas';
import { FotoInvalida, guardarFotoMascota } from '../../../../lib/adopcion';
import { medios } from '../../../../lib/medios';

export const prerender = false;

const opcional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const Entrada = z.object({
	nombre: z.string().trim().min(2, 'Escribe el nombre.').max(60),
	especie: z.enum(especies.map((e) => e.id) as [string, ...string[]], 'Elige la especie.'),
	sexo: z.enum(['Hembra', 'Macho'], 'Indica el sexo.'),
	nacimiento: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'Indica la fecha de nacimiento.')
		.refine((f) => !Number.isNaN(Date.parse(f)) && f <= new Date().toISOString().slice(0, 10) && f >= '1990-01-01', 'La fecha de nacimiento no es válida.'),
	ciudad: z.string().trim().min(2, 'Indica la ciudad.').max(120),
	provincia: z.string().refine((c) => codigosProvincia.includes(c), 'Elige una provincia.'),
	situacion: z.enum(situaciones, 'Indica la situación actual.'),
	peso: opcional(40),
	color: opcional(80),
	chip: z.enum(['Sí', 'No', 'No sé']).optional().transform((v) => v ?? null),
	condiciones: opcional(500),
	descripcion: z.string().trim().min(30, 'La descripción necesita al menos 30 caracteres.').max(1500),
	contactoNombre: z.string().trim().min(2, 'Escribe el nombre del contacto.').max(120),
	contactoCorreo: z.email('El correo del contacto no es válido.').max(200),
	contactoTelefono: opcional(30),
	publicar: z.string().optional(),
});

export const POST: APIRoute = async (ctx) => {
	const no = exigir(ctx, 'adopcion');
	if (no) return no;
	const form = await ctx.request.formData().catch(() => null);
	if (!form) return error('No pudimos leer el formulario.');
	const p = Entrada.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string')));
	if (!p.success) {
		const i = p.error.issues[0];
		return json({ error: i?.message ?? 'Revisa los datos.', campo: String(i?.path[0] ?? '') }, 400);
	}
	const d = p.data;
	const id = randomUUID();

	let fotoKey: string | null = null;
	const foto = form.get('foto');
	if (foto instanceof File && foto.size > 0) {
		try {
			fotoKey = await guardarFotoMascota(foto, id);
		} catch (e) {
			if (e instanceof FotoInvalida) return json({ error: e.message, campo: 'foto' }, 400);
			throw e;
		}
	}

	const ahora = new Date();
	const publicar = d.publicar === 'on';
	try {
		await db.insert(tablas.mascotas).values({
			id,
			slug: slugMascota(d.nombre, id),
			nombre: d.nombre,
			especie: d.especie as 'canina' | 'felina' | 'aves',
			sexo: d.sexo,
			nacimiento: d.nacimiento,
			peso: d.peso,
			color: d.color,
			chip: d.chip,
			condiciones: d.condiciones,
			descripcion: d.descripcion,
			situacion: d.situacion,
			ciudad: d.ciudad,
			provincia: d.provincia,
			fotoKey,
			contactoNombre: d.contactoNombre,
			contactoCorreo: d.contactoCorreo,
			contactoTelefono: d.contactoTelefono,
			// La redacción deja constancia de que tiene el permiso para publicar el contacto
			autorizaPublicar: true,
			estado: publicar ? 'publicada' : 'pendiente',
			publicadoEn: publicar ? ahora : null,
			revisadoPor: ctx.locals.usuario!.id,
			revisadoEn: ahora,
		});
	} catch (e) {
		if (fotoKey) await medios.borrar(fotoKey).catch(() => {});
		throw e;
	}
	if (publicar) await purgar(rutas.adopcion());
	return json({ ok: true, id, estado: publicar ? 'publicada' : 'pendiente' });
};
