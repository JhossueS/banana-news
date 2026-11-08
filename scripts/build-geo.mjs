// Genera public/data/ecuador.json (provincias + cantones proyectados a SVG)
// desde geoBoundaries (CC BY 4.0, gbOpen ECU ADM1/ADM2 simplified).
//
//   node scripts/build-geo.mjs <ADM1.geojson> <ADM2.geojson>
//
// Proyección idéntica a la del diseño: continente x=(lon+83.4)*100, y=(1.6-lat)*100;
// Galápagos se recoloca en un recuadro: x=(lon+92)*70+15, y=(0.8-lat)*70+40.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const [adm1Path, adm2Path] = process.argv.slice(2);
if (!adm1Path || !adm2Path) {
	console.error('Uso: node scripts/build-geo.mjs <ADM1.geojson> <ADM2.geojson>');
	process.exit(1);
}

// Código INEC · nombre · etiqueta corta · capital
const PROVINCES = {
	Azuay: ['01', 'Azuay', 'Azuay', 'Cuenca'],
	'Bolívar': ['02', 'Bolívar', 'Bolívar', 'Guaranda'],
	'Cañar': ['03', 'Cañar', 'Cañar', 'Azogues'],
	Carchi: ['04', 'Carchi', 'Carchi', 'Tulcán'],
	Cotopaxi: ['05', 'Cotopaxi', 'Cotopaxi', 'Latacunga'],
	Chimborazo: ['06', 'Chimborazo', 'Chimborazo', 'Riobamba'],
	'El Oro': ['07', 'El Oro', 'El Oro', 'Machala'],
	Esmeraldas: ['08', 'Esmeraldas', 'Esmeraldas', 'Esmeraldas'],
	Guayas: ['09', 'Guayas', 'Guayas', 'Guayaquil'],
	Imbabura: ['10', 'Imbabura', 'Imbabura', 'Ibarra'],
	Loja: ['11', 'Loja', 'Loja', 'Loja'],
	'Los Ríos': ['12', 'Los Ríos', 'Los Ríos', 'Babahoyo'],
	Manabi: ['13', 'Manabí', 'Manabí', 'Portoviejo'],
	'Morona Santiago': ['14', 'Morona Santiago', 'Morona S.', 'Macas'],
	Napo: ['15', 'Napo', 'Napo', 'Tena'],
	Pastaza: ['16', 'Pastaza', 'Pastaza', 'Puyo'],
	Pichincha: ['17', 'Pichincha', 'Pichincha', 'Quito'],
	Tungurahua: ['18', 'Tungurahua', 'Tungurahua', 'Ambato'],
	'Zamora Chinchipe': ['19', 'Zamora Chinchipe', 'Z. Chinchipe', 'Zamora'],
	'Galápagos': ['20', 'Galápagos', 'Galápagos', 'Puerto Baquerizo Moreno'],
	Sucumbios: ['21', 'Sucumbíos', 'Sucumbíos', 'Nueva Loja'],
	Orellana: ['22', 'Orellana', 'Orellana', 'Puerto Francisco de Orellana'],
	'Santo Domingo de los Tsáchilas': ['23', 'Santo Domingo de los Tsáchilas', 'Sto. Domingo', 'Santo Domingo'],
	'Santa Elena': ['24', 'Santa Elena', 'Sta. Elena', 'Santa Elena'],
};

const project = ([lon, lat]) =>
	lon < -85 ? [(lon + 92) * 70 + 15, (0.8 - lat) * 70 + 40] : [(lon + 83.4) * 100, (1.6 - lat) * 100];

// Douglas-Peucker sobre coordenadas ya proyectadas (unidades del viewBox)
function simplify(pts, tol) {
	if (pts.length < 5) return pts;
	const keep = new Uint8Array(pts.length);
	keep[0] = keep[pts.length - 1] = 1;
	const stack = [[0, pts.length - 1]];
	// Anillo cerrado (primer == último punto): partir en el punto más lejano del inicio
	const [fx, fy] = pts[0], [lx, ly] = pts[pts.length - 1];
	if (fx === lx && fy === ly) {
		let far = 0, fd = -1;
		pts.forEach(([x, y], i) => { const d = Math.hypot(x - fx, y - fy); if (d > fd) { fd = d; far = i; } });
		keep[far] = 1;
		stack.length = 0;
		stack.push([0, far], [far, pts.length - 1]);
	}
	while (stack.length) {
		const [a, b] = stack.pop();
		let max = 0, idx = -1;
		const [ax, ay] = pts[a], [bx, by] = pts[b];
		const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
		for (let i = a + 1; i < b; i++) {
			const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
			if (d > max) { max = d; idx = i; }
		}
		if (max > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
	}
	return pts.filter((_, i) => keep[i]);
}

const r1 = (n) => Math.round(n * 10) / 10;

function rings(geom) {
	const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
	return polys.map((poly) => poly.map((ring) => ring.map(project)));
}

function build(feature, tol) {
	const polys = rings(feature.geometry);
	let d = '';
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	let best = { area: -1, c: [0, 0] };
	for (const poly of polys) {
		poly.forEach((ring, ri) => {
			const s = simplify(ring, tol);
			if (s.length < 4) return;
			d += 'M' + s.map(([x, y]) => r1(x) + ' ' + r1(y)).join('L') + 'Z';
			for (const [x, y] of s) {
				if (x < minX) minX = x; if (x > maxX) maxX = x;
				if (y < minY) minY = y; if (y > maxY) maxY = y;
			}
			if (ri === 0) {
				// centroide ponderado por área del anillo exterior más grande
				let a = 0, cx = 0, cy = 0;
				for (let i = 0; i < s.length - 1; i++) {
					const [x0, y0] = s[i], [x1, y1] = s[i + 1];
					const f = x0 * y1 - x1 * y0;
					a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
				}
				a /= 2;
				if (Math.abs(a) > best.area && a !== 0) best = { area: Math.abs(a), c: [cx / (6 * a), cy / (6 * a)] };
			}
		});
	}
	return { d, b: [r1(minX), r1(minY), r1(maxX - minX), r1(maxY - minY)], l: [r1(best.c[0]), r1(best.c[1])], polys };
}

function inRing(p, ring) {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i], [xj, yj] = ring[j];
		if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}
const inPolys = (p, polys) => polys.some((poly) => inRing(p, poly[0]));

const adm1 = JSON.parse(readFileSync(adm1Path, 'utf8')).features;
const adm2 = JSON.parse(readFileSync(adm2Path, 'utf8')).features;

const provinces = adm1.map((f) => {
	const meta = PROVINCES[f.properties.shapeName];
	if (!meta) throw new Error('Provincia desconocida: ' + f.properties.shapeName);
	const g = build(f, 0.35);
	return { c: meta[0], n: meta[1], s: meta[2], cap: meta[3], d: g.d, b: g.b, l: g.l, _polys: g.polys };
}).sort((a, b) => a.c.localeCompare(b.c));

// Aliases de capital cantonal cuyo nombre en geoBoundaries difiere de la capital provincial
const CAPITAL_ALIAS = { 'Puerto Baquerizo Moreno': 'San Cristobal', 'Puerto Francisco de Orellana': 'Orellana', 'Nueva Loja': 'Lago Agrio', Macas: 'Morona', Puyo: 'Pastaza' };
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const cantons = [];
const orphans = [];
for (const f of adm2) {
	const g = build(f, 0.3);
	if (!g.d) { console.warn("sin geometría:", f.properties.shapeName); continue; }
	// provincia: la que contiene el centroide; si cae fuera (forma cóncava), probar con el centro del bbox y el primer vértice
	const probes = [g.l, [g.b[0] + g.b[2] / 2, g.b[1] + g.b[3] / 2], g.polys[0][0][0]];
	let prov = null;
	for (const pt of probes) { prov = provinces.find((p) => inPolys(pt, p._polys)); if (prov) break; }
	if (!prov) { orphans.push(f.properties.shapeName); continue; }
	cantons.push({ p: prov.c, n: f.properties.shapeName, d: g.d, l: g.l });
}
if (orphans.length) console.warn('Cantones sin provincia:', orphans.join(', '));

// Códigos de cantón: provincia + índice; el 01 es la capital provincial
for (const p of provinces) {
	const list = cantons.filter((k) => k.p === p.c).sort((a, b) => a.n.localeCompare(b.n, 'es'));
	const capName = norm(CAPITAL_ALIAS[p.cap] || p.cap);
	const capIdx = list.findIndex((k) => norm(k.n) === capName);
	if (capIdx > 0) list.unshift(list.splice(capIdx, 1)[0]);
	if (capIdx < 0) console.warn('Sin cantón capital para', p.n, '(' + p.cap + ')');
	list.forEach((k, i) => { k.c = p.c + String(i + 1).padStart(2, '0'); });
}

const out = {
	provinces: provinces.map(({ _polys, ...p }) => p),
	cantons: cantons.map((k) => ({ c: k.c, p: k.p, n: k.n, d: k.d, l: k.l })),
	source: 'geoBoundaries gbOpen ECU ADM1/ADM2 (CC BY 4.0)',
};
mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true });
const file = new URL('../public/data/ecuador.json', import.meta.url);
writeFileSync(file, JSON.stringify(out));
console.log(`provincias ${out.provinces.length} · cantones ${out.cantons.length} · ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
