/**
 * Subida de medios en dos pasos:
 * 1) /api/admin/medios/firma → dónde subir (URL presignada de R2, subida directa de Stream o local)
 * 2) el navegador sube el archivo directo y registra el medio en /api/admin/medios
 */
import { api, ErrorApi } from './api';
import type { MedioVista } from '../../lib/vistas-admin';

export type { MedioVista };

type Firma = { modo: 'put'; url: string; key: string; contentType: string } | { modo: 'stream'; url: string; uid: string };

/** Ancho y alto reales de una imagen antes de subirla */
export function dimensiones(file: File): Promise<{ ancho: number; alto: number } | null> {
	return new Promise((ok) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			ok({ ancho: img.naturalWidth, alto: img.naturalHeight });
			URL.revokeObjectURL(url);
		};
		img.onerror = () => {
			ok(null);
			URL.revokeObjectURL(url);
		};
		img.src = url;
	});
}

/** XHR para poder mostrar el progreso */
function enviar(metodo: 'PUT' | 'POST', url: string, cuerpo: Blob | FormData, tipo: string | null, progreso?: (p: number) => void) {
	return new Promise<void>((ok, mal) => {
		const x = new XMLHttpRequest();
		x.open(metodo, url);
		if (tipo) x.setRequestHeader('content-type', tipo);
		x.upload.onprogress = (e) => e.lengthComputable && progreso?.(e.loaded / e.total);
		x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : mal(new ErrorApi(`La subida falló (${x.status}).`)));
		x.onerror = () => mal(new ErrorApi('La subida falló. Revisa tu conexión (o la configuración CORS del bucket).'));
		x.send(cuerpo);
	});
}

export async function subirMedio(file: File, datos: { alt: string; credito: string }, progreso?: (p: number) => void): Promise<MedioVista> {
	const tipo = file.type.startsWith('video/') ? 'video' : 'imagen';
	const dims = tipo === 'imagen' ? await dimensiones(file) : null;
	const f = await api<Firma>('/api/admin/medios/firma', 'POST', { tipo, nombre: file.name, contentType: file.type, tamano: file.size });

	if (f.modo === 'stream') {
		const fd = new FormData();
		fd.append('file', file);
		await enviar('POST', f.url, fd, null, progreso);
		return api<MedioVista>('/api/admin/medios', 'POST', { tipo, streamUid: f.uid, alt: datos.alt, credito: datos.credito });
	}
	await enviar('PUT', f.url, file, f.contentType, progreso);
	return api<MedioVista>('/api/admin/medios', 'POST', {
		tipo,
		key: f.key,
		ancho: dims?.ancho ?? null,
		alto: dims?.alto ?? null,
		alt: datos.alt,
		credito: datos.credito,
	});
}
