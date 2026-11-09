/**
 * Autenticación del panel /admin (Better Auth + Drizzle).
 * No hay registro público: las cuentas se crean desde /admin/usuarios (o `pnpm admin:crear`) y cada persona
 * elige su contraseña con un enlace de un solo uso (ver lib/cuentas.ts).
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { BETTER_AUTH_SECRET, SITE_URL } from 'astro:env/server';
import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';
import { HORAS_RESTABLECER, urlActivar } from './cuentas.ts';
import { avisarCambioClave, enviarEnlace } from './avisos-cuenta.ts';

export const auth = betterAuth({
	baseURL: SITE_URL,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
	}),
	emailAndPassword: {
		enabled: true,
		disableSignUp: true,
		minPasswordLength: 12,
		maxPasswordLength: 128,
		// «¿Olvidaste tu contraseña?»: el enlace lleva a /admin/activar/ con el token en el fragmento
		resetPasswordTokenExpiresIn: HORAS_RESTABLECER * 3600,
		sendResetPassword: async ({ user, token }) => {
			await enviarEnlace(user, 'restablecer', urlActivar(SITE_URL, token));
		},
		// Al poner una contraseña nueva se cierran todas las sesiones y se avisa por correo
		revokeSessionsOnPasswordReset: true,
		onPasswordReset: async ({ user }) => {
			await avisarCambioClave(user);
		},
	},
	// Los tokens de los enlaces se guardan con hash: leer la tabla no permite usarlos
	verification: { storeIdentifier: 'hashed' },
	user: {
		additionalFields: {
			rol: { type: 'string', required: false, defaultValue: 'editor', input: false },
		},
	},
	session: {
		// La sesión vence tras 3 días sin usar el panel (se renueva cada 12 h de uso)
		expiresIn: 60 * 60 * 24 * 3,
		updateAge: 60 * 60 * 12,
	},
	rateLimit: {
		enabled: true,
		window: 60,
		max: 20,
		customRules: {
			'/sign-in/email': { window: 60, max: 5 },
			'/request-password-reset': { window: 600, max: 3 },
			'/reset-password': { window: 600, max: 10 },
		},
	},
	advanced: {
		// Detrás de Cloudflare + Railway, X-Forwarded-For trae varias IPs y Better Auth no sabría cuál es la del
		// visitante: todos compartirían un solo contador y cualquiera podría bloquear el login de la redacción.
		// Cloudflare fija cf-connecting-ip con la IP real (y la sobrescribe si el visitante la manda).
		ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
	},
});

export type Sesion = typeof auth.$Infer.Session;
