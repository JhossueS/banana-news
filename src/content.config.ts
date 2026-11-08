import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const noticias = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/noticias' }),
	schema: ({ image }) =>
		z.object({
			titulo: z.string(),
			bajada: z.string(),
			seccion: z.enum(['Ciudad', 'Política', 'Economía', 'Ecuador', 'Ambiente']),
			fecha: z.coerce.date(),
			actualizado: z.coerce.date().optional(),
			autor: z.string(),
			lugar: z.string(),
			imagen: image(),
			alt: z.string(),
			credito: z.string(),
			/** Las claves de la nota, en una línea cada una */
			claves: z.array(z.string()).optional(),
			estado: z.enum(['ultima-hora', 'en-vivo', 'analisis', 'verificado', 'contexto', 'alerta']).optional(),
		}),
});

const legal = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
	schema: z.object({
		titulo: z.string(),
		bajada: z.string(),
		actualizado: z.coerce.date(),
		/** Muestra el recuadro con los datos del titular del sitio */
		titular: z.boolean().default(false),
	}),
});

export const collections = { noticias, legal };
