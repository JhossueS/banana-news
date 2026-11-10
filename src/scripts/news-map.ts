import { actions } from 'astro:actions';
import type { MapNews } from '../lib/types';
import { conBoton, leerError, renovarTurnstile } from './envio';
import { evento } from './analitica';

/** Puntos que el servidor embebe en la página (#map-data) y que se refrescan desde /api/publica/mapa */
let mapNews: MapNews[] = (() => {
	try {
		return JSON.parse(document.getElementById('map-data')?.textContent || '[]') as MapNews[];
	} catch {
		return [];
	}
})();
const REFRESCO_MS = 60_000;

interface Prov {
	c: string;
	n: string;
	s: string;
	cap: string;
	d: string;
	b: [number, number, number, number];
	l: [number, number];
}
interface Cant {
	c: string;
	p: string;
	n: string;
	d: string;
	l: [number, number];
}
interface Geo {
	provinces: Prov[];
	cantons: Cant[];
}
type Box = [number, number, number, number];
interface Custom {
	x: number;
	y: number;
	lat: number;
	lon: number;
	inside: boolean;
	code?: string;
	canton?: string;
	prov?: string;
}

const FULL: Box = [20, 5, 810, 665];
const INK = '#171717';
const HUESO = '#F7F7F2';
const AMARILLO = '#FFD52B';
const AMARILLO_100 = '#FFF6CC';
const AMARILLO_300 = '#FFE27A';
const CORAL = '#FF7047';
const GRIS_100 = '#EDEDE7';
const GRIS_200 = '#DEDED7';

const $ = <T extends HTMLElement | SVGElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (n: number) => n.toFixed(5).replace('.', ',').replace('-', '−');

const ICON = {
	zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
	'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
	'map-pin': '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
	'triangle-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
	info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
	'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
	clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
	'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
} as const;
const icon = (name: keyof typeof ICON, size = 14, stroke = 2.5) =>
	`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;

// Proyección idéntica a la usada al generar public/data/ecuador.json
const proj = (lon: number, lat: number): [number, number] =>
	lon < -85 ? [(lon + 92) * 70 + 15, (0.8 - lat) * 70 + 40] : [(lon + 83.4) * 100, (1.6 - lat) * 100];
const unproj = (x: number, y: number, gal: boolean) =>
	gal ? { lon: (x - 15) / 70 - 92, lat: 0.8 - (y - 40) / 70 } : { lon: x / 100 - 83.4, lat: 1.6 - y / 100 };

/**
 * `ver`: portada, solo lectura. Los pines muestran la noticia y, si está verificada, enlazan a la nota.
 * `ubicar`: página de publicar. Sin pines; se toca un cantón para fijar el punto de la nueva noticia.
 */
type Mode = 'ver' | 'ubicar';

const statusOf = (n: MapNews) =>
	n.urgent
		? ({ label: 'Última hora', ic: 'zap', cls: 'urgent' } as const)
		: n.verificada
			? ({ label: 'Verificada', ic: 'shield-check', cls: 'ok' } as const)
			: ({ label: 'Sin verificar', ic: 'clock', cls: 'pending' } as const);
const pinColor = (n: MapNews) => (n.urgent ? CORAL : n.verificada ? AMARILLO : '#FFFFFF');

function initMap(root: HTMLElement) {
	const mode: Mode = root.dataset.mode === 'ubicar' ? 'ubicar' : 'ver';
	const svg = $<SVGSVGElement>('map-svg');
	if (!svg) return;
	const gProv = $<SVGGElement>('g-prov')!;
	const gCant = $<SVGGElement>('g-cant')!;
	const gSel = $<SVGGElement>('g-sel')!;
	const gLabels = $<SVGGElement>('g-labels')!;
	const gPins = $<SVGGElement>('g-pins')!;
	const gCustom = $<SVGGElement>('g-custom')!;
	const gCountries = $<SVGGElement>('g-countries')!;
	const loading = $('map-loading')!;
	const crumb = $('map-crumb')!;
	const hint = $('map-hint')!;
	const explore = $('map-explore')!;
	// Solo en `ver`
	const detail = $('map-detail');
	// Solo en `ubicar`
	const info = $('map-info');
	const btnPublish = $<HTMLButtonElement>('btn-publish');
	const publishStatus = $('publish-status');
	const formEl = $<HTMLFormElement>('form-mapa');

	let geo: Geo | null = null;
	let vb: Box = [...FULL];
	let prov: string | null = null;
	let sel = mode === 'ver' ? (mapNews[0]?.id ?? 'none') : 'none';
	let custom: Custom | null = null;
	let raf = 0;
	let drag: { x: number; y: number; vb: Box; w: number } | null = null;
	let dragged = false;

	let counts: Record<string, number> = {};
	const recontar = () => {
		counts = {};
		mapNews.forEach((n) => (counts[n.c] = (counts[n.c] || 0) + 1));
	};
	recontar();

	const provByCode = (c: string) => geo?.provinces.find((p) => p.c === c) ?? null;
	const cantonsOf = (c: string) => geo?.cantons.filter((k) => k.p === c) ?? [];
	const widthPx = () => svg.getBoundingClientRect().width || 800;

	/* ── Vista ── */
	function clampVb(v: Box): Box {
		const w = Math.min(Math.max(v[2], 24), FULL[2]);
		const h = (w * FULL[3]) / FULL[2];
		let cx = v[0] + v[2] / 2;
		let cy = v[1] + v[3] / 2;
		cx = Math.min(Math.max(cx, FULL[0] + w / 2), FULL[0] + FULL[2] - w / 2);
		cy = Math.min(Math.max(cy, FULL[1] + h / 2), FULL[1] + FULL[3] - h / 2);
		return [cx - w / 2, cy - h / 2, w, h];
	}
	function animateTo(target: Box) {
		const t = clampVb(target);
		const from = [...vb] as Box;
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		cancelAnimationFrame(raf);
		if (reduce) {
			vb = t;
			renderView();
			return;
		}
		const t0 = performance.now();
		const step = (now: number) => {
			const k = Math.min(1, (now - t0) / 200);
			const e = 1 - Math.pow(1 - k, 3);
			vb = from.map((v, i) => v + (t[i] - v) * e) as Box;
			renderView();
			if (k < 1) raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
	}
	function fitBox(b: Box): Box {
		const a = FULL[2] / FULL[3];
		let w = b[2] * 1.3;
		let h = b[3] * 1.3;
		if (w / h > a) h = w / a;
		else w = h * a;
		if (w < 60) {
			w = 60;
			h = w / a;
		}
		return [b[0] + b[2] / 2 - w / 2, b[1] + b[3] / 2 - h / 2, w, h];
	}
	function zoom(f: number) {
		const w = vb[2] * f;
		const h = vb[3] * f;
		animateTo([vb[0] + (vb[2] - w) / 2, vb[1] + (vb[3] - h) / 2, w, h]);
	}
	function openProv(c: string, keepSel = false) {
		if (dragged) return;
		const p = provByCode(c);
		if (!p) return;
		if (c === prov && !keepSel) return;
		prov = c;
		if (!keepSel) {
			if (mode === 'ver') {
				const first = mapNews.find((n) => n.c === c);
				sel = first ? first.id : 'none';
			} else if (custom?.code?.slice(0, 2) !== c) {
				sel = 'none';
				custom = null;
			}
		}
		renderStatic();
		renderPanels();
		animateTo(fitBox(p.b));
	}
	function goCountry() {
		prov = null;
		if (mode === 'ver' && sel === 'none') sel = mapNews[0]?.id ?? 'none';
		renderStatic();
		renderPanels();
		animateTo([...FULL]);
	}
	function svgPoint(e: MouseEvent) {
		const pt = svg.createSVGPoint();
		pt.x = e.clientX;
		pt.y = e.clientY;
		return pt.matrixTransform(svg.getScreenCTM()!.inverse());
	}
	function setCustomAt(x: number, y: number, canton?: Cant) {
		const ll = unproj(x, y, canton ? canton.p === '20' : x < 230 && y < 215);
		if (canton) {
			const p = provByCode(canton.p);
			custom = { x, y, lat: ll.lat, lon: ll.lon, inside: true, code: canton.c, canton: canton.n, prov: p?.n ?? '' };
		} else {
			custom = { x, y, lat: ll.lat, lon: ll.lon, inside: false };
		}
		sel = 'custom';
		renderStatic();
		renderView();
		renderPanels();
	}

	/* ── Render: capas que cambian con el estado ── */
	function renderStatic() {
		if (!geo) return;
		gProv.innerHTML = geo.provinces
			.map((p) => {
				const n = mode === 'ver' ? counts[p.c] || 0 : 0;
				const fill = prov ? (p.c === prov ? HUESO : GRIS_200) : n ? AMARILLO_100 : HUESO;
				const label = `${p.n}${n ? `, ${n} ${n === 1 ? 'noticia' : 'noticias'}` : ''}`;
				return `<path class="prov" data-c="${p.c}" d="${p.d}" fill="${fill}" stroke="${INK}" stroke-width="${prov ? 1 : 1.5}" vector-effect="non-scaling-stroke" stroke-linejoin="round" fill-rule="evenodd" role="button" tabindex="${prov ? -1 : 0}" aria-label="${esc(label)}"><title>${esc(p.n)}</title></path>`;
			})
			.join('');
		gCant.innerHTML = prov
			? cantonsOf(prov)
					.map((k) => {
						const on = sel === 'custom' && custom?.code === k.c;
						// En `ver` los cantones son solo contexto: no reciben clics
						const attrs = mode === 'ver' ? 'pointer-events="none"' : 'class="cant"';
						return `<path ${attrs} data-c="${k.c}" d="${k.d}" fill="${on ? AMARILLO_300 : HUESO}" stroke="#6B7280" stroke-width="0.9" vector-effect="non-scaling-stroke" stroke-linejoin="round" fill-rule="evenodd"><title>Cantón ${esc(k.n)}</title></path>`;
					})
					.join('')
			: '';
		const P = prov ? provByCode(prov) : null;
		gSel.innerHTML = P
			? `<path d="${P.d}" fill="none" stroke="${INK}" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="round" fill-rule="evenodd" pointer-events="none"/>`
			: '';
	}

	/* ── Render: capas que dependen del zoom (se redibujan al animar) ── */
	function renderView() {
		svg.setAttribute('viewBox', vb.map((x) => x.toFixed(2)).join(' '));
		const W = widthPx();
		const ppu = W / vb[2]; // px de pantalla por unidad de mapa
		const px = (n: number) => n / ppu; // px de pantalla -> unidades de mapa
		const zoomed = vb[2] < FULL[2] - 1;
		svg.style.touchAction = zoomed ? 'none' : 'pan-y';
		svg.style.cursor = zoomed ? 'grab' : 'default';

		// Etiquetas de país y mar: tamaño de pantalla constante
		const big = px(Math.max(13 * (W / 780), 10));
		gCountries.querySelectorAll<SVGTextElement>('[data-big]').forEach((t) => t.setAttribute('font-size', String(big)));
		gCountries.querySelectorAll<SVGTextElement>('[data-small]').forEach((t) => t.setAttribute('font-size', String(px(Math.max(11 * (W / 780), 9)))));
		const inset = gCountries.querySelector('rect');
		inset?.setAttribute('stroke-width', '1.5');

		// Etiquetas de provincia / cantón
		if (geo) {
			const out: string[] = [];
			const label = (x: number, y: number, text: string, basePx: number, fw: number, fill = INK) => {
				const f = px(Math.max(basePx * (W / 780), 9));
				out.push(
					`<text x="${x}" y="${y}" font-size="${f}" font-weight="${fw}" text-anchor="middle" dominant-baseline="middle" fill="${fill}" stroke="${HUESO}" stroke-width="${f * 0.3}" stroke-linejoin="round" paint-order="stroke" pointer-events="none">${esc(text)}</text>`,
				);
			};
			if (!prov) {
				for (const p of geo.provinces) {
					// En pantallas angostas solo se rotulan las provincias que caben
					const screenW = p.b[2] * ppu;
					const f = Math.max(10.5 * (W / 780), 9);
					if (screenW < p.s.length * f * 0.62 && p.c !== '20') continue;
					label(p.l[0], p.l[1], p.s, 10.5, 700);
				}
			} else {
				for (const k of cantonsOf(prov)) label(k.l[0], k.l[1], k.n, k.c.slice(2) === '01' ? 12.5 : 11, k.c.slice(2) === '01' ? 800 : 600);
				for (const p of geo.provinces) if (p.c !== prov) label(p.l[0], p.l[1], p.s.toUpperCase(), 10, 700, '#4B5058');
			}
			gLabels.innerHTML = out.join('');
		}

		// Pines
		const pinScale = px(Math.max(W / 780, 0.8));
		gPins.innerHTML = (mode === 'ver' ? mapNews : [])
			.map((n) => {
				const [x, y] = proj(n.lon, n.lat);
				const on = sel === n.id;
				const k = pinScale * (on ? 1.3 : 1) * 1.15;
				const fill = on ? INK : pinColor(n);
				const dot = on ? AMARILLO : INK;
				const aria = `${n.city}: ${n.title} (${statusOf(n).label.toLowerCase()})`;
				return `<g class="pin" data-id="${n.id}" transform="translate(${x} ${y}) scale(${k})" role="button" tabindex="0" aria-label="${esc(aria)}" aria-pressed="${on}"><title>${esc(aria)}</title><path d="M0 0C-5-7-9-11-9-16A9 9 0 1 1 9-16C9-11 5-7 0 0Z" fill="${fill}" stroke="${INK}" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="0" cy="-16" r="3.2" fill="${dot}"/></g>`;
			})
			.join('');

		// Marcador de ubicación libre
		if (mode === 'ubicar' && sel === 'custom' && custom) {
			const k = px(Math.max(W / 780, 0.8)) * 1.15;
			gCustom.innerHTML = `<g transform="translate(${custom.x} ${custom.y}) scale(${k})" pointer-events="none"><circle r="10" fill="${custom.inside ? AMARILLO : '#9CA0A8'}" stroke="${INK}" stroke-width="2.5"/><circle r="2.6" fill="${INK}"/></g>`;
		} else gCustom.innerHTML = '';
	}

	/* ── Render: paneles de texto ── */
	const BACK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`;
	const byName = <T extends { n: string }>(list: T[]) => [...list].sort((a, b) => a.n.localeCompare(b.n, 'es'));

	/** `ver`: la noticia elegida, con enlace a la nota si está verificada */
	function renderDetail() {
		if (!detail) return;
		const n = mapNews.find((x) => x.id === sel);
		if (!n) {
			const P = prov ? provByCode(prov) : null;
			detail.innerHTML = `<span class="d-kicker">${esc(P ? P.n : 'Ecuador')}</span><p class="d-title">Toca un punto del mapa</p><p class="d-note">${P ? 'Aún no hay noticias en esta provincia.' : 'Elige una noticia en el mapa o en la lista de provincias.'}</p>`;
			return;
		}
		const st = statusOf(n);
		const pn = provByCode(n.c);
		const more = n.nota
			? `<a class="d-read" href="/noticias/${encodeURIComponent(n.nota)}/">Leer la noticia completa${icon('arrow-right', 18, 2.25)}</a>`
			: n.verificada
				? '<p class="d-note">La redacción verificó esta información.</p>'
				: '<p class="d-note"><b>Enviado por un lector.</b> La redacción aún no lo verifica. Cuando se confirme, podrás leer la nota completa.</p>';
		detail.innerHTML = `<span class="d-status d-status--${st.cls}">${icon(st.ic)}${st.label}</span><span class="d-kicker">${esc(n.tag)}</span><h3 class="d-title">${esc(n.title)}</h3><span class="d-place">${icon('map-pin')}${esc(n.city)}${pn ? `, ${esc(pn.n)}` : ''}</span>${more}`;
	}

	/** `ubicar`: la ubicación elegida para la nueva noticia */
	function renderInfo() {
		if (!info || !btnPublish) return;
		const P = prov ? provByCode(prov) : null;
		let i: { label: string; ic: keyof typeof ICON; title: string; meta: string; coords: string; bg: string; blocked: boolean };
		if (sel === 'custom' && custom?.inside) {
			i = {
				label: 'Ubicación elegida',
				ic: 'map-pin',
				title: `Cantón ${custom.canton}`,
				meta: `${custom.prov}, Ecuador`,
				coords: `Lat ${fmt(custom.lat)} · Lon ${fmt(custom.lon)}`,
				bg: AMARILLO,
				blocked: false,
			};
		} else if (sel === 'custom' && custom) {
			i = {
				label: 'Fuera de Ecuador',
				ic: 'triangle-alert',
				title: 'Esta ubicación no está en Ecuador',
				meta: 'El mapa solo admite puntos dentro del territorio ecuatoriano, incluido Galápagos.',
				coords: 'Toca dentro de una provincia para continuar.',
				bg: CORAL,
				blocked: true,
			};
		} else {
			i = {
				label: 'Sin ubicación',
				ic: 'info',
				title: P ? 'Toca el lugar exacto en el mapa' : 'Elige la provincia',
				meta: P ? `O elige el cantón de ${P.n} en la lista.` : 'Tócala en el mapa o elígela en la lista.',
				coords: '',
				bg: GRIS_100,
				blocked: true,
			};
		}
		info.style.background = i.bg;
		info.innerHTML = `<span class="i-label">${icon(i.ic)}${esc(i.label)}</span><span class="i-title">${esc(i.title)}</span><span class="i-meta">${esc(i.meta)}</span>${i.coords ? `<span class="i-coords">${esc(i.coords)}</span>` : ''}`;
		btnPublish.disabled = i.blocked;
	}

	function renderExplore(P: Prov | null) {
		if (!geo) return;
		if (mode === 'ubicar') {
			if (!P) {
				const opts = byName(geo.provinces)
					.map((p) => `<option value="${p.c}">${esc(p.n)}</option>`)
					.join('');
				explore.innerHTML = `<label class="field-sm"><span>Provincia</span><select data-prov-select><option value="">Selecciona una provincia</option>${opts}</select></label>`;
				return;
			}
			const opts = byName(cantonsOf(P.c))
				.map((k) => `<option value="${k.c}"${custom?.code === k.c ? ' selected' : ''}>${esc(k.n)}</option>`)
				.join('');
			explore.innerHTML = `
				<button type="button" data-act="country" class="side-back">${BACK}Cambiar provincia</button>
				<h3 class="side-prov">${esc(P.n)}</h3>
				<label class="field-sm"><span>Cantón</span><select data-canton><option value="">Selecciona un cantón</option>${opts}</select></label>`;
			return;
		}

		if (!P) {
			const items = byName(geo.provinces)
				.map((p) => {
					const n = counts[p.c] || 0;
					return `<button type="button" class="prov-btn${n ? ' has' : ''}" data-prov="${p.c}"><span class="nm">${esc(p.n)}</span>${n ? `<span class="ct" aria-label="${n} noticias">${n}</span>` : ''}</button>`;
				})
				.join('');
			explore.innerHTML = `<h3 class="side-h">Explora por provincia</h3><p class="side-p">El número indica cuántas noticias tiene cada provincia.</p><div class="prov-grid">${items}</div>`;
			return;
		}
		const news = mapNews.filter((n) => n.c === P.c);
		const list = news
			.map((n) => {
				const on = sel === n.id;
				return `<button type="button" class="news-btn${on ? ' on' : ''}" data-news="${n.id}" aria-pressed="${on}" style="--bar:${pinColor(n)}"><span class="k">${esc(n.city)} · ${statusOf(n).label}</span><span class="t">${esc(n.title)}</span></button>`;
			})
			.join('');
		explore.innerHTML = `
			<button type="button" data-act="country" class="side-back">${BACK}Todo Ecuador</button>
			<h3 class="side-prov">${esc(P.n)}</h3>
			<span class="side-meta">Capital: ${esc(P.cap)} · ${cantonsOf(P.c).length} cantones</span>
			${news.length ? `<span class="side-cap">Noticias en la provincia</span>${list}` : ''}`;
	}

	function renderPanels() {
		if (!geo) return;
		const P = prov ? provByCode(prov) : null;

		crumb.innerHTML = P
			? `<button type="button" data-act="country" class="crumb-back">${BACK}Ecuador</button><span class="crumb-name">${esc(P.n)}</span>`
			: `<span class="crumb-name">Ecuador · ${geo.provinces.length} provincias</span>`;

		hint.textContent =
			mode === 'ver'
				? P
					? 'Toca un punto para ver la noticia · Arrastra para moverte'
					: 'Toca un punto o una provincia'
				: P
					? 'Toca el lugar exacto donde ocurrió · Arrastra para moverte'
					: 'Toca la provincia donde ocurrió';

		renderExplore(P);
		renderDetail();
		renderInfo();
	}

	/* ── Interacción ── */
	svg.addEventListener('pointerdown', (e) => {
		drag = { x: e.clientX, y: e.clientY, vb: [...vb] as Box, w: svg.getBoundingClientRect().width };
		dragged = false;
	});
	svg.addEventListener('pointermove', (e) => {
		if (!drag) return;
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		if (!dragged && Math.abs(dx) + Math.abs(dy) < 6) return;
		if (drag.vb[2] >= FULL[2] - 1) return;
		dragged = true;
		cancelAnimationFrame(raf);
		const k = drag.vb[2] / drag.w;
		vb = clampVb([drag.vb[0] - dx * k, drag.vb[1] - dy * k, drag.vb[2], drag.vb[3]]);
		renderView();
	});
	const endDrag = () => {
		drag = null;
		if (dragged) setTimeout(() => (dragged = false), 0);
	};
	svg.addEventListener('pointerup', endDrag);
	svg.addEventListener('pointerleave', endDrag);

	svg.addEventListener('click', (e) => {
		if (dragged) return;
		const t = e.target as Element;
		const pin = t.closest<SVGGElement>('.pin');
		if (pin) {
			const n = mapNews.find((x) => x.id === pin.dataset.id);
			if (!n) return;
			sel = n.id;
			if (prov !== n.c) openProv(n.c, true);
			else {
				renderView();
				renderPanels();
			}
			return;
		}
		const cant = t.closest<SVGPathElement>('.cant');
		if (cant && geo) {
			const k = geo.cantons.find((x) => x.c === cant.dataset.c)!;
			const q = svgPoint(e);
			setCustomAt(q.x, q.y, k);
			return;
		}
		const pv = t.closest<SVGPathElement>('.prov');
		if (pv) {
			openProv(pv.dataset.c!);
			return;
		}
		if (mode === 'ubicar' && t.id === 'map-ocean') {
			const q = svgPoint(e);
			setCustomAt(q.x, q.y);
		}
	});
	svg.addEventListener('keydown', (e) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		const t = e.target as Element;
		if (t.matches('.prov, .pin')) {
			e.preventDefault();
			(t as SVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		}
	});

	root.addEventListener('click', (e) => {
		const t = e.target as HTMLElement;
		const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
		if (act === 'country') return goCountry();
		if (act === 'zoom-in') return zoom(0.6);
		if (act === 'zoom-out') return zoom(1 / 0.6);
		const pb = t.closest<HTMLElement>('[data-prov]');
		if (pb) return openProv(pb.dataset.prov!);
		const nb = t.closest<HTMLElement>('[data-news]');
		if (nb) {
			sel = nb.dataset.news!;
			renderView();
			renderPanels();
		}
	});
	root.addEventListener('change', (e) => {
		const t = e.target as HTMLSelectElement;
		if (t.matches('[data-prov-select]') && t.value) {
			openProv(t.value);
			root.querySelector<HTMLSelectElement>('[data-canton]')?.focus();
			return;
		}
		if (!t.matches('[data-canton]') || !geo) return;
		const k = geo.cantons.find((x) => x.c === t.value);
		if (!k) return;
		setCustomAt(k.l[0], k.l[1], k);
		// El cambio re-renderiza el panel: devolver el foco al selector
		root.querySelector<HTMLSelectElement>('[data-canton]')?.focus();
	});

	formEl?.addEventListener('submit', async (e) => {
		if (!btnPublish || !publishStatus) return;
		e.preventDefault();
		publishStatus.dataset.kind = '';
		const title = formEl.elements.namedItem('titular') as HTMLInputElement;
		title.removeAttribute('aria-invalid');
		if (btnPublish.disabled || sel !== 'custom' || !custom?.inside || !custom.code) {
			publishStatus.textContent = 'Primero elige un punto dentro de Ecuador en el mapa.';
			publishStatus.dataset.kind = 'error';
			return;
		}
		if (title.value.trim().length < 8) {
			title.setAttribute('aria-invalid', 'true');
			title.focus();
			publishStatus.textContent = 'Escribe un titular de al menos 8 caracteres.';
			publishStatus.dataset.kind = 'error';
			return;
		}
		const fd = new FormData(formEl);
		fd.set('lat', String(custom.lat));
		fd.set('lon', String(custom.lon));
		fd.set('provincia', custom.code.slice(0, 2));
		fd.set('canton', custom.canton ?? '');
		publishStatus.textContent = 'Enviando…';
		const { error } = await conBoton(formEl, () => actions.publicarMapa(fd));
		renovarTurnstile(formEl);
		// El botón depende de la ubicación elegida, no del envío
		renderInfo();
		if (error) {
			const { campo, mensaje } = leerError(error);
			const f = campo ? formEl.elements.namedItem(campo) : null;
			if (f instanceof HTMLElement) {
				f.setAttribute('aria-invalid', 'true');
				f.focus();
			}
			publishStatus.textContent = mensaje;
			publishStatus.dataset.kind = 'error';
			return;
		}
		evento('mapa_enviado', { seccion: (formEl.elements.namedItem('seccion') as HTMLSelectElement | null)?.value ?? '' });
		formEl.reset();
		publishStatus.innerHTML = 'Listo: tu noticia ya aparece en el <a href="/#mapa">mapa</a> como <b>sin verificar</b>. La redacción la revisará.';
		publishStatus.dataset.kind = 'ok';
	});

	/** `ver`: refresca los puntos sin recargar la página */
	async function refrescar() {
		if (document.hidden) return;
		try {
			const r = await fetch('/api/publica/mapa', { headers: { accept: 'application/json' } });
			if (!r.ok) return;
			mapNews = (await r.json()) as MapNews[];
			recontar();
			if (sel !== 'none' && !mapNews.some((n) => n.id === sel)) sel = (prov ? mapNews.find((n) => n.c === prov)?.id : mapNews[0]?.id) ?? 'none';
			renderStatic();
			renderView();
			renderPanels();
		} catch {
			/* sin conexión: se mantienen los puntos actuales */
		}
	}
	if (mode === 'ver') {
		setInterval(refrescar, REFRESCO_MS);
		document.addEventListener('visibilitychange', () => !document.hidden && refrescar());
	}

	let ro: ResizeObserver | null = null;
	if ('ResizeObserver' in window) {
		let lastW = 0;
		ro = new ResizeObserver(() => {
			const w = widthPx();
			if (Math.abs(w - lastW) > 1) {
				lastW = w;
				renderView();
			}
		});
		ro.observe(svg);
	}

	/* ── Carga ── */
	renderView();
	fetch('/data/ecuador.json')
		.then((r) => {
			if (!r.ok) throw new Error(String(r.status));
			return r.json() as Promise<Geo>;
		})
		.then((g) => {
			geo = g;
			loading.hidden = true;
			renderStatic();
			renderView();
			renderPanels();
		})
		.catch(() => {
			loading.textContent = 'No se pudo cargar el mapa. Recarga la página para intentarlo de nuevo.';
		});
}

const mapRoot = document.querySelector<HTMLElement>('.nmap');
if (mapRoot) initMap(mapRoot);
