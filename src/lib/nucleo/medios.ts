/**
 * Almacenamiento y URLs de medios, sin dependencias de Astro (lo usan también los scripts).
 * - Con credenciales de R2: objetos en Cloudflare R2 (API S3), subida directa con URL presignada.
 * - Sin ellas: archivos en `.data/media`, servidos por /api/media (públicos) y /api/admin/archivo (privados).
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';

export interface ConfigMedios {
	r2?: {
		accountId: string;
		accessKeyId: string;
		secretAccessKey: string;
		bucket: string;
		/** Bucket SIN acceso público para los adjuntos de denuncias. Sin él, van al bucket principal */
		bucketPrivado?: string;
	};
	/** Dominio público del bucket (sin barra final). Sin R2: '/api/media' */
	baseUrl: string;
	transformaciones: boolean;
	stream?: { accountId: string; token: string; customerCode?: string };
}

export const DIR_LOCAL = '.data/media';
/** Prefijo público (notas) y privado (adjuntos de denuncias) */
export const PREFIJO_PUBLICO = 'medios/';
export const PREFIJO_PRIVADO = 'denuncias/';

/** Rechaza cualquier clave con «..», «\\» o ruta absoluta: así el prefijo validado (medios/, denuncias/) es el real */
const claveSegura = (key: string) => {
	if (!key || key.startsWith('/') || key.includes('\\') || key.split('/').some((p) => p === '..' || p === '.')) throw new Error('Clave inválida');
	return normalize(key);
};

export function crearMedios(cfg: ConfigMedios) {
	let s3: Promise<import('@aws-sdk/client-s3').S3Client> | null = null;
	const cliente = () =>
		(s3 ??= import('@aws-sdk/client-s3').then(
			({ S3Client }) =>
				new S3Client({
					region: 'auto',
					endpoint: `https://${cfg.r2!.accountId}.r2.cloudflarestorage.com`,
					credentials: { accessKeyId: cfg.r2!.accessKeyId, secretAccessKey: cfg.r2!.secretAccessKey },
				}),
		));

	const local = !cfg.r2;
	/** Los adjuntos de denuncias van al bucket privado si está configurado */
	const bucketDe = (k: string) => (k.startsWith(PREFIJO_PRIVADO) && cfg.r2!.bucketPrivado) || cfg.r2!.bucket;

	return {
		local,
		/** ¿Los adjuntos de denuncias están en un bucket aparte (sin dominio público)? */
		bucketPrivado: !!cfg.r2?.bucketPrivado,

		/** Sube un archivo desde el servidor (adjuntos de denuncias, migración) */
		async guardar(key: string, cuerpo: Uint8Array, tipo: string) {
			const k = claveSegura(key);
			if (local) {
				const ruta = join(DIR_LOCAL, k);
				await mkdir(dirname(ruta), { recursive: true });
				await writeFile(ruta, cuerpo);
				return;
			}
			const { PutObjectCommand } = await import('@aws-sdk/client-s3');
			await (await cliente()).send(new PutObjectCommand({ Bucket: bucketDe(k), Key: k, Body: cuerpo, ContentType: tipo }));
		},

		async borrar(key: string) {
			const k = claveSegura(key);
			if (local) return rm(join(DIR_LOCAL, k), { force: true });
			const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
			await (await cliente()).send(new DeleteObjectCommand({ Bucket: bucketDe(k), Key: k }));
		},

		/** Lee un archivo local (.data/media) */
		async leerLocal(key: string) {
			return readFile(join(DIR_LOCAL, claveSegura(key)));
		},

		/** Lee un archivo del bucket R2 (para servirlo por /api/media cuando no hay dominio público). null si no existe */
		async leerR2(key: string): Promise<{ cuerpo: Uint8Array; tipo?: string } | null> {
			if (local) return null;
			const { GetObjectCommand } = await import('@aws-sdk/client-s3');
			try {
				const r = await (await cliente()).send(new GetObjectCommand({ Bucket: cfg.r2!.bucket, Key: claveSegura(key) }));
				return { cuerpo: await r.Body!.transformToByteArray(), tipo: r.ContentType };
			} catch (e) {
				if ((e as { name?: string }).name === 'NoSuchKey') return null;
				throw e;
			}
		},

		/** URL para que el navegador suba el archivo directo (PUT), sin pasar por el servidor */
		async urlSubida(key: string, tipo: string) {
			const k = claveSegura(key);
			if (local) return `/api/admin/subida-local/${k}`;
			const [{ PutObjectCommand }, { getSignedUrl }] = await Promise.all([
				import('@aws-sdk/client-s3'),
				import('@aws-sdk/s3-request-presigner'),
			]);
			return getSignedUrl(await cliente(), new PutObjectCommand({ Bucket: cfg.r2!.bucket, Key: k, ContentType: tipo }), { expiresIn: 600 });
		},

		/** URL temporal para DESCARGAR un archivo privado (nunca se abre en el navegador: podría traer HTML o SVG) */
		async urlPrivada(key: string) {
			const k = claveSegura(key);
			if (local) return `/api/admin/archivo/${k}`;
			const [{ GetObjectCommand }, { getSignedUrl }] = await Promise.all([
				import('@aws-sdk/client-s3'),
				import('@aws-sdk/s3-request-presigner'),
			]);
			return getSignedUrl(
				await cliente(),
				new GetObjectCommand({
					Bucket: bucketDe(k),
					Key: k,
					ResponseContentDisposition: `attachment; filename="${k.split('/').pop()}"`,
					ResponseContentType: 'application/octet-stream',
				}),
				{ expiresIn: 900 },
			);
		},

		/** URL pública de una imagen, opcionalmente redimensionada por Cloudflare */
		urlImagen(key: string, ancho?: number) {
			const base = cfg.baseUrl.replace(/\/$/, '');
			if (ancho && cfg.transformaciones) return `${base}/cdn-cgi/image/width=${ancho},format=auto,quality=80/${key}`;
			return `${base}/${key}`;
		},

		/** srcset con los anchos útiles para este original (no agranda) */
		srcsetImagen(key: string, anchoOriginal?: number | null, anchos = [480, 800, 1200, 1600]) {
			if (!cfg.transformaciones) return undefined;
			const lista = anchos.filter((w) => !anchoOriginal || w <= anchoOriginal);
			if (anchoOriginal && !lista.includes(anchoOriginal) && anchoOriginal < (anchos.at(-1) ?? 0)) lista.push(anchoOriginal);
			return lista.map((w) => `${this.urlImagen(key, w)} ${w}w`).join(', ');
		},

		urlArchivo(key: string) {
			return `${cfg.baseUrl.replace(/\/$/, '')}/${key}`;
		},

		/** iframe del reproductor de Cloudflare Stream */
		urlStream(uid: string) {
			const code = cfg.stream?.customerCode;
			return code ? `https://customer-${code}.cloudflarestream.com/${uid}/iframe` : `https://iframe.videodelivery.net/${uid}`;
		},

		/** Póster automático de Stream */
		posterStream(uid: string) {
			const code = cfg.stream?.customerCode;
			return code
				? `https://customer-${code}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg?height=720`
				: `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?height=720`;
		},

		stream: !!cfg.stream,

		/** Crea una subida directa en Stream: el navegador envía el archivo a `uploadURL` */
		async crearSubidaStream(maxSegundos = 3600) {
			if (!cfg.stream) throw new Error('Stream no está configurado');
			const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.stream.accountId}/stream/direct_upload`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${cfg.stream.token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ maxDurationSeconds: maxSegundos }),
			});
			const j = (await r.json()) as { success: boolean; result?: { uploadURL: string; uid: string }; errors?: unknown };
			if (!j.success || !j.result) throw new Error(`Stream: ${JSON.stringify(j.errors)}`);
			return j.result;
		},

		/** ¿El video ya se puede reproducir? */
		async videoListo(uid: string) {
			if (!cfg.stream) return true;
			const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.stream.accountId}/stream/${uid}`, {
				headers: { Authorization: `Bearer ${cfg.stream.token}` },
			});
			const j = (await r.json()) as { result?: { readyToStream?: boolean; input?: { width?: number; height?: number } } };
			return { listo: !!j.result?.readyToStream, ancho: j.result?.input?.width, alto: j.result?.input?.height };
		},
	};
}

export type Medios = ReturnType<typeof crearMedios>;

/** «media.dominio.com/» → «https://media.dominio.com» (sin esquema, las URLs quedarían relativas al sitio) */
const urlBase = (u: string) => (/^https?:\/\//i.test(u.trim()) ? u.trim() : `https://${u.trim()}`).replace(/\/+$/, '');

/** Configuración a partir de variables de entorno (scripts) */
export function configDesdeEnv(env: Record<string, string | undefined>): ConfigMedios {
	const r2 =
		env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET
			? {
					accountId: env.R2_ACCOUNT_ID,
					accessKeyId: env.R2_ACCESS_KEY_ID,
					secretAccessKey: env.R2_SECRET_ACCESS_KEY,
					bucket: env.R2_BUCKET,
					bucketPrivado: env.R2_BUCKET_PRIVADO || undefined,
				}
			: undefined;
	return {
		r2,
		baseUrl: r2 && env.MEDIA_BASE_URL ? urlBase(env.MEDIA_BASE_URL) : '/api/media',
		transformaciones: !!r2 && env.MEDIA_TRANSFORMACIONES === 'true',
		stream:
			env.CF_ACCOUNT_ID && env.CF_STREAM_TOKEN
				? { accountId: env.CF_ACCOUNT_ID, token: env.CF_STREAM_TOKEN, customerCode: env.CF_STREAM_CUSTOMER_CODE }
				: undefined,
	};
}

/**
 * Tipo real de un archivo por sus primeros bytes (no por lo que diga el navegador).
 * Solo fotos y videos comunes de celular; cualquier otra cosa (SVG, HTML, PDF…) devuelve null.
 */
export function detectarTipo(b: Uint8Array): { tipo: string; ext: string } | null {
	const ascii = (desde: number, hasta: number) => String.fromCharCode(...b.subarray(desde, hasta));
	if (b.length < 12) return null;
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { tipo: 'image/jpeg', ext: 'jpg' };
	if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return { tipo: 'image/png', ext: 'png' };
	if (ascii(0, 4) === 'GIF8') return { tipo: 'image/gif', ext: 'gif' };
	if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { tipo: 'image/webp', ext: 'webp' };
	if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { tipo: 'video/webm', ext: 'webm' };
	if (ascii(4, 8) === 'ftyp') {
		const marca = ascii(8, 12);
		if (/^(heic|heix|heim|heis|mif1|msf1)$/.test(marca)) return { tipo: 'image/heic', ext: 'heic' };
		if (/^(avif|avis)$/.test(marca)) return { tipo: 'image/avif', ext: 'avif' };
		if (marca === 'qt  ') return { tipo: 'video/quicktime', ext: 'mov' };
		return { tipo: 'video/mp4', ext: 'mp4' };
	}
	return null;
}
