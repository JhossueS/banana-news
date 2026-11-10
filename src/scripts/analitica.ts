/**
 * Google Analytics 4 con consentimiento previo.
 * - Nada de Google se carga hasta que la persona pulsa «Aceptar».
 * - La decisión se guarda en este navegador (localStorage) y vence a los 6 meses.
 * - «No rastrear» / Global Privacy Control cuentan como rechazo mientras no haya una decisión.
 */
type Valor = 'si' | 'no';
interface Decision {
	valor: Valor;
	fecha: number;
}

declare global {
	interface Window {
		dataLayer?: unknown[];
		gtag?: (...args: unknown[]) => void;
	}
}

const CLAVE = 'bn-consent';
const VIGENCIA = 182 * 24 * 3600 * 1000;

function leer(): Decision | null {
	try {
		const d = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Decision | null;
		if (!d || (d.valor !== 'si' && d.valor !== 'no') || Date.now() - d.fecha > VIGENCIA) return null;
		return d;
	} catch {
		return null;
	}
}

function guardar(valor: Valor) {
	try {
		localStorage.setItem(CLAVE, JSON.stringify({ valor, fecha: Date.now() }));
	} catch {
		/* almacenamiento bloqueado: la decisión vale solo para esta visita */
	}
}

const noRastrear = () =>
	navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

let cargado = false;
function cargar(id: string) {
	if (cargado) return;
	cargado = true;
	window.dataLayer = window.dataLayer || [];
	window.gtag = function gtag() {
		// gtag.js espera el objeto `arguments`, no un array
		// eslint-disable-next-line prefer-rest-params
		window.dataLayer!.push(arguments);
	};
	window.gtag('js', new Date());
	window.gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false });
	const s = document.createElement('script');
	s.async = true;
	s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
	document.head.appendChild(s);
}

/** Borra las cookies _ga* en el dominio actual y en el dominio padre */
function borrarCookies() {
	const partes = location.hostname.split('.');
	const dominios = ['', location.hostname, ...partes.map((_, i) => `.${partes.slice(i).join('.')}`).slice(0, -1)];
	document.cookie
		.split(';')
		.map((c) => c.split('=')[0]!.trim())
		.filter((n) => n.startsWith('_ga'))
		.forEach((n) => dominios.forEach((d) => (document.cookie = `${n}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`)));
}

/** Envía un evento a GA4. Si no hay consentimiento, no hace nada */
export function evento(nombre: string, params: Record<string, string | number> = {}) {
	window.gtag?.('event', nombre, params);
}

export function iniciarConsentimiento(id: string) {
	const aviso = document.getElementById('consentimiento');
	const raiz = document.documentElement;
	const mostrar = () => {
		aviso?.removeAttribute('hidden');
		raiz.classList.add('consent-bloqueo');
		aviso?.querySelector<HTMLElement>('[data-consent="si"]')?.focus();
	};
	const ocultar = () => {
		aviso?.setAttribute('hidden', '');
		raiz.classList.remove('consent-bloqueo');
	};

	const decidir = (valor: Valor) => {
		const antes = leer()?.valor;
		guardar(valor);
		ocultar();
		if (valor === 'si') cargar(id);
		else if (antes === 'si' || cargado) {
			borrarCookies();
			// gtag.js ya está en memoria: recargar para que deje de medir
			location.reload();
		}
	};

	aviso?.querySelector('[data-consent="si"]')?.addEventListener('click', () => decidir('si'));
	aviso?.querySelector('[data-consent="no"]')?.addEventListener('click', () => decidir('no'));
	document.querySelectorAll('[data-preferencias-cookies]').forEach((b) =>
		b.addEventListener('click', (e) => {
			e.preventDefault();
			mostrar();
		}),
	);

	// Mientras el aviso está abierto, el foco no sale de él
	aviso?.addEventListener('keydown', (e) => {
		if (e.key !== 'Tab') return;
		const foco = Array.from(aviso.querySelectorAll<HTMLElement>('a[href], button'));
		const primero = foco[0]!;
		const ultimo = foco[foco.length - 1]!;
		if (e.shiftKey && document.activeElement === primero) {
			e.preventDefault();
			ultimo.focus();
		} else if (!e.shiftKey && document.activeElement === ultimo) {
			e.preventDefault();
			primero.focus();
		}
	});

	const d = leer();
	if (d?.valor === 'si') cargar(id);
	// En la propia política no se bloquea la página, para poder leerla antes de decidir
	else if (!d && !noRastrear() && !location.pathname.startsWith('/politica-de-cookies/')) mostrar();
}
