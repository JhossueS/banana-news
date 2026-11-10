/** Documento TipTap → HTML sanitizado para la nota pública (sin dependencias de Astro). */
import sanitizeHtml from 'sanitize-html';
import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';
import { escapeHTML, escapeHTMLAttribute } from '@tiptap/static-renderer';
import type { JSONContent } from '@tiptap/core';
import { extensiones, ID_YOUTUBE, type AttrsImagen, type AttrsVideo, type AttrsYoutube } from '../editor/extensiones.ts';
import type { Medios } from './medios.ts';

const caption = (pie: string, credito: string) =>
	pie || credito
		? `<figcaption>${escapeHTML(pie)}${pie && credito ? ' ' : ''}${credito ? `<span class="credito">${escapeHTML(credito)}</span>` : ''}</figcaption>`
		: '';

export function renderCuerpo(doc: JSONContent, medios: Medios) {
	if (!doc || doc.type !== 'doc') return '';
	const html = renderToHTMLString({
		content: doc,
		extensions: extensiones,
		options: {
			nodeMapping: {
				imagenBloque: ({ node }) => {
					const a = node.attrs as AttrsImagen;
					if (!a.key) return '';
					const srcset = medios.srcsetImagen(a.key, a.ancho);
					const dims = a.ancho && a.alto ? ` width="${a.ancho}" height="${a.alto}"` : '';
					const sizes = ' sizes="(min-width: 900px) 760px, 100vw"';
					const fuentes = medios.fuentesImagen(a.key, a.ancho)?.sources ?? [];
					const sources = fuentes.map((f) => `<source type="${f.type}" srcset="${escapeHTMLAttribute(f.srcset)}"${sizes}>`).join('');
					const img = `<img src="${escapeHTMLAttribute(medios.urlImagen(a.key, 1200, a.ancho))}"${
						srcset ? ` srcset="${escapeHTMLAttribute(srcset)}"${sizes}` : ''
					} alt="${escapeHTMLAttribute(a.alt)}"${dims} loading="lazy" decoding="async">`;
					return `<figure class="fig">${sources ? `<picture>${sources}${img}</picture>` : img}${caption(a.pie, a.credito)}</figure>`;
				},
				videoBloque: ({ node }) => {
					const a = node.attrs as AttrsVideo;
					const titulo = escapeHTMLAttribute(a.pie || 'Video');
					if (a.streamUid) {
						return `<figure class="fig fig--video"><div class="video"><iframe src="${escapeHTMLAttribute(
							`${medios.urlStream(a.streamUid)}?poster=${encodeURIComponent(medios.posterStream(a.streamUid))}`,
						)}" title="${titulo}" loading="lazy" allow="accelerometer; gyroscope; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>${caption(a.pie, a.credito)}</figure>`;
					}
					if (a.key) {
						return `<figure class="fig fig--video"><div class="video"><video src="${escapeHTMLAttribute(medios.urlArchivo(a.key))}" controls preload="metadata" title="${titulo}"></video></div>${caption(a.pie, a.credito)}</figure>`;
					}
					return '';
				},
				youtubeBloque: ({ node }) => {
					const a = node.attrs as AttrsYoutube;
					// El iframe se arma aquí con el ID validado: nunca se guarda HTML pegado por el editor
					if (!ID_YOUTUBE.test(a.videoId ?? '')) return '';
					const inicio = Number.isInteger(a.inicio) && a.inicio > 0 ? `&start=${a.inicio}` : '';
					const src = `https://www.youtube-nocookie.com/embed/${a.videoId}?rel=0${inicio}`;
					return `<figure class="fig fig--video"><div class="video"><iframe src="${escapeHTMLAttribute(src)}" title="${escapeHTMLAttribute(
						a.pie || 'Video de YouTube',
					)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>${caption(a.pie, '')}</figure>`;
				},
			},
		},
	});
	return sanear(html);
}

export function sanear(html: string) {
	return sanitizeHtml(html, {
		allowedTags: ['p', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'strong', 'em', 'u', 's', 'a', 'br', 'hr', 'figure', 'figcaption', 'picture', 'source', 'img', 'iframe', 'video', 'div', 'span'],
		allowedAttributes: {
			a: ['href', 'rel', 'target'],
			source: ['type', 'srcset', 'sizes'],
			img: ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding'],
			iframe: ['src', 'title', 'loading', 'allow', 'allowfullscreen', 'referrerpolicy'],
			video: ['src', 'controls', 'preload', 'title'],
			figure: ['class'],
			div: ['class'],
			span: ['class'],
		},
		allowedSchemes: ['https', 'http', 'mailto'],
		allowedSchemesAppliedToAttributes: ['href', 'src'],
		allowProtocolRelative: false,
		// Solo los reproductores de Cloudflare Stream y YouTube sin cookies
		allowedIframeDomains: ['cloudflarestream.com', 'videodelivery.net', 'youtube-nocookie.com'],
		transformTags: {
			a: (tag, attribs) => {
				const externo = /^https?:/.test(attribs.href ?? '');
				return { tagName: tag, attribs: { ...attribs, ...(externo ? { rel: 'noopener', target: '_blank' } : {}) } };
			},
		},
	});
}

/** Palabras del texto, para el tiempo de lectura */
export function contarPalabras(doc: JSONContent): number {
	let n = 0;
	const walk = (x: JSONContent) => {
		if (x.text) n += x.text.trim().split(/\s+/).filter(Boolean).length;
		x.content?.forEach(walk);
	};
	walk(doc);
	return n;
}
