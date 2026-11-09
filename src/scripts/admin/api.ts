/** Llamadas JSON a /api/admin con manejo de errores uniforme */
export class ErrorApi extends Error {
	constructor(
		message: string,
		public campo?: string,
		public status = 0,
	) {
		super(message);
	}
}

export async function api<T = unknown>(url: string, metodo = 'GET', cuerpo?: unknown): Promise<T> {
	let r: Response;
	try {
		r = await fetch(url, {
			method: metodo,
			headers: cuerpo === undefined ? {} : { 'content-type': 'application/json' },
			body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
		});
	} catch {
		throw new ErrorApi('Sin conexión. Revisa tu internet e inténtalo de nuevo.');
	}
	if (r.status === 401) {
		location.href = `/admin/login?volver=${encodeURIComponent(location.pathname)}`;
		throw new ErrorApi('Tu sesión venció.', undefined, 401);
	}
	const j = (await r.json().catch(() => ({}))) as { error?: string; campo?: string };
	if (!r.ok) throw new ErrorApi(j.error ?? `Error ${r.status}`, j.campo, r.status);
	return j as T;
}

export const say = (el: HTMLElement | null, msg: string, kind: 'ok' | 'error' | '' = '') => {
	if (!el) return;
	el.textContent = msg;
	el.dataset.kind = kind;
};
