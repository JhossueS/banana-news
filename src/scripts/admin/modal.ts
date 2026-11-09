/**
 * Modal de formulario del panel (reemplaza a prompt()). Usa los estilos .a-dialog / .a-field de admin.css.
 *
 *   const v = await pedir({ titulo: 'Agregar enlace', campos: [{ name: 'url', label: 'Dirección' }] });
 *   if (v) v.url …   // null si se canceló
 */

export interface Campo {
	name: string;
	label: string;
	tipo?: 'text' | 'url' | 'textarea';
	valor?: string;
	placeholder?: string;
	ayuda?: string;
	requerido?: boolean;
}

export type Valores = Record<string, string>;

export interface OpcionesModal {
	titulo: string;
	campos: Campo[];
	/** Texto del botón principal */
	aceptar?: string;
	/** Botón secundario opcional (p. ej. «Quitar enlace»): resuelve con { accion: 'secundaria' } */
	secundaria?: string;
	/** Devuelve un error para un campo, o null si todo está bien */
	validar?: (v: Valores) => { campo: string; mensaje: string } | null;
	/** Se llama al escribir; `extra` es una zona libre bajo los campos (vista previa, etc.) */
	alCambiar?: (v: Valores, extra: HTMLElement) => void;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

let dlg: HTMLDialogElement | null = null;
let n = 0;

function dialogo() {
	if (dlg) return dlg;
	dlg = document.createElement('dialog');
	dlg.className = 'a-dialog a-dialog--form';
	dlg.setAttribute('aria-labelledby', 'modal-titulo');
	document.body.append(dlg);
	return dlg;
}

export function pedir(o: OpcionesModal): Promise<(Valores & { accion: 'aceptar' | 'secundaria' }) | null> {
	const d = dialogo();
	const id = `m${++n}`;
	d.innerHTML = `
		<form class="a-modal-form" novalidate>
			<div class="a-dialog-head">
				<h2 id="modal-titulo">${esc(o.titulo)}</h2>
				<button type="button" class="a-btn a-btn--sm" data-cancelar aria-label="Cerrar">Cerrar</button>
			</div>
			<div class="a-dialog-body a-modal-body">
				${o.campos
					.map((c) => {
						const attrs = `id="${id}-${c.name}" name="${c.name}"${c.placeholder ? ` placeholder="${esc(c.placeholder)}"` : ''}${
							c.requerido ? ' required aria-required="true"' : ''
						}${c.ayuda ? ` aria-describedby="${id}-${c.name}-ayuda"` : ''}`;
						const control =
							c.tipo === 'textarea'
								? `<textarea ${attrs} rows="4">${esc(c.valor ?? '')}</textarea>`
								: `<input ${attrs} type="${c.tipo === 'url' ? 'url' : 'text'}" value="${esc(c.valor ?? '')}" autocomplete="off" spellcheck="${c.tipo === 'url' ? 'false' : 'true'}">`;
						return `<label class="a-field" for="${id}-${c.name}">
							<span>${esc(c.label)}${c.requerido ? '' : ' <small>(opcional)</small>'}</span>
							${control}
							${c.ayuda ? `<small id="${id}-${c.name}-ayuda">${esc(c.ayuda)}</small>` : ''}
						</label>`;
					})
					.join('')}
				<div class="a-modal-extra" data-extra></div>
				<p class="a-status" data-kind="error" role="alert" data-error></p>
			</div>
			<div class="a-modal-acciones">
				${o.secundaria ? `<button type="button" class="a-btn a-btn--peligro" data-secundaria>${esc(o.secundaria)}</button>` : ''}
				<button type="button" class="a-btn a-btn--ghost" data-cancelar>Cancelar</button>
				<button type="submit" class="a-btn a-btn--amarillo">${esc(o.aceptar ?? 'Aceptar')}</button>
			</div>
		</form>`;

	const form = d.querySelector('form')!;
	const errorEl = d.querySelector<HTMLElement>('[data-error]')!;
	const extra = d.querySelector<HTMLElement>('[data-extra]')!;
	const valores = (): Valores => Object.fromEntries(o.campos.map((c) => [c.name, (form.elements.namedItem(c.name) as HTMLInputElement).value.trim()]));
	const limpiar = () => {
		errorEl.textContent = '';
		form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
	};

	return new Promise((resolve) => {
		let hecho = false;
		const fin = (r: (Valores & { accion: 'aceptar' | 'secundaria' }) | null) => {
			if (hecho) return;
			hecho = true;
			d.removeEventListener('close', onClose);
			if (d.open) d.close();
			resolve(r);
		};
		const onClose = () => fin(null);
		d.addEventListener('close', onClose);

		form.addEventListener('submit', (e) => {
			e.preventDefault();
			limpiar();
			const v = valores();
			const falta = o.campos.find((c) => c.requerido && !v[c.name]);
			const err = falta ? { campo: falta.name, mensaje: `Completa «${falta.label}».` } : (o.validar?.(v) ?? null);
			if (err) {
				const el = form.elements.namedItem(err.campo) as HTMLElement | null;
				el?.setAttribute('aria-invalid', 'true');
				el?.focus();
				errorEl.textContent = err.mensaje;
				return;
			}
			fin({ ...v, accion: 'aceptar' });
		});
		form.addEventListener('click', (e) => {
			const t = e.target as HTMLElement;
			if (t.closest('[data-cancelar]')) fin(null);
			else if (t.closest('[data-secundaria]')) fin({ ...valores(), accion: 'secundaria' });
		});
		form.addEventListener('input', () => {
			limpiar();
			o.alCambiar?.(valores(), extra);
		});
		// Enter en un textarea hace salto de línea; Ctrl/Cmd+Enter envía
		form.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				form.requestSubmit();
			}
		});

		d.showModal();
		o.alCambiar?.(valores(), extra);
		const primero = form.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
		primero?.focus();
		primero?.select?.();
	});
}
