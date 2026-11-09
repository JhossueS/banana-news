/** Provincias de Ecuador con su código INEC (mismo orden y nombres que public/data/ecuador.json) */
export const provincias = [
	['01', 'Azuay'], ['02', 'Bolívar'], ['03', 'Cañar'], ['04', 'Carchi'], ['05', 'Cotopaxi'], ['06', 'Chimborazo'],
	['07', 'El Oro'], ['08', 'Esmeraldas'], ['09', 'Guayas'], ['10', 'Imbabura'], ['11', 'Loja'], ['12', 'Los Ríos'],
	['13', 'Manabí'], ['14', 'Morona Santiago'], ['15', 'Napo'], ['16', 'Pastaza'], ['17', 'Pichincha'], ['18', 'Tungurahua'],
	['19', 'Zamora Chinchipe'], ['20', 'Galápagos'], ['21', 'Sucumbíos'], ['22', 'Orellana'],
	['23', 'Santo Domingo de los Tsáchilas'], ['24', 'Santa Elena'],
] as const satisfies readonly (readonly [string, string])[];

export const codigosProvincia = provincias.map(([c]) => c) as string[];
export const nombreProvincia = (c: string | null | undefined) => provincias.find(([k]) => k === c)?.[1] ?? '';

/** Caja de Ecuador continental + Galápagos */
export const dentroDeEcuador = (lat: number, lon: number) => lat >= -5.1 && lat <= 1.7 && lon >= -92.1 && lon <= -75.1;
