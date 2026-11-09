/** Correos de acceso al panel: invitación, restablecer contraseña y aviso de cambio. */
import { RESEND_API_KEY } from 'astro:env/server';
import { enviarCorreo } from './correo.ts';
import { HORAS_INVITACION, HORAS_RESTABLECER } from './cuentas.ts';

type Persona = { email: string; name: string };

const textos = {
	invitacion: (p: Persona, url: string) => ({
		asunto: 'Tu acceso al panel de Banana News',
		texto: `Hola, ${p.name}:\n\nTe crearon una cuenta en el panel de la redacción de Banana News. Para empezar, elige tu contraseña aquí:\n\n${url}\n\nEl enlace sirve una sola vez y vence en ${HORAS_INVITACION} horas. Si no esperabas este correo, ignóralo.\n\n— Banana News`,
	}),
	restablecer: (p: Persona, url: string) => ({
		asunto: 'Restablece tu contraseña · Banana News',
		texto: `Hola, ${p.name}:\n\nPara poner una contraseña nueva en el panel de Banana News, entra aquí:\n\n${url}\n\nEl enlace sirve una sola vez y vence en ${HORAS_RESTABLECER} horas. Si no lo pediste, ignora este correo: tu contraseña no cambia.\n\n— Banana News`,
	}),
};

/**
 * Envía el enlace. Devuelve true solo si salió de verdad por Resend: sin correo configurado (desarrollo)
 * el panel muestra el enlace al administrador para que lo entregue por otro canal.
 */
export async function enviarEnlace(p: Persona, tipo: keyof typeof textos, url: string) {
	const { asunto, texto } = textos[tipo](p, url);
	const ok = await enviarCorreo({ para: p.email, asunto, texto });
	return ok && !!RESEND_API_KEY;
}

/** Aviso de seguridad cuando cambia la contraseña */
export function avisarCambioClave(p: Persona) {
	return enviarCorreo({
		para: p.email,
		asunto: 'Tu contraseña del panel cambió · Banana News',
		texto: `Hola, ${p.name}:\n\nLa contraseña de tu cuenta del panel de Banana News acaba de cambiar y se cerraron tus sesiones abiertas.\n\nSi no fuiste tú, avisa de inmediato a un administrador.\n\n— Banana News`,
	});
}
