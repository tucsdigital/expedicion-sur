# Branding y Contenido Interno (Guía para clonar/rebrand)

Este documento explica dónde vive la **identidad visual** (colores, tipografías, logos) y el **contenido interno** (info de empresa, sobre nosotros, contacto, valores, servicios, textos de home, SEO), con el objetivo de que el proyecto se pueda duplicar y rebrandear cambiando pocas cosas.

---

## 1) “Single source of truth” (puntos únicos de cambio)

Si querés rebrandear rápido, casi todo se resuelve en estos 3 lugares:

1. **Colores + tipografías CSS (global):** [globals.css](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/globals.css#L1-L220)
2. **Datos de empresa / contacto / redes / site name:** [constants.ts](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/lib/constants.ts#L1-L37)
3. **Assets (logo e íconos):**
   - Logo principal: [logo.png](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/public/logo.png)
   - Fuente del título del logo: [bella_fashion.ttf](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/public/fonts/bella_fashion/bella_fashion.ttf)
   - Manifest PWA (color de theme): [site.webmanifest](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/public/site.webmanifest)

El resto del contenido se divide en:
- **Contenido hardcodeado** en componentes de secciones (servicios, valores, sobre nosotros, copies).
- **Contenido administrable** vía Firestore (paquetes, banners, blog, experiencias, orden de secciones).

---

## 2) Paleta de colores (distribución)

### 2.1 Variables de marca (CSS)

Las variables de marca viven en el bloque `@theme` de Tailwind v4:
- Primary: `--sherpa-blue: #009246`
- Secondary/Accento: `--sherpa-yellow: #53AB29`
- Success/WhatsApp: `--sherpa-green: #53AB29`
- Texto oscuro base: `--sherpa-black: #1A1A1A`

Referencia: [globals.css](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/globals.css#L9-L53)

### 2.2 Tokens semánticos (los que usa la UI)

En el mismo `@theme` se definen tokens semánticos que son los que terminan consumiendo los componentes:
- `--color-primary` → `var(--sherpa-blue)`
- `--color-secondary` → `var(--sherpa-yellow)`
- `--color-success` → `var(--sherpa-green)`
- `--color-cream` → `var(--sherpa-cream)`
- `--color-black` → `var(--sherpa-black)`

Referencia: [globals.css](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/globals.css#L9-L29)

### 2.3 Cómo se usa en clases (Tailwind)

En el proyecto vas a ver clases como:
- `bg-primary`, `text-primary`
- `bg-secondary`, `text-secondary`
- `bg-success`, `text-success`

Estas clases se apoyan en los tokens semánticos anteriores, por eso conviene rebrandear en `@theme` y evitar hardcodear hex.

### 2.4 Admin/Vendedor (overrides por scope)

Para que el Admin/Vendedor tenga su “scope” y no dependa del fondo crema del sitio público:
- Se usan clases contenedoras `.admin-scope` y `.vendor-scope`.
- En `.admin-scope` se pisan tokens como `--color-primary`, `--color-secondary`, etc.

Referencia: [globals.css](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/globals.css#L132-L169)

Dónde se aplica el scope:
- Vendedor: [VendorLayout.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/vendor/VendorLayout.tsx#L55-L57)
- Admin: el layout principal está en [AdminLayout.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/admin/AdminLayout.tsx)

### 2.5 Colores de SEO/PWA

- Color del navegador (themeColor): [layout.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/layout.tsx#L121-L123)
- PWA manifest: [site.webmanifest](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/public/site.webmanifest)

---

## 3) Tipografías (distribución)

### 3.1 Fuentes principales (Google Fonts)

Se cargan en el root layout:
- Sora → `--font-sora`
- Plus Jakarta Sans → `--font-plus-jakarta`
- Inter → `--font-inter`

Referencia: [layout.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/layout.tsx#L1-L28)

### 3.2 Asignación semántica (heading/body/subtitle)

En `@theme` se definen variables de fuente para toda la app:
- `--font-heading` → headings (h1-h6)
- `--font-body` → texto base
- `--font-subtitle` → subtítulos

Referencia: [globals.css](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/globals.css#L44-L53)

### 3.3 Fuente del “título del logo” (Bella Fashion)

Se carga por `@font-face` desde `public/fonts` y se expone como:
- Variable: `--font-logo`
- Utilidad: `.font-logo`

Referencia:
- `@font-face`: [globals.css](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/globals.css#L3-L7)
- `--font-logo`: [globals.css](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/globals.css#L44-L53)
- `.font-logo`: [globals.css](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/globals.css#L180-L201)

Uso típico:
- `className="font-logo text-primary ..."`

---

## 4) Logos e imágenes

### 4.1 Logo principal

Asset:
- [logo.png](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/public/logo.png)

Dónde se renderiza (principalmente):
- Navbar: [Navbar.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/Navbar.tsx)
- Footer: [Footer.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/Footer.tsx)
- Landing footer: [LandingFooter.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/landing-reserva/LandingFooter.tsx)
- Landing hero: [HeroSection.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/landing-reserva/HeroSection.tsx)
- Admin layout: [AdminLayout.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/admin/AdminLayout.tsx)
- Vendedor layout: [VendorLayout.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/vendor/VendorLayout.tsx)
- Login admin: [admin/login/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/admin/login/page.tsx)
- Login vendedor: [vendedor/login/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/vendedor/login/page.tsx)

### 4.2 Título del logo

El texto “Bella Fashion” se muestra junto al logo y usa `font-logo`. Si querés cambiar el string globalmente, buscá `Bella Fashion` en el proyecto.

### 4.3 SEO: Schema.org + OpenGraph

SEO estructurado (usa `SITE_NAME`, `SITE_DESCRIPTION`, `CONTACT_INFO`, `LEGAL_INFO`, `SITE_URL`):
- [SchemaOrg.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/SchemaOrg.tsx#L1-L80)

Metadata global (OpenGraph, Twitter, etc.):
- [layout.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/layout.tsx#L32-L119)

---

## 5) Info de empresa (nombre, contacto, redes, legales)

### 5.1 Archivo central

Todo esto vive en:
- [constants.ts](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/lib/constants.ts#L1-L37)

Qué contiene:
- `SITE_NAME`, `SITE_DESCRIPTION`, `SITE_URL`
- `CONTACT_INFO` (dirección, horario, email, teléfono, WhatsApp, mapa embebido)
- `SOCIAL_MEDIA` (facebook, instagram, whatsapp, email)
- `LEGAL_INFO` (razón social, CUIT, legajo RNAV)
- `DEVELOPER_CREDITS` (créditos)

### 5.2 Dónde se usa

Ejemplos claros:
- Navbar/topbar y links sociales: [Navbar.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/Navbar.tsx)
- Footer: [Footer.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/Footer.tsx)
- Landing footer: [LandingFooter.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/landing-reserva/LandingFooter.tsx)
- Página de contacto (copy + datos + mapa): [contacto/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/contacto/page.tsx#L1-L79)
- SEO estructurado: [SchemaOrg.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/SchemaOrg.tsx#L1-L80)

### 5.3 Variables de entorno relacionadas (branding)

Las más relevantes para “clonar y pegar”:
- `NEXT_PUBLIC_SITE_URL` → URL pública del sitio (impacta canonical, OG, Schema, redirects).
- `NEXT_PUBLIC_ADMIN_EMAIL` → email habilitado para admin (además hay fallback hardcodeado).

Referencia de uso:
- [constants.ts](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/lib/constants.ts#L1-L8)
- Login admin: [admin/login/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/admin/login/page.tsx)

---

## 6) Contenido de secciones (Home / contenido hardcodeado)

La home se arma en:
- Server: [app/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/page.tsx#L1-L25)
- Client composición de secciones: [HomeClient.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/HomeClient.tsx#L1-L300)

Secciones principales y dónde cambiar sus textos:

### 6.1 Sobre Nosotros

- Componente: [AboutSection.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/sections/AboutSection.tsx#L1-L100)
- Textos actuales están hardcodeados (párrafos). Para rebrandear rápido: reemplazar strings dentro del componente.

### 6.2 Valores / Beneficios

- Componente: [ValuesSection.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/sections/ValuesSection.tsx#L14-L51)
- Estructura: array `values[]` con `{ title, desc, icon, number }`.

### 6.3 Servicios

- Componente: [ServicesSection.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/sections/ServicesSection.tsx#L14-L35)
- Estructura: array `services[]` con `{ title, desc, icon }`.

### 6.4 Contacto (sección)

La sección de contacto se compone en 2 capas:
- Bloque (título/copy + layout): [ContactSectionBlock.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/sections/ContactSectionBlock.tsx#L1-L109)
- Formulario + CTA WhatsApp + imagen: [ContactSection.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/ContactSection.tsx#L1-L120)

Notas:
- Los datos (tel, mail, mapa, WhatsApp) vienen de `CONTACT_INFO`/`SOCIAL_MEDIA`.
- Algunos textos (copys) están hardcodeados en los componentes.

### 6.5 Textos del “hero/buscador” (Home)

Textos y claims principales están hardcodeados en:
- [HomeClient.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/HomeClient.tsx#L161-L205)

---

## 7) Contenido administrable (Firestore) y “orden” de home

La home mezcla contenido hardcodeado (secciones) + contenido traído desde Firestore:
- [homeData.ts](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/lib/homeData.ts#L1-L99)

Colecciones usadas:
- `paquetes` (se filtra `visible == true` y se ordena por `orden`)
- `experiencias` (vía `getExperiencias`, también filtrado visible y limit)
- `banners` (orden por `orden`, filtro por `activa` y `target`)
- `blog` (posts visibles)
- `secciones` (define orden de aparición para productos/paquetes y subtítulos)

Implicancia para “copiar/pegar”:
- Para clonar el proyecto con datos propios, hay que duplicar también las colecciones (o apuntar a otro Firebase project).
- El orden y visibilidad del contenido principal no está hardcodeado: depende de `visible` y `orden`.

---

## 8) Checklist de rebrand (rápido)

1. **Reemplazar logo:** [public/logo.png](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/public/logo.png)
2. **Ajustar paleta (3 colores):** [globals.css](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/globals.css#L9-L29)
3. **Actualizar título del logo (texto):** buscar `Bella Fashion` en componentes y reemplazar por la marca objetivo.
4. **Actualizar datos de empresa:** [constants.ts](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/lib/constants.ts#L1-L37)
5. **Actualizar `NEXT_PUBLIC_SITE_URL`** (canonicals/SEO/Schema/redirects).
6. **Revisar textos hardcodeados** (HomeClient, About, Services, Values, Contact).
7. **Si hay Admin/Firestore:** duplicar/ajustar colecciones y reglas del proyecto Firebase.

---

## 9) “Dónde editar qué” (mapa rápido)

- Colores globales: [globals.css](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/globals.css#L9-L53)
- Tipografías base (Google): [layout.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/layout.tsx#L1-L28)
- Tipografía del logo (Bella Fashion): [globals.css](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/globals.css#L3-L7)
- Site name / contacto / redes / legales: [constants.ts](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/lib/constants.ts#L1-L37)
- SEO estructurado: [SchemaOrg.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/SchemaOrg.tsx#L1-L80)
- Página de contacto: [contacto/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/app/contacto/page.tsx#L1-L79)
- Servicios (cards): [ServicesSection.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/sections/ServicesSection.tsx#L14-L35)
- Valores/beneficios (cards): [ValuesSection.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/sections/ValuesSection.tsx#L14-L51)
- Sobre nosotros: [AboutSection.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/sections/AboutSection.tsx#L23-L70)
- Home composition: [HomeClient.tsx](file:///c:/Users/Lauti/Documents/GitHub/viaggo_tour/components/HomeClient.tsx#L161-L299)

