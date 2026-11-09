/**
 * Crea una cuenta del panel (o da un enlace nuevo a una existente) desde la terminal.
 * Uso: pnpm admin:crear correo@dominio "Nombre" [admin|editor|moderador]
 *
 * Nunca recibe ni muestra contraseñas: imprime un ENLACE de un solo uso para que la persona elija la suya.
 * El enlace vence (48 h una cuenta nueva, 2 h una existente) y solo se guarda su hash en la base.
 * Para una cuenta existente, su contraseña actual sigue valiendo hasta que use el enlace; si sospechas
 * que está comprometida, usa además --bloquear (la quita y cierra sus sesiones al instante).
 */
import { eq } from 'drizzle-orm';
import { crearDb } from '../src/db/client.ts';
import { user, rol as rolEnum, type Rol } from '../src/db/schema.ts';
import { bloquearAcceso, crearCuenta, crearEnlaceAcceso, HORAS_INVITACION, HORAS_RESTABLECER } from '../src/lib/cuentas.ts';

const args = process.argv.slice(2);
const bloquear = args.includes('--bloquear');
const [email, name, rol = 'admin'] = args.filter((a) => !a.startsWith('--'));
const uso = () => {
	console.error('Uso: pnpm admin:crear correo@dominio "Nombre" [admin|editor|moderador] [--bloquear]');
	process.exit(1);
};
if (!email || !name || !(rolEnum.enumValues as readonly string[]).includes(rol)) uso();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email!)) uso();
if (process.env.BN_PASSWORD) {
	console.error('BN_PASSWORD ya no se usa: cada persona elige su contraseña con el enlace. Quítala de tu entorno.');
	process.exit(1);
}

const siteUrl = process.env.SITE_URL || 'http://localhost:4321';
const db = await crearDb(process.env.DATABASE_URL);
const correo = email!.toLowerCase();
const existente = await db.query.user.findFirst({ where: eq(user.email, correo) });

let id: string;
if (existente) {
	id = existente.id;
	await db.update(user).set({ name: name!, rol: rol as Rol, updatedAt: new Date() }).where(eq(user.id, id));
	if (bloquear) await bloquearAcceso(db, id);
} else {
	({ id } = await crearCuenta(db, { email: correo, name: name!, rol: rol as Rol }));
}
const horas = existente ? HORAS_RESTABLECER : HORAS_INVITACION;
const enlace = await crearEnlaceAcceso(db, id, horas, siteUrl);

console.log(`${existente ? 'Actualizada' : 'Creada'} la cuenta ${correo} (${rol}).${bloquear && existente ? ' Contraseña anterior anulada y sesiones cerradas.' : ''}`);
console.log(`\nEnlace para elegir la contraseña (un solo uso, vence en ${horas} h):\n\n  ${enlace}\n`);
console.log('Entrégalo por un canal privado. Si se pierde, vuelve a correr este comando: el enlace anterior deja de valer.');
process.exit(0);
