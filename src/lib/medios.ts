/** Instancia de medios para el servidor de Astro */
import * as env from 'astro:env/server';
import { configDesdeEnv, crearMedios } from './nucleo/medios.ts';

export const medios = crearMedios(
	configDesdeEnv({
		R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
		R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
		R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
		R2_BUCKET: env.R2_BUCKET,
		R2_BUCKET_PRIVADO: env.R2_BUCKET_PRIVADO,
		MEDIA_BASE_URL: env.MEDIA_BASE_URL,
		MEDIA_TRANSFORMACIONES: String(env.MEDIA_TRANSFORMACIONES),
		CF_ACCOUNT_ID: env.CF_ACCOUNT_ID,
		CF_STREAM_TOKEN: env.CF_STREAM_TOKEN,
		CF_STREAM_CUSTOMER_CODE: env.CF_STREAM_CUSTOMER_CODE,
	}),
);
