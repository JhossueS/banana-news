/** Editor de notas del panel: TipTap + metadatos + imagen principal + guardar/publicar. */
import { Editor, type JSONContent } from '@tiptap/core';
import { extensiones, leerYoutube, type AttrsImagen, type AttrsVideo, type AttrsYoutube } from '../../lib/editor/extensiones';
import { api, ErrorApi, say } from './api';
import { elegirMedio } from './selector';
import { confirmar, pedir } from './modal';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
import type { MedioVista } from './subir';
import { iniciarCalidad } from './calidad';

interface Datos {
	id: string;
	slug: string;
	cuerpo: JSONContent;
	imagen: MedioVista | null;
	publicacion: 'borrador' | 'publicada';
}

const datos = JSON.parse(document.getElementById('nota-data')!.textContent!) as Datos;
const form = document.getElementById('form-nota') as HTMLFormElement;
const status = document.getElementById('ed-status');
const guardadoEl = document.getElementById('ed-guardado');
const campo = <T extends HTMLElement = HTMLInputElement>(name: string) => form.elements.namedItem(name) as unknown as T;

let imagen = datos.imagen;
let sucio = false;
const marcarSucio = () => {
	sucio = true;
	if (guardadoEl) guardadoEl.textContent = 'Cambios sin guardar';
};

/* ── Editor ── */
const doc = datos.cuerpo?.type === 'doc' ? datos.cuerpo : { type: 'doc', content: [{ type: 'paragraph' }] };
const editor = new Editor({
	element: document.getElementById('editor')!,
	extensions: extensiones,
	content: doc,
	onUpdate: marcarSucio,
});

const botones = Array.from(document.querySelectorAll<HTMLButtonElement>('.ed-tools [data-cmd]'));
const activo: Record<string, () => boolean> = {
	bold: () => editor.isActive('bold'),
	italic: () => editor.isActive('italic'),
	h2: () => editor.isActive('heading', { level: 2 }),
	h3: () => editor.isActive('heading', { level: 3 }),
	bulletList: () => editor.isActive('bulletList'),
	orderedList: () => editor.isActive('orderedList'),
	blockquote: () => editor.isActive('blockquote'),
	link: () => editor.isActive('link'),
};
const pintarBotones = () => botones.forEach((b) => activo[b.dataset.cmd!] && b.setAttribute('aria-pressed', String(activo[b.dataset.cmd!]!())));
editor.on('transaction', pintarBotones);

/** Pie de foto / descripción con el modal del panel. null = cancelado */
async function pedirPie(titulo: string, valor = '') {
	const v = await pedir({
		titulo,
		aceptar: 'Guardar',
		campos: [{ name: 'pie', label: 'Pie', valor, placeholder: 'Qué se ve, dónde y cuándo' }],
	});
	return v ? v.pie : null;
}

async function insertarMedio(tipo: 'imagen' | 'video') {
	const m = await elegirMedio(tipo);
	if (!m) return editor.commands.focus();
	const pie = (await pedirPie(tipo === 'imagen' ? 'Pie de foto' : 'Descripción del video')) ?? '';
	if (tipo === 'imagen') {
		const attrs: AttrsImagen = { medioId: m.id, key: m.key ?? '', ancho: m.ancho, alto: m.alto, alt: m.alt, credito: m.credito, pie, src: m.vista };
		editor.chain().focus().insertContent({ type: 'imagenBloque', attrs }).run();
	} else {
		const attrs: AttrsVideo = { medioId: m.id, streamUid: m.streamUid, key: m.streamUid ? null : m.key, pie, credito: m.credito, poster: m.vista };
		editor.chain().focus().insertContent({ type: 'videoBloque', attrs }).run();
	}
}

const minutos = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

async function insertarYoutube() {
	const v = await pedir({
		titulo: 'Insertar video de YouTube',
		aceptar: 'Insertar video',
		campos: [
			{ name: 'enlace', label: 'Enlace del video', tipo: 'url', requerido: true, placeholder: 'https://youtu.be/…', ayuda: 'Pega el enlace de YouTube.' },
			{ name: 'pie', label: 'Descripción', placeholder: 'Ej.: Rueda de prensa del alcalde' },
		],
		validar: (v) => (leerYoutube(v.enlace!) ? null : { campo: 'enlace', mensaje: 'Ese enlace no es de un video de YouTube.' }),
		alCambiar: (v, extra) => {
			const yt = v.enlace ? leerYoutube(v.enlace) : null;
			extra.innerHTML = yt
				? `<div class="a-modal-vista"><img src="https://i.ytimg.com/vi/${yt.videoId}/mqdefault.jpg" alt=""><span>Video encontrado${yt.inicio ? ` · empieza en ${minutos(yt.inicio)}` : ''}</span></div>`
				: v.enlace
					? '<div class="a-modal-vista a-modal-vista--error">Todavía no reconozco un video de YouTube en ese enlace.</div>'
					: '';
		},
	});
	if (!v) return editor.commands.focus();
	const attrs: AttrsYoutube = { ...leerYoutube(v.enlace!)!, pie: v.pie ?? '' };
	editor.chain().focus().insertContent({ type: 'youtubeBloque', attrs }).run();
}

async function insertarCita() {
	// Dentro de una cita, el botón la quita entera (texto y autor)
	if (editor.isActive('blockquote')) {
		const { $from } = editor.state.selection;
		for (let d = $from.depth; d > 0; d--) {
			if ($from.node(d).type.name !== 'blockquote') continue;
			return editor.chain().focus().setTextSelection({ from: $from.start(d), to: $from.end(d) }).lift('blockquote').run();
		}
	}
	const { from, to } = editor.state.selection;
	const v = await pedir({
		titulo: 'Insertar cita',
		aceptar: 'Insertar cita',
		campos: [
			{ name: 'texto', label: 'Texto de la cita', tipo: 'textarea', requerido: true, valor: editor.state.doc.textBetween(from, to, '\n').trim(), placeholder: 'Las palabras textuales, sin comillas', ayuda: 'Escribe las palabras tal cual, sin comillas.' },
			{ name: 'autor', label: 'Quién lo dice', placeholder: 'Ej.: María Pérez, vocera del COE' },
		],
	});
	if (!v) return editor.commands.focus();
	const texto = v.texto!.replace(/^[«“"']+|[»”"']+$/g, '').trim();
	const content: JSONContent[] = texto.split(/\n+/).map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t.trim() }] }));
	if (v.autor) content.push({ type: 'paragraph', content: [{ type: 'text', text: `— ${v.autor}`, marks: [{ type: 'italic' }] }] });
	editor.chain().focus().insertContentAt({ from, to }, { type: 'blockquote', content }).run();
	// Dejar el cursor en un párrafo normal debajo de la cita (no dentro ni en cursiva)
	const { $from } = editor.state.selection;
	for (let d = $from.depth; d > 0; d--) {
		if ($from.node(d).type.name !== 'blockquote') continue;
		const fin = $from.after(d);
		const sig = editor.state.doc.nodeAt(fin);
		if (sig?.type.name === 'paragraph') editor.chain().setTextSelection(fin + 1).unsetAllMarks().run();
		else editor.chain().insertContentAt(fin, { type: 'paragraph' }).setTextSelection(fin + 1).run();
		break;
	}
}

/** Acepta «ejemplo.com», «https://…», «mailto:…»; devuelve null si no es válido */
function normalizarUrl(s: string) {
	const t = s.trim();
	const conEsquema = /^(https?:|mailto:)/i.test(t) ? t : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? `mailto:${t}` : `https://${t}`;
	try {
		const u = new URL(conEsquema);
		return (u.protocol === 'mailto:' || u.hostname.includes('.')) ? u.href : null;
	} catch {
		return null;
	}
}

async function editarEnlace() {
	const prev = editor.getAttributes('link').href as string | undefined;
	const { from, to, empty } = editor.state.selection;
	const pedirTexto = empty && !prev;
	const v = await pedir({
		titulo: prev ? 'Editar enlace' : 'Agregar enlace',
		aceptar: prev ? 'Guardar' : 'Agregar enlace',
		secundaria: prev ? 'Quitar enlace' : undefined,
		campos: [
			{ name: 'url', label: 'Dirección', tipo: 'url', requerido: true, valor: prev ?? '', placeholder: 'https://…' },
			...(pedirTexto ? [{ name: 'texto', label: 'Texto que se verá', requerido: true, placeholder: 'Ej.: el informe completo' }] : []),
		],
		validar: (v) => (normalizarUrl(v.url!) ? null : { campo: 'url', mensaje: 'Esa dirección no es válida.' }),
	});
	if (!v) return editor.commands.focus();
	if (v.accion === 'secundaria') return editor.chain().focus().extendMarkRange('link').unsetLink().run();
	const href = normalizarUrl(v.url!)!;
	if (pedirTexto) {
		editor.chain().focus().insertContentAt(from, { type: 'text', text: v.texto!, marks: [{ type: 'link', attrs: { href } }] }).run();
	} else {
		editor.chain().focus().setTextSelection({ from, to }).extendMarkRange('link').setLink({ href }).run();
	}
}

const comandos: Record<string, () => unknown> = {
	bold: () => editor.chain().focus().toggleBold().run(),
	italic: () => editor.chain().focus().toggleItalic().run(),
	h2: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
	h3: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
	bulletList: () => editor.chain().focus().toggleBulletList().run(),
	orderedList: () => editor.chain().focus().toggleOrderedList().run(),
	blockquote: insertarCita,
	link: editarEnlace,
	imagen: () => insertarMedio('imagen'),
	video: () => insertarMedio('video'),
	youtube: insertarYoutube,
	undo: () => editor.chain().focus().undo().run(),
	redo: () => editor.chain().focus().redo().run(),
};
botones.forEach((b) => {
	// Que la barra no le quite el foco (ni la selección) al editor
	b.addEventListener('mousedown', (e) => e.preventDefault());
	b.addEventListener('click', () => comandos[b.dataset.cmd!]?.());
});

// Doble clic en una imagen o video: editar su pie
editor.view.dom.addEventListener('dblclick', async (e) => {
	const fig = (e.target as HTMLElement).closest('figure');
	if (!fig) return;
	const pos = editor.view.posAtDOM(fig, 0);
	const node = editor.state.doc.nodeAt(pos) ?? editor.state.doc.nodeAt(pos - 1);
	if (!node || !['imagenBloque', 'videoBloque', 'youtubeBloque'].includes(node.type.name)) return;
	const at = editor.state.doc.nodeAt(pos)?.type === node.type ? pos : pos - 1;
	const pie = await pedirPie(node.type.name === 'imagenBloque' ? 'Editar pie de foto' : 'Editar descripción del video', node.attrs.pie ?? '');
	if (pie === null) return editor.commands.focus();
	editor.chain().focus().command(({ tr }) => {
		tr.setNodeMarkup(at, undefined, { ...node.attrs, pie });
		return true;
	}).run();
});

/* ── Imagen principal ── */
const repintarCalidad = iniciarCalidad({ form, editor, imagen: () => imagen });
const vista = document.getElementById('portada-vista')!;
const pintarPortada = () => {
	vista.innerHTML = imagen?.vista ? `<img src="${imagen.vista}" alt="">` : 'Sin imagen';
};
pintarPortada();
document.getElementById('btn-portada')!.addEventListener('click', async () => {
	const m = await elegirMedio('imagen');
	if (!m) return;
	imagen = m;
	pintarPortada();
	repintarCalidad();
	marcarSucio();
});
document.getElementById('btn-portada-quitar')!.addEventListener('click', () => {
	imagen = null;
	pintarPortada();
	repintarCalidad();
	marcarSucio();
});

/* ── Enlace (slug) ── */
const slugDe = (s: string) =>
	s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
const slugInput = campo('slug');
const tituloInput = campo('titulo');
// Mientras sea borrador y nadie haya escrito el enlace a mano, se deriva del título
let slugAuto = datos.publicacion === 'borrador' && (!slugInput.value || slugInput.value === slugDe(tituloInput.value));
tituloInput.addEventListener('input', () => {
	if (slugAuto) slugInput.value = slugDe(tituloInput.value);
});
slugInput.addEventListener('input', () => (slugAuto = false));
form.addEventListener('input', marcarSucio);

/* ── Guardar ── */
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
const fecha = (v: string) => (v ? new Date(`${v}:00-05:00`).toISOString() : null);

function recoger(publicacion: 'borrador' | 'publicada') {
	const v = (n: string) => campo<HTMLInputElement>(n).value.trim();
	// Las coordenadas pegadas de Google Maps vienen juntas: «-0.18, -78.46»
	let lat = v('lat');
	let lon = v('lon');
	const par = lat.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
	if (par) {
		[lat, lon] = [par[1]!, par[2]!];
		campo('lat').value = lat;
		campo('lon').value = lon;
	}
	return {
		titulo: v('titulo'),
		slug: v('slug') || slugDe(v('titulo')) || datos.slug,
		bajada: v('bajada'),
		seccion: v('seccion'),
		fecha: fecha(v('fecha')) ?? new Date().toISOString(),
		actualizado: fecha(v('actualizado')),
		autor: v('autor'),
		lugar: v('lugar'),
		imagenId: imagen?.id ?? null,
		alt: v('alt'),
		credito: v('credito'),
		claves: v('claves').split('\n').map((s) => s.trim()).filter(Boolean),
		estado: v('estado') || null,
		cuerpo: editor.getJSON(),
		lat: num(lat),
		lon: num(lon),
		provincia: v('provincia') || null,
		ciudad: v('ciudad'),
		publicacion,
	};
}

function limpiarErrores() {
	form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
	form.querySelectorAll('[data-invalid]').forEach((e) => e.removeAttribute('data-invalid'));
}

async function guardar(publicacion: 'borrador' | 'publicada', boton?: HTMLButtonElement) {
	limpiarErrores();
	const cuerpo = recoger(publicacion);
	if (boton) boton.setAttribute('aria-busy', 'true');
	say(status, 'Guardando…');
	try {
		const r = await api<{ slug: string; publicacion: string }>(`/api/admin/notas/${datos.id}`, 'PUT', cuerpo);
		sucio = false;
		const cambioEstado = r.publicacion !== datos.publicacion;
		if (!slugInput.value) slugInput.value = r.slug;
		if (cambioEstado) {
			// Recargar para mostrar el estado y los botones correctos
			location.reload();
			return;
		}
		say(status, publicacion === 'publicada' ? 'Guardado. El sitio se actualiza en segundos.' : 'Borrador guardado.', 'ok');
		if (guardadoEl) guardadoEl.textContent = `Guardado a las ${new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`;
	} catch (e) {
		const err = e as ErrorApi;
		say(status, err.message, 'error');
		if (err.campo) {
			const el = form.querySelector<HTMLElement>(`[name="${err.campo}"]`);
			if (el) {
				el.setAttribute('aria-invalid', 'true');
				el.focus();
			} else form.querySelector(`[data-campo="${err.campo}"]`)?.setAttribute('data-invalid', '');
		}
	} finally {
		boton?.removeAttribute('aria-busy');
	}
}

form.addEventListener('submit', (e) => {
	e.preventDefault();
	guardar(datos.publicacion, (e as SubmitEvent).submitter as HTMLButtonElement);
});
form.addEventListener('click', async (e) => {
	const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-accion]');
	if (!b) return;
	const accion = b.dataset.accion;
	if (accion === 'publicar') {
		// El modal repite la lista de calidad: con faltantes no deja publicar; con sugerencias, sí
		const lista = document.getElementById('cal-lista')!;
		const resumen = document.getElementById('cal-resumen')!.textContent ?? '';
		const bloqueada = !!lista.querySelector('[data-nivel="falta"]');
		const r = await pedir({
			titulo: 'Publicar nota',
			campos: [],
			aceptar: 'Publicar ahora',
			validar: () => (bloqueada ? { campo: '', mensaje: 'Completa lo que falta antes de publicar.' } : null),
			alCambiar: (_, extra) => {
				extra.innerHTML = `<p><strong>${esc(resumen)}</strong> Al publicar, la nota será visible para todos en segundos.</p><ul class="ed-lista">${lista.innerHTML}</ul>`;
			},
		});
		if (r) guardar('publicada', b);
	} else if (accion === 'despublicar') {
		if (await confirmar({ titulo: 'Pasar a borrador', mensaje: 'La nota dejará de estar disponible en el sitio.', aceptar: 'Pasar a borrador' })) guardar('borrador', b);
	} else if (accion === 'borrar') {
		if (!(await confirmar({ titulo: 'Borrar nota', mensaje: 'Se borrará definitivamente. No se puede deshacer.', aceptar: 'Borrar', peligro: true }))) return;
		try {
			await api(`/api/admin/notas/${datos.id}`, 'DELETE');
			sucio = false;
			location.href = '/admin/notas';
		} catch (err) {
			say(status, (err as Error).message, 'error');
		}
	}
});

document.addEventListener('keydown', (e) => {
	if ((e.ctrlKey || e.metaKey) && e.key === 's') {
		e.preventDefault();
		guardar(datos.publicacion);
	}
});
window.addEventListener('beforeunload', (e) => {
	if (sucio) e.preventDefault();
});
