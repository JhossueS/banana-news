/**
 * Página del archivo a partir del parámetro rest `[...pagina]`:
 * undefined → 1 · «pagina/N» → N · cualquier otra cosa → null (404).
 * «pagina/1» también es null: la página 1 vive solo en la ruta base.
 */
export function leerPagina(param: string | undefined): number | null {
	if (param === undefined || param === '') return 1;
	const m = /^pagina\/([1-9]\d{0,4})\/?$/.exec(param);
	if (!m) return null;
	const n = Number(m[1]);
	return n > 1 ? n : null;
}
