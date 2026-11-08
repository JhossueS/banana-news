import { mapNews, type MapNews } from '../data/map-news';

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
} as const;
const icon = (name: keyof typeof ICON, size = 14) =>
	`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;

// Proyección idéntica a la usada al generar public/data/ecuador.json
const proj = (lon: number, lat: number): [number, number] =>
	lon < -85 ? [(lon + 92) * 70 + 15, (0.8 - lat) * 70 + 40] : [(lon + 83.4) * 100, (1.6 - lat) * 100];
const unproj = (x: number, y: number, gal: boolean) =>
	gal ? { lon: (x - 15) / 70 - 92, lat: 0.8 - (y - 40) / 70 } : { lon: x / 100 - 83.4, lat: 1.6 - y / 100 };

function initMap() {
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
	const info = $('map-info')!;
	const btnPublish = $<HTMLButtonElement>('btn-publish')!;
	const publishStatus = $('publish-status')!;
	const formEl = $<HTMLFormElement>('form-mapa')!;

	let geo: Geo | null = null;
	let vb: Box = [...FULL];
	let prov: string | null = null;
	let sel = 'quito';
	let custom: Custom | null = null;
	let raf = 0;
	let drag: { x: number; y: number; vb: Box; w: number } | null = null;
	let dragged = false;

	const counts: Record<string, number> = {};
	mapNews.forEach((n) => (counts[n.c] = (counts[n.c] || 0) + 1));

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
		prov = c;
		if (!keepSel) {
			const first = mapNews.find((n) => n.c === c);
			sel = first ? first.id : 'none';
		}
		renderStatic();
		renderPanels();
		animateTo(fitBox(p.b));
	}
	function goCountry() {
		prov = null;
		if (sel === 'none') sel = 'quito';
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
				const n = counts[p.c] || 0;
				const fill = prov ? (p.c === prov ? HUESO : GRIS_200) : n ? AMARILLO_100 : HUESO;
				const label = `${p.n}${n ? `, ${n} ${n === 1 ? 'noticia' : 'noticias'}` : ''}`;
				return `<path class="prov" data-c="${p.c}" d="${p.d}" fill="${fill}" stroke="${INK}" stroke-width="${prov ? 1 : 1.5}" vector-effect="non-scaling-stroke" stroke-linejoin="round" fill-rule="evenodd" role="button" tabindex="${prov ? -1 : 0}" aria-label="${esc(label)}"><title>${esc(p.n)}</title></path>`;
			})
			.join('');
		gCant.innerHTML = prov
			? cantonsOf(prov)
					.map((k) => {
						const on = sel === 'custom' && custom?.code === k.c;
						return `<path class="cant" data-c="${k.c}" d="${k.d}" fill="${on ? AMARILLO_300 : HUESO}" stroke="#6B7280" stroke-width="0.9" vector-effect="non-scaling-stroke" stroke-linejoin="round" fill-rule="evenodd"><title>Cantón ${esc(k.n)}</title></path>`;
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
		gPins.innerHTML = mapNews
			.map((n) => {
				const [x, y] = proj(n.lon, n.lat);
				const on = sel === n.id;
				const k = pinScale * (on ? 1.3 : 1) * 1.15;
				const fill = on ? INK : n.urgent ? CORAL : AMARILLO;
				const dot = on ? AMARILLO : INK;
				const aria = `${n.city}: ${n.title}${n.urgent ? ' (última hora)' : ''}`;
				return `<g class="pin" data-id="${n.id}" transform="translate(${x} ${y}) scale(${k})" role="button" tabindex="0" aria-label="${esc(aria)}" aria-pressed="${on}"><title>${esc(aria)}</title><path d="M0 0C-5-7-9-11-9-16A9 9 0 1 1 9-16C9-11 5-7 0 0Z" fill="${fill}" stroke="${INK}" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="0" cy="-16" r="3.2" fill="${dot}"/></g>`;
			})
			.join('');

		// Marcador de ubicación libre
		if (sel === 'custom' && custom) {
			const k = px(Math.max(W / 780, 0.8)) * 1.15;
			gCustom.innerHTML = `<g transform="translate(${custom.x} ${custom.y}) scale(${k})" pointer-events="none"><circle r="10" fill="${custom.inside ? AMARILLO : '#9CA0A8'}" stroke="${INK}" stroke-width="2.5"/><circle r="2.6" fill="${INK}"/></g>`;
		} else gCustom.innerHTML = '';
	}

	/* ── Render: paneles de texto ── */
	function currentInfo() {
		const selNews = mapNews.find((n) => n.id === sel);
		const P = prov ? provByCode(prov) : null;
		if (sel === 'custom' && custom && custom.inside) {
			return {
				label: 'Ubicación exacta',
				ic: 'map-pin' as const,
				title: `Cantón ${custom.canton}`,
				meta: `${custom.prov}, Ecuador`,
				coords: `Lat ${fmt(custom.lat)} · Lon ${fmt(custom.lon)}`,
				bg: AMARILLO,
				blocked: false,
			};
		}
		if (sel === 'custom' && custom) {
			return {
				label: 'Fuera de Ecuador',
				ic: 'triangle-alert' as const,
				title: 'Esta ubicación no está en Ecuador',
				meta: 'El mapa solo admite puntos dentro del territorio ecuatoriano, incluido Galápagos.',
				coords: 'Toca dentro de una provincia para continuar.',
				bg: CORAL,
				blocked: true,
			};
		}
		if (selNews) {
			const pn = provByCode(selNews.c);
			return {
				label: selNews.urgent ? `Última hora · ${selNews.tag}` : selNews.tag,
				ic: (selNews.urgent ? 'zap' : 'file-text') as 'zap' | 'file-text',
				title: selNews.title,
				meta: selNews.city + (pn ? `, ${pn.n}` : ''),
				coords: `Lat ${fmt(selNews.lat)} · Lon ${fmt(selNews.lon)}`,
				bg: GRIS_100,
				blocked: false,
			};
		}
		return {
			label: 'Siguiente paso',
			ic: 'info' as const,
			title: P ? 'Toca un cantón en el mapa' : 'Elige una provincia',
			meta: `Fijaremos la ubicación exacta de tu noticia dentro de ${P ? P.n : 'Ecuador'}.`,
			coords: '',
			bg: GRIS_100,
			blocked: true,
		};
	}

	function renderPanels() {
		if (!geo) return;
		const P = prov ? provByCode(prov) : null;

		crumb.innerHTML = P
			? `<button type="button" data-act="country" class="crumb-back"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>Ecuador</button><span class="crumb-name">${esc(P.n)}</span>`
			: `<span class="crumb-name">Ecuador · ${geo.provinces.length} provincias</span>`;

		hint.textContent = P ? 'Toca un cantón para fijar el punto exacto · Arrastra para moverte' : 'Toca una provincia para ver sus cantones';

		if (!P) {
			const items = [...geo.provinces]
				.sort((a, b) => a.n.localeCompare(b.n, 'es'))
				.map((p) => {
					const n = counts[p.c] || 0;
					return `<button type="button" class="prov-btn${n ? ' has' : ''}" data-prov="${p.c}"><span class="nm">${esc(p.n)}</span>${n ? `<span class="ct" aria-label="${n} noticias">${n}</span>` : ''}</button>`;
				})
				.join('');
			explore.innerHTML = `<h3 class="side-h">Explora por provincia</h3><p class="side-p">Toca una provincia para ver sus cantones y sus noticias. El número indica cuántas noticias tiene.</p><div class="prov-grid">${items}</div>`;
		} else {
			const cantons = cantonsOf(P.c);
			const news = mapNews.filter((n) => n.c === P.c);
			const list = news
				.map((n) => {
					const on = sel === n.id;
					const bar = n.urgent ? CORAL : on ? INK : AMARILLO;
					return `<button type="button" class="news-btn${on ? ' on' : ''}" data-news="${n.id}" aria-pressed="${on}" style="--bar:${bar}"><span class="k">${esc(n.city)} · ${esc(n.tag)}</span><span class="t">${esc(n.title)}</span></button>`;
				})
				.join('');
			const opts = cantons
				.slice()
				.sort((a, b) => a.n.localeCompare(b.n, 'es'))
				.map((k) => `<option value="${k.c}"${custom?.code === k.c ? ' selected' : ''}>${esc(k.n)}</option>`)
				.join('');
			explore.innerHTML = `
				<button type="button" data-act="country" class="side-back"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>Todo Ecuador</button>
				<h3 class="side-prov">${esc(P.n)}</h3>
				<span class="side-meta">Capital: ${esc(P.cap)} · ${cantons.length} cantones</span>
				<span class="side-cap">Noticias en la provincia</span>
				${list}
				${news.length ? '' : '<p class="side-empty">Aún no hay noticias en esta provincia. Toca un cantón en el mapa para crear la primera.</p>'}
				<label class="field-sm"><span>Elegir cantón sin usar el mapa</span><select data-canton><option value="">Selecciona un cantón</option>${opts}</select></label>`;
		}

		const i = currentInfo();
		info.style.background = i.bg;
		info.innerHTML = `<span class="i-label">${icon(i.ic)}${esc(i.label)}</span><span class="i-title">${esc(i.title)}</span><span class="i-meta">${esc(i.meta)}</span>${i.coords ? `<span class="i-coords">${esc(i.coords)}</span>` : ''}`;
		btnPublish.disabled = i.blocked;
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
			const n = mapNews.find((x) => x.id === pin.dataset.id)!;
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
		if (t.id === 'map-ocean') {
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

	const root = $('mapa')!;
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
		if (!t.matches('[data-canton]') || !geo) return;
		const k = geo.cantons.find((x) => x.c === t.value);
		if (!k) return;
		setCustomAt(k.l[0], k.l[1], k);
		// El cambio re-renderiza el panel: devolver el foco al selector
		root.querySelector<HTMLSelectElement>('[data-canton]')?.focus();
	});

	formEl.addEventListener('submit', (e) => {
		e.preventDefault();
		publishStatus.dataset.kind = '';
		const title = formEl.elements.namedItem('titular') as HTMLInputElement;
		title.removeAttribute('aria-invalid');
		if (btnPublish.disabled) {
			publishStatus.textContent = 'Primero elige un punto dentro de Ecuador en el mapa.';
			publishStatus.dataset.kind = 'error';
			return;
		}
		if (title.value.trim().length < 8) {
			title.setAttribute('aria-invalid', 'true');
			title.focus();
			publishStatus.textContent = 'Escribe un titular de al menos 8 caracteres: verbo en presente y sujeto concreto.';
			publishStatus.dataset.kind = 'error';
			return;
		}
		// Sin servicio de recepción conectado todavía: confirmación local.
		formEl.reset();
		publishStatus.textContent = 'Recibimos tu noticia. Un editor la revisará antes de publicarla en el mapa.';
		publishStatus.dataset.kind = 'ok';
	});

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

initMap();
