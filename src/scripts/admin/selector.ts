/** Abre el diálogo #selector-medios y resuelve con el medio elegido (o null si se cierra). */
import { api, say } from './api';
import type { MedioVista } from './subir';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function tarjetaMedio(m: MedioVista, tag: 'button' | 'div' = 'button') {
	const img = m.vista ? `<img src="${esc(m.vista)}" alt="" loading="lazy">` : m.tipo === 'video' ? '▶ Video' : 'Sin vista';
	const estado = m.tipo === 'video' && !m.listo ? ' <span class="a-badge a-badge--pend">Procesando</span>' : '';
	const attrs = tag === 'button' ? ` type="button" data-id="${m.id}"` : '';
	return `<${tag} class="a-medio"${attrs}><span class="a-medio-img">${img}</span><span class="a-medio-alt">${esc(m.alt || (m.tipo === 'video' ? 'Video' : 'Sin descripción'))}</span><span class="a-muted">${esc(m.credito)}${estado}</span></${tag}>`;
}

export function elegirMedio(tipo: 'imagen' | 'video'): Promise<MedioVista | null> {
	const dlg = document.getElementById('selector-medios') as HTMLDialogElement;
	const lista = dlg.querySelector<HTMLElement>('[data-lista]')!;
	const estado = dlg.querySelector<HTMLElement>('[data-estado]');
	const buscar = dlg.querySelector<HTMLInputElement>('[data-buscar]')!;
	const fileInput = dlg.querySelector<HTMLInputElement>('#sel-form input[type=file]');
	if (fileInput) fileInput.accept = tipo === 'imagen' ? 'image/*' : 'video/*';
	dlg.querySelector('#sel-titulo')!.textContent = tipo === 'imagen' ? 'Elegir imagen' : 'Elegir video';

	let medios: MedioVista[] = [];
	let t = 0;
	const cargar = async () => {
		say(estado, 'Cargando…');
		try {
			const q = buscar.value.trim();
			medios = await api<MedioVista[]>(`/api/admin/medios?tipo=${tipo}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
			lista.innerHTML = medios.map((m) => `<li>${tarjetaMedio(m)}</li>`).join('');
			say(estado, medios.length ? '' : 'No hay medios todavía. Sube uno nuevo.');
		} catch (e) {
			say(estado, (e as Error).message, 'error');
		}
	};

	return new Promise((resolve) => {
		const fin = (m: MedioVista | null) => {
			dlg.removeEventListener('click', onClick);
			dlg.removeEventListener('medio-subido', onSubido);
			dlg.removeEventListener('close', onClose);
			buscar.removeEventListener('input', onBuscar);
			if (dlg.open) dlg.close();
			resolve(m);
		};
		const onClick = (e: Event) => {
			const el = e.target as HTMLElement;
			if (el.closest('[data-cerrar]')) return fin(null);
			const b = el.closest<HTMLElement>('[data-id]');
			if (b) fin(medios.find((m) => m.id === b.dataset.id) ?? null);
		};
		const onSubido = (e: Event) => {
			const m = (e as CustomEvent<MedioVista>).detail;
			if (m.tipo === tipo) fin(m);
		};
		const onClose = () => fin(null);
		const onBuscar = () => {
			clearTimeout(t);
			t = window.setTimeout(cargar, 250);
		};
		dlg.addEventListener('click', onClick);
		dlg.addEventListener('medio-subido', onSubido);
		dlg.addEventListener('close', onClose);
		buscar.addEventListener('input', onBuscar);
		buscar.value = '';
		dlg.showModal();
		cargar();
	});
}
