/**
 * Nombres de view transition (transiciones nativas entre documentos, ver global.css).
 * La foto de una nota lleva el mismo nombre en la portada, los listados y la nota: el navegador la anima de un sitio al otro.
 * Cada nombre debe ser único en la página; si se repite, el navegador cancela la transición entera.
 */
export const fotoNota = (slug: string) => `foto-${slug.replace(/[^a-z0-9-]/gi, '-')}`;
