/** Ayudas comunes para enviar los formularios públicos a las Astro Actions. */
import { isInputError, type ActionError } from 'astro:actions';

declare global {
	interface Window {
		turnstile?: { reset: (el?: Element | string) => void };
	}
}

/** Primer mensaje de validación del servidor, y el campo al que corresponde */
export function leerError(error: ActionError): { campo?: string; mensaje: string } {
	if (isInputError(error)) {
		const [campo, msgs] = Object.entries(error.fields).find(([, m]) => m?.length) ?? [];
		return { campo, mensaje: (msgs as string[] | undefined)?.[0] ?? 'Revisa los campos marcados.' };
	}
	if (error.code === 'TOO_MANY_REQUESTS' || error.code === 'FORBIDDEN' || error.code === 'BAD_REQUEST') return { mensaje: error.message };
	return { mensaje: 'No pudimos enviar. Revisa tu conexión e inténtalo de nuevo.' };
}

/** Un token de Turnstile sirve una sola vez: renovarlo tras cada envío */
export const renovarTurnstile = (form: HTMLFormElement) => {
	const w = form.querySelector('.cf-turnstile');
	if (w) window.turnstile?.reset(w);
};

/** Deshabilita el botón mientras se envía */
export async function conBoton<T>(form: HTMLFormElement, fn: () => Promise<T>): Promise<T> {
	const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
	const prev = btn?.disabled ?? false;
	if (btn) {
		btn.disabled = true;
		btn.setAttribute('aria-busy', 'true');
	}
	try {
		return await fn();
	} finally {
		if (btn) {
			btn.disabled = prev;
			btn.removeAttribute('aria-busy');
		}
	}
}
