import type { Editor, JSONContent } from '@tiptap/core';
import type { MedioVista } from './subir';

type Nivel = 'ok' | 'aviso' | 'falta';

interface Opciones {
	form: HTMLFormElement;
	editor: Editor;
	imagen: () => MedioVista | null;
}

const MARCA = 'Banana News';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const recortar = (texto: string, max: number) => {
	const t = texto.replace(/\s+/g, ' ').trim();
	if (t.length <= max) return t;
	const corte = t.slice(0, max - 1);
	const i = corte.lastIndexOf(' ');
	return `${corte.slice(0, i > max * 0.6 ? i : corte.length).replace(/[\s,;:.\-–—]+$/, '')}…`;
};

const tituloGoogle = (titulo: string) => {
	const completo = `${titulo} · ${MARCA}`;
	return completo.length <= 60 ? completo : recortar(titulo, 60);
};

function analizar(doc: JSONContent) {
	let palabras = 0;
	let enlaces = 0;
	let subtitulos = 0;
	const recorrer = (n: JSONContent) => {
		if (n.type === 'text') {
			palabras += (n.text ?? '').trim().split(/\s+/).filter(Boolean).length;
			if (n.marks?.some((m) => m.type === 'link')) enlaces++;
		}
		if (n.type === 'heading') subtitulos++;
		n.content?.forEach(recorrer);
	};
	recorrer(doc);
	return { palabras, enlaces, subtitulos };
}

export function iniciarCalidad({ form, editor, imagen }: Opciones) {
	const valor = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value.trim() ?? '';
	const lista = document.getElementById('cal-lista')!;
	const resumen = document.getElementById('cal-resumen')!;
	const google = document.getElementById('prev-google')!;
	const social = document.getElementById('prev-social')!;
	const contadores = Object.fromEntries(Array.from(form.querySelectorAll<HTMLElement>('[data-cont]')).map((e) => [e.dataset.cont!, e]));

	const contar = (el: HTMLElement | undefined, n: number, nivel: Nivel, texto: string) => {
		if (!el) return;
		el.textContent = `${n} · ${texto}`;
		el.dataset.nivel = nivel;
	};

	function pintar() {
		const titulo = valor('titulo');
		const bajada = valor('bajada');
		const lugar = valor('lugar');
		const img = imagen();
		const alt = valor('alt') || img?.alt || '';
		const { palabras, enlaces, subtitulos } = analizar(editor.getJSON());

		const reglas: [Nivel, string][] = [];

		if (!titulo) reglas.push(['falta', 'Escribe un título.']);
		else if (titulo.length < 20) reglas.push(['aviso', 'El título es muy corto: mejor entre 20 y 60 caracteres.']);
		else if (titulo.length > 60) reglas.push(['aviso', `El título tiene ${titulo.length} caracteres: Google lo recortará pasados 60.`]);
		else reglas.push(['ok', 'Título con buen largo.']);

		if (bajada.length < 20) reglas.push(['falta', 'La bajada necesita al menos 20 caracteres para publicar.']);
		else if (bajada.length < 120) reglas.push(['aviso', `La bajada tiene ${bajada.length} caracteres: mejor entre 120 y 160.`]);
		else if (bajada.length > 160) reglas.push(['aviso', `La bajada tiene ${bajada.length} caracteres: se recortará en buscadores.`]);
		else reglas.push(['ok', 'Bajada con buen largo.']);

		reglas.push(lugar ? ['ok', 'Lugar indicado.'] : ['falta', 'Indica el lugar.']);

		if (!img) reglas.push(['falta', 'Elige la imagen principal.']);
		else if (!alt) reglas.push(['aviso', 'Describe la imagen en el texto alternativo.']);
		else reglas.push(['ok', 'Imagen principal con descripción.']);

		if (palabras === 0) reglas.push(['falta', 'Escribe el texto de la nota.']);
		else if (palabras < 150) reglas.push(['aviso', `El texto tiene ${palabras} palabras: una nota breve suele pasar de 150.`]);
		else reglas.push(['ok', `Texto de ${palabras} palabras.`]);

		reglas.push(enlaces ? ['ok', 'Cita al menos una fuente con enlace.'] : ['aviso', 'Agrega un enlace a la fuente (comunicado, documento o dato).']);

		if (palabras >= 400) reglas.push(subtitulos ? ['ok', 'Tiene subtítulos.'] : ['aviso', 'Para un texto largo, agrega subtítulos (H2).']);

		const icono = { ok: '✓', aviso: '!', falta: '✕' } as const;
		lista.innerHTML = reglas.map(([n, t]) => `<li data-nivel="${n}"><span aria-hidden="true">${icono[n]}</span>${esc(t)}</li>`).join('');
		const faltan = reglas.filter(([n]) => n === 'falta').length;
		const avisos = reglas.filter(([n]) => n === 'aviso').length;
		resumen.textContent = faltan ? `Faltan ${faltan} para poder publicar.` : avisos ? `Se puede publicar. ${avisos} mejoras sugeridas.` : 'Todo listo para publicar.';

		contar(contadores.titulo, titulo.length, titulo.length >= 20 && titulo.length <= 60 ? 'ok' : 'aviso', 'ideal 20–60');
		contar(contadores.bajada, bajada.length, bajada.length >= 120 && bajada.length <= 160 ? 'ok' : 'aviso', 'ideal 120–160');

		const host = location.host;
		const slug = valor('slug') || 'titulo-de-la-nota';
		const tg = tituloGoogle(titulo || 'Título de la nota');
		const dg = recortar(bajada || 'La bajada de la nota aparecerá aquí.', 160);
		google.innerHTML = `<small>${esc(host)} › noticias › ${esc(slug)}</small><strong>${esc(tg)}</strong><span>${esc(dg)}</span>`;
		social.innerHTML = `<div class="prev-img">${img?.vista ? `<img src="${esc(img.vista)}" alt="">` : 'Sin imagen'}</div><div class="prev-txt"><small>${esc(host)}</small><strong>${esc(recortar(titulo || 'Título de la nota', 90))}</strong><span>${esc(recortar(bajada, 110))}</span></div>`;
	}

	let t: number | undefined;
	const programar = () => {
		clearTimeout(t);
		t = window.setTimeout(pintar, 150);
	};
	form.addEventListener('input', programar);
	editor.on('update', programar);
	pintar();
	return pintar;
}
