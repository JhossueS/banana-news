# Puesta en producción — Banana News

Arquitectura:

```
lector ──→ Cloudflare (proxy + caché CDN) ──→ Railway: web (Astro SSR, Node)
redacción ─→ /admin (nunca se cachea) ─────┘            │
                                                   Railway: Postgres
Medios: Cloudflare R2 (imágenes, adjuntos) · Cloudflare Stream (videos)
Correo: Resend · Antispam: Cloudflare Turnstile
```

- Las notas, la portada y `/api/publica/*` se generan en el servidor y salen con
  `Cache-Control: public, max-age=0, s-maxage=N, stale-while-revalidate=86400`.
  Cloudflare guarda la copia `N` segundos (60 en portada y en notas de última hora/en vivo, 300 en el resto)
  y después la sigue sirviendo mientras la renueva en segundo plano. La base de datos casi no recibe visitas.
- Al guardar, publicar o moderar algo en `/admin`, la app **purga** esas URLs en Cloudflare y el cambio se ve en segundos.
- Todas las variables están documentadas en `.env.example`. Sin las de Cloudflare/Resend la app funciona en
  modo local: archivos en `.data/media`, correos en el log y purga simulada.

---

## 1. Railway

1. Crea un proyecto en Railway → **Deploy from GitHub repo** → este repositorio.
2. En el mismo proyecto: **+ New → Database → PostgreSQL**.
3. En el servicio web → **Variables**:
   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
   | `IP_SALT` | `openssl rand -base64 32` (otro valor) |
   | `ORIGEN_SECRETO` | `openssl rand -hex 32` (el mismo valor va en la regla de Cloudflare, §2.7) |
   | `SITE_URL` | `https://tu-dominio.com` (sin barra final) |
   | `NODE_ENV` | `production` |
   | `ADMIN_INICIAL` | tu correo: crea la primera cuenta de administrador (ver paso 5) |
   | `ADMIN_INICIAL_NOMBRE` | opcional: tu nombre |
4. `railway.json` define el build (`pnpm build`), el arranque (`pnpm start`) y el healthcheck (`/api/salud`).
   **`pnpm start` prepara la base en cada arranque**, antes de levantar la app:
   1. `pnpm db:migrar` crea o actualiza las tablas (si ya están al día no hace nada);
   2. `pnpm admin:inicial` crea la primera cuenta de administrador, solo si la base no tiene ninguna;
   3. arranca el servidor.
   Se hace al arrancar y no en el build porque durante el build Railway no tiene acceso a la red privada de
   Postgres. Si una migración falla, la app no arranca, el healthcheck falla y Railway mantiene el deploy anterior.
5. Primer deploy. Con `ADMIN_INICIAL` definida, al arrancar se crea tu cuenta y te llega por correo un **enlace de
   un solo uso** (vence en 48 h) a `https://tu-dominio.com/admin/activar/#t=…`, donde eliges tu contraseña
   (mínimo 12 caracteres). Si el correo no sale (Resend sin configurar), el enlace aparece en los Deploy Logs como
   `[admin-inicial]`. Cuando ya existe alguna cuenta, `admin:inicial` no hace nada.
   Si pierdes el enlace o necesitas otra cuenta desde la terminal, dentro del contenedor:
   ```sh
   railway ssh
   pnpm admin:crear tu@correo.com "Tu Nombre" admin   # imprime un enlace nuevo; el anterior deja de valer
   ```
   Las demás cuentas se crean desde **/admin/usuarios**: la persona recibe el enlace por correo.

   **Cuentas y acceso:**
   - Nadie elige ni ve la contraseña de otra persona; cada quien pone la suya con su enlace.
   - «¿Olvidaste tu contraseña?» en `/admin/login` envía un enlace que vence en 2 h.
   - **Restablecer acceso** (en Usuarios) anula al instante la contraseña y las sesiones de esa cuenta y le envía un
     enlace nuevo: úsalo si una cuenta pudo quedar comprometida. Desde la terminal:
     `railway ssh -- pnpm admin:crear correo "Nombre" rol --bloquear`.
   - Al cambiar la contraseña se cierran todas las sesiones y llega un aviso por correo.
6. **Settings → Networking → Custom Domain**: agrega `tu-dominio.com` y copia el CNAME que te da Railway.

## 2. Cloudflare: dominio y caché

1. Agrega el dominio a Cloudflare y crea el CNAME de Railway con **proxy activado** (nube naranja).
2. **SSL/TLS → Overview → Full (strict)**.
3. **Caching → Cache Rules → Create rule** «Páginas públicas»:
   - *When incoming requests match* (expresión):
     ```
     (http.request.uri.path eq "/") or
     starts_with(http.request.uri.path, "/noticias/") or
     starts_with(http.request.uri.path, "/api/publica/")
     ```
   - *Cache eligibility*: **Eligible for cache**
   - *Edge TTL*: **Use cache-control header if present, bypass cache if not**
   - *Browser TTL*: **Respect origin**
4. Segunda regla, «Nunca cachear» (ponla **antes**):
   ```
   starts_with(http.request.uri.path, "/admin") or
   starts_with(http.request.uri.path, "/api/") and not starts_with(http.request.uri.path, "/api/publica/") or
   starts_with(http.request.uri.path, "/_actions/")
   ```
   → *Cache eligibility*: **Bypass cache**
5. Token de purga: **My Profile → API Tokens → Create Token → Custom**, permiso `Zone · Cache Purge · Purge`
   para tu zona. En Railway:
   - `CF_ZONE_ID` (en la portada de la zona, columna derecha)
   - `CF_API_TOKEN`
6. Comprueba la caché:
   ```sh
   curl -sI https://tu-dominio.com/noticias/cotopaxi-actividad-moderada/ | grep -i -E "cache-control|cf-cache-status"
   # 1.ª vez: cf-cache-status: MISS · 2.ª: HIT · al vencer s-maxage: UPDATING/REVALIDATED
   ```

7. **Solo se entra por Cloudflare.** La app usa `cf-connecting-ip` para los límites de intentos; si alguien entrara
   directo a `*.up.railway.app` podría falsificarla. Con `ORIGEN_SECRETO` definido, el servidor rechaza (403) toda
   petición que no traiga ese secreto, y solo Cloudflare lo agrega:
   - **Rules → Transform Rules → Modify Request Header → Create rule** «Origen Cloudflare»
   - *When incoming requests match*: `(http.host eq "tu-dominio.com")`
   - *Then*: **Set static** · nombre `x-bn-origen` · valor = el mismo `ORIGEN_SECRETO`
   - Además, en Railway **Settings → Networking**, borra el dominio `*.up.railway.app` (el healthcheck usa la red interna).
8. **Cabeceras de seguridad en las páginas estáticas.** Las páginas que genera el servidor ya salen con
   CSP (`frame-ancestors`), `X-Frame-Options`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`. Las estáticas
   (`/quienes-somos/`, páginas legales…) se sirven sin pasar por la app, así que se las agrega Cloudflare:
   - **Rules → Transform Rules → Modify Response Header → Create rule** «Cabeceras de seguridad»
   - *When*: `(http.host eq "tu-dominio.com" and not starts_with(http.request.uri.path, "/admin") and not starts_with(http.request.uri.path, "/api/"))`
   - *Then* (**Set static**, una por cabecera):
     | Cabecera | Valor |
     |---|---|
     | `Content-Security-Policy` | `frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests` |
     | `X-Frame-Options` | `SAMEORIGIN` |
     | `X-Content-Type-Options` | `nosniff` |
     | `Referrer-Policy` | `strict-origin-when-cross-origin` |
     | `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
9. **SSL/TLS → Edge Certificates → HTTP Strict Transport Security (HSTS) → Enable**: `max-age` 12 meses,
   sin *includeSubDomains* mientras haya subdominios sin HTTPS. (La app también la envía en sus respuestas.)

## 3. Cloudflare R2 (imágenes y adjuntos de denuncias)

1. **R2 → Create bucket** `bananas-media` (imágenes y videos de las notas: público).
2. **Settings → Public access → Custom Domains → Connect** `media.tu-dominio.com`.
   ⚠️ El dominio público expone **todo** el bucket, por eso los adjuntos de denuncias van en otro:
3. **R2 → Create bucket** `bananas-denuncias` (privado). **No** le conectes dominio ni actives el acceso público
   `r2.dev`, y no necesita CORS. La app guarda ahí los adjuntos de los lectores; el panel solo permite **descargarlos**
   con una URL firmada que vence en 15 minutos. Si falta `R2_BUCKET_PRIVADO` con `MEDIA_BASE_URL` definido,
   la app no arranca.
   Capa extra (opcional): en la zona del dominio de medios, **Security → WAF → Custom rules** con
   `(http.host eq "media.tu-dominio.com" and starts_with(http.request.uri.path, "/denuncias/"))` → **Block**.
4. En `bananas-media`, **Settings → CORS policy** (lo necesita la subida directa desde el panel):
   ```json
   [{ "AllowedOrigins": ["https://tu-dominio.com"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
5. **R2 → Manage API tokens → Create API token** con permiso *Object Read & Write* sobre **los dos** buckets.
6. Variables en Railway: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=bananas-media`,
   `R2_BUCKET_PRIVADO=bananas-denuncias`, `MEDIA_BASE_URL=https://media.tu-dominio.com`.
7. Imágenes responsivas: en la zona, **Images → Transformations → Enable** y luego `MEDIA_TRANSFORMACIONES=true`.
   La app genera `srcset` con `/cdn-cgi/image/width=…,format=auto/…` (WebP/AVIF automático).

## 4. Cloudflare Stream (videos)

1. **Stream → Get started**. Anota el código de `customer-XXXX.cloudflarestream.com` (Stream → Settings).
2. **API Tokens → Create Token → Custom**: `Account · Stream · Edit`.
3. Registra el webhook (una vez):
   ```sh
   curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/stream/webhook" \
     -H "Authorization: Bearer $CF_STREAM_TOKEN" -H "Content-Type: application/json" \
     -d '{"notificationUrl":"https://tu-dominio.com/api/webhooks/stream"}'
   ```
   La respuesta trae `"secret"`: guárdalo como `CF_STREAM_WEBHOOK_SECRET`.
4. Variables en Railway: `CF_ACCOUNT_ID`, `CF_STREAM_TOKEN`, `CF_STREAM_CUSTOMER_CODE`, `CF_STREAM_WEBHOOK_SECRET`.

Los videos se suben directo del navegador a Stream (hasta 200 MB por archivo) y quedan «Procesando» hasta que
llega el webhook. En **Medios** también se puede pulsar «comprobar».

## 5. Turnstile (antispam de los formularios)

1. **Turnstile → Add widget**, dominio `tu-dominio.com`, modo *Managed*.
2. Variables: `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET`.
   Mientras no estén, se usan las claves de prueba (todo pasa y el widget muestra «Solo para pruebas»).
   En producción (`SITE_URL` con https) la app **no arranca** con las claves de prueba. La site key se incrusta
   al compilar: después de cambiarla, vuelve a desplegar.

Cada envío también pasa por un honeypot y un límite de 5 envíos cada 10 min por IP y formulario.
La IP nunca se guarda en claro, solo su hash. Las denuncias admiten un adjunto de hasta 50 MB; su tipo se
comprueba por el contenido real del archivo (JPG, PNG, WebP, GIF, HEIC, AVIF, MP4, MOV o WebM), no por lo que
diga el navegador.

## 6. Resend (correos de contacto y avisos)

1. Crea la cuenta, **Domains → Add domain** `tu-dominio.com` y agrega los registros DNS que indica
   (en Cloudflare, sin proxy).
2. **API Keys → Create** → `RESEND_API_KEY`.
3. `CORREO_REMITENTE="Banana News <no-responder@tu-dominio.com>"`.
4. Reemplaza los correos `[tu-dominio]` de `src/data/site.ts`: a esos buzones llegan los avisos según el asunto.
   Para pruebas, `CORREO_DESTINO=tu@correo.com` manda todo a un solo buzón.

Qué se envía:
- **Contacto:** aviso al buzón del asunto (responder contesta directo al lector) y acuse al lector. El acuse es
  un texto fijo, sin nada de lo que escribió el visitante: así no sirve para mandar spam a terceros.
- **Denuncia / punto en el mapa:** aviso a la redacción con el enlace a la bandeja de moderación.

---

## Arranque seguro

En producción (build con `SITE_URL` en https), si falta algo crítico la app responde **503** a todo, el
healthcheck falla y Railway mantiene el despliegue anterior. El motivo aparece en el log como `[seguridad]`:
- claves de prueba de Turnstile;
- `IP_SALT` sin definir o corta;
- `MEDIA_BASE_URL` sin `R2_BUCKET_PRIVADO` (o los dos buckets iguales).

Sin `ORIGEN_SECRETO` solo deja un aviso en el log.

## 7. Buscadores (SEO)

`SITE_URL` debe estar definida **también en el build**: con ella se generan el canonical, `og:url`, los sitemaps y
`robots.txt` (que es estático). Si cambias de dominio, vuelve a hacer build.

Antes de lanzar:
- Completa en `src/data/site.ts` las `redes` (aparecen en el pie y como `sameAs` en los datos estructurados) y
  `empleosUrl`. El correo de contacto y los datos del titular ya están definidos ahí.

Después de lanzar:
1. [Google Search Console](https://search.google.com/search-console): verifica el dominio (registro DNS en Cloudflare)
   y envía `https://TU-DOMINIO/sitemap.xml` y `https://TU-DOMINIO/news-sitemap.xml`.
2. [Google Publisher Center](https://publishercenter.google.com): registra el medio para Google News.
3. [Bing Webmaster Tools](https://www.bing.com/webmasters): importa el sitio desde Search Console.
4. Comprueba una nota en la [prueba de resultados enriquecidos](https://search.google.com/test/rich-results)
   (debe detectar `NewsArticle` y `BreadcrumbList`).

Rutas para buscadores: `/sitemap.xml`, `/news-sitemap.xml` (últimas 48 h), `/rss.xml`, `/robots.txt`.
Las imágenes de marca (`public/og-default.png`, `public/logo-512.png`) se regeneran desde el logo con
`node scripts/generar-imagenes-seo.ts`.

## Desarrollo local

```sh
pnpm install
pnpm db:migrar                                  # crea las tablas (PGlite en .data/pglite)
pnpm admin:crear tu@correo.com "Nombre" admin  # imprime el enlace para elegir tu contraseña
astro dev --background
```

PGlite admite un solo proceso a la vez: corre `db:migrar` y `admin:crear` con el servidor de
desarrollo **detenido** (`astro dev stop`). Desde el panel (Usuarios) se pueden crear cuentas con el servidor encendido.

Después de cambiar `src/db/schema.ts`: `pnpm db:generar` (crea la migración en `drizzle/`) y `pnpm db:migrar`.
