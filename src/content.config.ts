import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Las noticias viven en Postgres (CMS propio en /admin); aquí quedan solo las páginas legales.

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

export const collections = { legal };
