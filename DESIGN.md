# Banana News · Sistema de diseño

Fuente de verdad de los tokens: `src/styles/global.css`. Este documento describe cómo se usan y qué se añadió para **Adopción de mascotas**.

## Principios
- **La marca es recta.** Radios de 3 a 8 px, sin sombras: la jerarquía sale de color y filetes.
- **Cinco colores.** Amarillo (marca, situación), negro (texto, impacto), hueso (papel), coral (alerta), gris (metadatos). Adopción **no añade colores**.
- **Montserrat** únicamente: 800 titulares, 700 encabezados y datos, 600 etiquetas.
- **Rápido y seco.** 120–200 ms, `--ease-out`, sin rebotes.
- **Foco visible** doble anillo (ya global). Objetivos táctiles de 40 px o más.

## Adopción: semántica del color
| Elemento | Color | Razón |
|---|---|---|
| Etiqueta «En adopción» | `Tag amarillo` | Estado principal de la ficha |
| Situación actual | `--bn-amarillo-100` | Información de contexto |
| Condiciones médicas | `--bn-coral-100` | Atención, no urgencia |
| Sin condiciones | `--bn-gris-100` | Neutro |
| Bajada del hero | filete `--bn-coral` 6 px | Patrón editorial existente |
| Chip activo | negro sobre hueso invertido | Mismo lenguaje que los filtros del medio |

## Componentes (`src/components/`)
| Componente | Props | Notas |
|---|---|---|
| `MascotaCard` | `mascota` | Foto 4:3, `Tag` pegado abajo, datos, avisos y descripción desplegable. Marca `data-especie` para el filtro. |
| `Aviso` | `variante` amarillo/coral/gris, `icono`, `rotulo?` | Con `rotulo` es bloque; sin él, una línea. |
| `DatosMascota` | `datos[{etiqueta, valor, nota?}]` | `dl` de 3 columnas con filete inferior; `nota` en gris bajo el valor (p. ej. la edad bajo la fecha de nacimiento). |
| `MascotaResumen` | `mascota`, `href?` | Tarjeta horizontal del home: foto, datos clave en chips, descripción a 3 líneas. |
| `FiltroChips` | `etiqueta`, `opciones[{id,texto,cantidad}]`, `activo?` | Botones con `aria-pressed`; se deslizan en móvil, se envuelven en escritorio. |

Reutiliza `Tag`, `Icon` (`camera`, `map-pin`, `info`, `triangle-alert`, `shield-check`, `arrow-right`), `Crumbs`, `Header`, `Footer`.

## Página `/adopcion/`
Hero negro (titular con barra amarilla a −8°, bajada con filete coral, CTA amarillo) → filtro por especie con contador (`role="status"`) → grilla `auto-fill, minmax(320px, 1fr)` con gap 16 → estado vacío → tarjeta «Publica la ficha».

- **Datos:** salen de la tabla `mascotas` (solo `estado = publicada`) con caché de 60 s. Sin fichas publicadas muestra el estado vacío.
- **CTA «Publicar mascota»:** lleva a `/adopcion/publicar/`.

## SEO de adopción
- **URLs indexables:** `/adopcion/` (listado), `/adopcion/perros/`, `/gatos/`, `/aves/` (por especie) y `/adopcion/<slug>/` (cada ficha, p. ej. `luna-3f9a`). El slug nace del nombre más 4 caracteres del id y no cambia al editar la ficha.
- **Ficha:** título «Adopta a Luna, perra de 2 años en Quito», descripción de ~155 caracteres con edad y ubicación, canonical, imagen social con la foto, migas y JSON-LD `WebPage` (imagen principal, lugar, fechas). No se usa `Product` ni `Offer`: no son una venta.
- **Listados:** JSON-LD `CollectionPage` + `ItemList` con enlaces a cada ficha. Cada tarjeta enlaza a su ficha (nombre y foto) y los listados se enlazan entre sí.
- **Ciclo de vida:** publicada → indexable y en el sitemap; adoptada → sigue en línea con aviso «Ya fue adoptada», `noindex` y fuera del sitemap; pendiente, rechazada o borrada → 404 (sin caché larga).
- **Sitemap:** incluye el listado, las tres especies y las fichas publicadas con su foto (`image:image`). Las acciones del panel purgan la caché de la ficha, los listados, el home y el sitemap.
- **Enlaces de contacto:** `rel="nofollow"` y fuera de las migas y datos estructurados.

## Ficha: contenido
- **Especies:** canina, felina y aves (`src/lib/mascotas.ts`). Filtro y formulario comparten esa lista.
- **Nacimiento:** se guarda la fecha (AAAA-MM-DD); la edad se calcula (`edadDesde`) y se muestra bajo la fecha.
- **Ubicación:** ciudad y provincia.
- **Contacto para adoptar:** bloque con contorno negro de 2 px; «Escribir» (negro, correo prellenado con «Quiero adoptar a …») y teléfono opcional (`tel:`).

## Formulario `/adopcion/publicar/`
Dos bloques sobre gris-100 con filete negro superior: **La mascota** (con foto obligatoria, vista previa y máximo 8 MB) y **Contacto para la adopción**, con casilla de autorización, Turnstile y honeypot. La action `publicarMascota` valida en servidor, comprueba la foto por sus bytes, la reduce a WebP (1600 px, sin metadatos GPS) y guarda la ficha como `pendiente`. Avisa por correo a la redacción y confirma a quien la envió.

## Panel `/admin/adopcion`
Roles `admin`, `moderador` y `editor` (`permisos.adopcion`). Pestañas por estado: Pendientes, Publicadas, Adoptadas, Rechazadas. Acciones: aprobar y publicar, rechazar (con motivo), marcar como adoptada, volver a pendientes, editar y borrar (borra también la foto). Cada cambio purga la caché de `/` y `/adopcion/`. Endpoint: `POST /api/admin/adopcion`.

**Publicar desde el panel:** el botón «+ Nueva ficha» abre `/admin/adopcion/nueva` con el mismo contenido que el formulario público, foto opcional y la casilla «Publicar ahora» (marcada por defecto; sin marcar queda en pendientes). Endpoint: `POST /api/admin/adopcion/nueva` (multipart). La foto pasa por el mismo tratamiento que la del formulario público (`guardarFotoMascota` en `src/lib/adopcion.ts`).

## Accesibilidad
- Filtros y desplegable son `button` reales con `aria-pressed` / `aria-expanded` + `aria-controls`.
- El contador de resultados es un `status` educado.
- Texto negro sobre amarillo/coral; hueso solo sobre negro.

## Pendiente
- Aplicar la migración `drizzle/0001_mascotas.sql` (`pnpm db:migrar`).
- Ficha individual por mascota.
- Varias fotos por ficha y reemplazo de la foto desde el panel.
- Filtros por edad, tamaño y provincia.
