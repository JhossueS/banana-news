/** Formas JSON que el panel recibe de la API */
import type { tablas } from '../db/index.ts';
import { medios } from './medios.ts';

type Medio = typeof tablas.medios.$inferSelect;

export const medioVista = (m: Medio) => ({
	id: m.id,
	tipo: m.tipo,
	key: m.r2Key,
	streamUid: m.streamUid,
	ancho: m.ancho,
	alto: m.alto,
	alt: m.alt,
	credito: m.credito,
	listo: m.listo,
	creado: m.creado,
	/** Miniatura para el panel */
	vista: m.tipo === 'imagen' && m.r2Key ? medios.urlImagen(m.r2Key, 480, m.ancho) : m.streamUid ? medios.posterStream(m.streamUid) : '',
	url: m.r2Key ? medios.urlArchivo(m.r2Key) : m.streamUid ? medios.urlStream(m.streamUid) : '',
});
export type MedioVista = ReturnType<typeof medioVista>;
