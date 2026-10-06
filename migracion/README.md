# Migración — Expedición Sur (plantilla en desuso)

Todo lo necesario para trasladar el **home**, **contacto** y el **contenido estático** a otro proyecto similar.

## Contenido de esta carpeta

| Ruta | Qué es |
|---|---|
| `site-config.resuelto.json` | **Todo el contenido estático ya resuelto** (merge de `lib/site-config.json` + defaults de `lib/siteConfig.ts`): branding, paleta, contacto, redes, SEO, hero, servicios, valores, sobre nosotros, contacto y footer. Es la fuente de verdad para reutilizar los textos. |
| `CONTENIDO-ESTATICO.md` | Inventario legible de los textos, incluidos los **hardcodeados dentro de componentes** (navbar, footer, formulario, sección contacto). |
| `codigo/` | Copia fiel de los archivos del proyecto (misma estructura de rutas) que componen home + contacto. |
| `dump-config.ts` | Script para regenerar el JSON resuelto: `npx -y tsx migracion/dump-config.ts` desde la raíz del repo. |

## Estructura del home

`app/page.tsx` (server) → `lib/homeData.ts` (datos dinámicos desde **Firestore cliente**) → `components/HomeClient.tsx` que renderiza en orden:

1. `Navbar` (transparente) + `WhatsAppButton` + `ScrollSmoother` (⚠ es un no-op, renderiza `null`)
2. **Hero** con carousel de banners (Firestore) + `HeroSearch` (buscador de paquetes)
3. `sections/ProductsSection` — paquetes destacados (dinámico)
4. `sections/CategoriesSection` — destinos (dinámico)
5. `sections/ExperienciasSection` — experiencias (dinámico)
6. `sections/ServicesSection` — **100% estático** (siteConfig)
7. `sections/ValuesSection` — **100% estático** (siteConfig)
8. `sections/BlogSection` — blog (dinámico; se puede pasar `[]` para ocultar)
9. `sections/AboutSection` — **100% estático** (siteConfig)
10. `sections/ContactSectionBlock` → `ContactSplitSection` → `forms/PublicInquiryForm` — **estático** salvo `interestOptions`
11. `Newsletter` (escribe directo a Firestore colección `newsletter`)
12. `Footer` — **estático**

`app/contacto/page.tsx` es 100% estático (Navbar + bloques de contacto + mapa + `home/HomeFooter`).

## Dependencias npm necesarias

**Imprescindibles (home estático):** `framer-motion`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`, `sonner`.

**Solo si copiás las partes dinámicas:**
- `firebase` → `Newsletter`, `lib/homeData.ts`, `lib/firebase.ts`
- `@radix-ui/react-label`, `@radix-ui/react-select`, `react-hook-form`, `@hookform/resolvers`, `zod` → `ContactForm.tsx` (NO usado en home, solo en `/educativos`)
- `react-icons` → `app/contacto/page.tsx`, `home/HomeFooter.tsx` (reemplazable por lucide)
- `@studio-freight/lenis` → import muerto en `ScrollSmoother`, se puede borrar

**Estilos:** Tailwind CSS v4 (`postcss.config.mjs` + `@tailwindcss/postcss`). Los colores/tema están en `app/globals.css` (variables CSS tipo `bg-secondary`, `bg-primary`). Hay que copiar `globals.css` o portar las variables al nuevo proyecto.

## Pasos para trasladar

1. **Copiar `codigo/` al proyecto destino** respetando rutas (`components/`, `lib/`, `types/`, `app/`). El alias `@/*` → raíz debe existir en el `tsconfig.json` destino.
2. **Contenido estático:** copiar `site-config.resuelto.json` como nuevo `lib/site-config.json`, o simplemente editar los valores del JSON existente (el `siteConfig.ts` acepta formato legacy directamente y hace merge con defaults).
3. **Assets:** copiar `codigo/public/images/` a `public/images/` (incluye el logo). ⚠ Varias imágenes de fallback referenciadas NO existen ni en este repo: `/images/hero-placeholder.svg`, `/images/placeholder-package.jpg`, `/images/placeholder-category.jpg`, `/images/hero1.webp` (AboutSection), `/images/3.jpg`, `/og-image.jpg`. Crearlas o cambiar las rutas.
4. **Instalar deps** de la lista anterior.
5. **Desacoplar lo dinámico (opcional):** si el nuevo proyecto no usa Firebase, en `app/page.tsx` reemplazar `getHomeData()` por arrays vacíos/datos propios:
   ```tsx
   <HomeClient paquetes={[]} productosOrdenados={[]} categoriasDestacadas={[]} banners={[]} blogPosts={[]} experiencias={[]} />
   ```
   Con `banners=[]` el hero usa `/images/hero-placeholder.svg` (crear fallback). Eliminar `Newsletter` o reimplementar su submit.

## Advertencias detectadas

- **`/api/contact` NO existe** en este repo: `PublicInquiryForm` hace `POST /api/contact` y fallaría con 404. Hay que crear esa ruta en el proyecto destino (o cambiar el submit del form).
- `Navbar` acepta props `theme/transparent/variant/floating` pero **las ignora** (solo usa `reserveSpace`).
- `InstagramSection` está importado en `HomeClient` pero no se renderiza; usa widget externo Elfsight con app-id hardcodeado.
- Las imágenes reales de banners/paquetes/blog viven en URLs remotas (Azure Blob/Firestore), no en el repo.
- Textos de navbar/footer/contacto están **hardcodeados en los componentes** (ver `CONTENIDO-ESTATICO.md`), no en el JSON.
