/**
 * Extensiones del editor de notas. Se usan en el navegador (editor) y en el servidor (render a HTML),
 * así ambos entienden exactamente el mismo documento.
 */
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

export interface AttrsImagen {
	medioId: string;
	key: string;
	ancho: number | null;
	alto: number | null;
	alt: string;
	credito: string;
	pie: string;
	/** URL de vista previa en el editor (el servidor recalcula las URLs al guardar) */
	src: string;
}

export interface AttrsVideo {
	medioId: string;
	/** UID de Cloudflare Stream; si falta, es un archivo en `key` */
	streamUid: string | null;
	key: string | null;
	pie: string;
	credito: string;
	/** Vista previa en el editor */
	poster: string;
}

export interface AttrsYoutube {
	/** ID de 11 caracteres del video */
	videoId: string;
	/** Segundo en que empieza (0 = desde el inicio) */
	inicio: number;
	pie: string;
}

/**
 * Saca el ID (y el segundo de inicio) de un enlace de YouTube:
 * youtube.com/watch?v=…, youtu.be/…, /shorts/…, /live/…, /embed/…, m.youtube.com y music.youtube.com.
 * Devuelve null si no es un enlace válido de YouTube.
 */
export function leerYoutube(texto: string): { videoId: string; inicio: number } | null {
	let u: URL;
	try {
		u = new URL(texto.trim().replace(/^(?!https?:\/\/)/, 'https://'));
	} catch {
		return null;
	}
	const host = u.hostname.replace(/^(www|m|music)\./, '');
	let id: string | null = null;
	if (host === 'youtu.be') id = u.pathname.split('/')[1] ?? null;
	else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
		const [, primero, segundo] = u.pathname.split('/');
		id = primero === 'watch' ? u.searchParams.get('v') : ['shorts', 'live', 'embed', 'v'].includes(primero ?? '') ? (segundo ?? null) : null;
	}
	if (!id || !ID_YOUTUBE.test(id)) return null;
	return { videoId: id, inicio: segundos(u.searchParams.get('t') ?? u.searchParams.get('start') ?? '') };
}

export const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;

/** «90», «90s», «1m30s», «1h2m3s» → segundos */
function segundos(t: string) {
	if (/^\d+s?$/.test(t)) return parseInt(t, 10);
	const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
	return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}

const attr = (def: unknown) => ({ default: def });

/** Imagen de referencia anclada en el texto */
export const ImagenBloque = Node.create({
	name: 'imagenBloque',
	group: 'block',
	atom: true,
	draggable: true,
	addAttributes() {
		return {
			medioId: attr(''),
			key: attr(''),
			ancho: attr(null),
			alto: attr(null),
			alt: attr(''),
			credito: attr(''),
			pie: attr(''),
			src: attr(''),
		};
	},
	parseHTML() {
		return [{ tag: 'figure[data-imagen]' }];
	},
	renderHTML({ HTMLAttributes: a }) {
		return [
			'figure',
			mergeAttributes({ 'data-imagen': '', class: 'ed-fig' }),
			['img', { src: a.src, alt: a.alt, width: a.ancho, height: a.alto }],
			['figcaption', {}, [a.pie, a.credito].filter(Boolean).join(' · ') || 'Sin pie de foto'],
		];
	},
});

/** Video de referencia anclado en el texto */
export const VideoBloque = Node.create({
	name: 'videoBloque',
	group: 'block',
	atom: true,
	draggable: true,
	addAttributes() {
		return {
			medioId: attr(''),
			streamUid: attr(null),
			key: attr(null),
			pie: attr(''),
			credito: attr(''),
			poster: attr(''),
		};
	},
	parseHTML() {
		return [{ tag: 'figure[data-video]' }];
	},
	renderHTML({ HTMLAttributes: a }) {
		return [
			'figure',
			mergeAttributes({ 'data-video': '', class: 'ed-fig ed-fig--video' }),
			a.poster ? ['img', { src: a.poster, alt: '' }] : ['div', { class: 'ed-video-ph' }, '▶ Video'],
			['figcaption', {}, `Video${a.pie ? ` · ${a.pie}` : ''}`],
		];
	},
});

/** Video de YouTube anclado en el texto (se publica con youtube-nocookie.com) */
export const YoutubeBloque = Node.create({
	name: 'youtubeBloque',
	group: 'block',
	atom: true,
	draggable: true,
	addAttributes() {
		return { videoId: attr(''), inicio: attr(0), pie: attr('') };
	},
	parseHTML() {
		return [{ tag: 'figure[data-youtube]' }];
	},
	renderHTML({ HTMLAttributes: a }) {
		// En el editor solo la miniatura: no carga el reproductor mientras se escribe
		return [
			'figure',
			mergeAttributes({ 'data-youtube': '', class: 'ed-fig ed-fig--video' }),
			['img', { src: `https://i.ytimg.com/vi/${a.videoId}/hqdefault.jpg`, alt: '' }],
			['figcaption', {}, `YouTube${a.pie ? ` · ${a.pie}` : ''}`],
		];
	},
});

export const extensiones = [
	StarterKit.configure({
		heading: { levels: [2, 3] },
		code: false,
		codeBlock: false,
		link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { rel: 'noopener', target: null } },
	}),
	ImagenBloque,
	VideoBloque,
	YoutubeBloque,
];
