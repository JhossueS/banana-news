/** Noticias de ejemplo que se ubican en el mapa. `c` es el código INEC de la provincia. */
export interface MapNews {
	id: string;
	c: string;
	city: string;
	tag: string;
	title: string;
	lat: number;
	lon: number;
	urgent: boolean;
}

export const mapNews: MapNews[] = [
	{ id: 'quito', c: '17', city: 'Quito', tag: 'Ciudad', title: 'Quito redefine la agenda urbana', lat: -0.1807, lon: -78.4678, urgent: false },
	{ id: 'quito2', c: '17', city: 'Quito', tag: 'Denuncia', title: 'Cortes de agua sin aviso en el sector norte', lat: -0.1065, lon: -78.4836, urgent: false },
	{ id: 'cotopaxi', c: '05', city: 'Volcán Cotopaxi', tag: 'Ambiente', title: 'El Cotopaxi mantiene actividad moderada', lat: -0.6772, lon: -78.4369, urgent: true },
	{ id: 'esmeraldas', c: '08', city: 'Esmeraldas', tag: 'Ambiente', title: 'Las claves para entender la temporada de lluvias', lat: 0.9682, lon: -79.6517, urgent: false },
	{ id: 'ibarra', c: '10', city: 'Ibarra', tag: 'Ciudad', title: 'Ibarra amplía su red de ciclovías', lat: 0.3517, lon: -78.1223, urgent: false },
	{ id: 'sdomingo', c: '23', city: 'Santo Domingo', tag: 'Ciudad', title: 'Santo Domingo ordena su comercio informal', lat: -0.253, lon: -79.1719, urgent: false },
	{ id: 'manta', c: '13', city: 'Manta', tag: 'Economía', title: 'La pesca en Manta, datos y contexto', lat: -0.9677, lon: -80.7089, urgent: false },
	{ id: 'ambato', c: '18', city: 'Ambato', tag: 'Ciudad', title: 'Ambato revisa su plan de tránsito', lat: -1.2491, lon: -78.6197, urgent: false },
	{ id: 'tena', c: '15', city: 'Tena', tag: 'Ambiente', title: 'Napo vigila el caudal de sus ríos', lat: -0.9938, lon: -77.8129, urgent: false },
	{ id: 'puyo', c: '16', city: 'Puyo', tag: 'Ecuador', title: 'Lo que debes saber hoy en Pastaza', lat: -1.4924, lon: -77.9984, urgent: false },
	{ id: 'guayaquil', c: '09', city: 'Guayaquil', tag: 'Economía', title: 'El comercio del puerto, datos y contexto', lat: -2.1894, lon: -79.8891, urgent: false },
	{ id: 'guayaquil2', c: '09', city: 'Guayaquil', tag: 'Denuncia', title: 'Vecinos reportan un bache que lleva meses sin reparar', lat: -2.15, lon: -79.91, urgent: false },
	{ id: 'cuenca', c: '01', city: 'Cuenca', tag: 'Ciudad', title: 'Cuenca discute su plan de movilidad', lat: -2.9001, lon: -79.0059, urgent: false },
	{ id: 'machala', c: '07', city: 'Machala', tag: 'Economía', title: 'El banano de El Oro, datos y contexto', lat: -3.2581, lon: -79.9605, urgent: false },
	{ id: 'loja', c: '11', city: 'Loja', tag: 'Política', title: 'Loja presenta su agenda cantonal', lat: -3.9931, lon: -79.2042, urgent: false },
	{ id: 'galapagos', c: '20', city: 'Puerto Ayora', tag: 'Ambiente', title: 'Galápagos actualiza sus reglas de visita', lat: -0.7432, lon: -90.3134, urgent: false },
];
