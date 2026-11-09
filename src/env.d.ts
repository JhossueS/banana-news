declare namespace App {
	interface Locals {
		usuario: import('./lib/auth').Sesion['user'] | null;
		sesion: import('./lib/auth').Sesion['session'] | null;
	}
}
