/** Envío de correo con Resend (API HTTP). Sin RESEND_API_KEY, el correo se escribe en el log. */
import { CORREO_REMITENTE, RESEND_API_KEY } from 'astro:env/server';

export interface Correo {
	para: string | string[];
	asunto: string;
	texto: string;
	responderA?: string;
}

export async function enviarCorreo(c: Correo): Promise<boolean> {
	if (!RESEND_API_KEY) {
		console.info(`[correo:simulado] para=${[c.para].flat().join(',')} asunto="${c.asunto}"\n${c.texto}`);
		return true;
	}
	try {
		const r = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				from: CORREO_REMITENTE,
				to: [c.para].flat(),
				subject: c.asunto,
				text: c.texto,
				...(c.responderA ? { reply_to: c.responderA } : {}),
			}),
		});
		if (!r.ok) console.error(`[correo] Resend respondió ${r.status}: ${await r.text()}`);
		return r.ok;
	} catch (e) {
		console.error('[correo] No se pudo enviar', e);
		return false;
	}
}
