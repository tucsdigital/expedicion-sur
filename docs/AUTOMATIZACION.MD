Quiero que trabajes sobre el template del proyecto **viaggo_tour** con el objetivo de prepararlo para automatización real desde Make.

## CONTEXTO GENERAL

Estoy construyendo un sistema donde:
- desde mi panel admin se crea un proyecto
- el cliente completa un formulario dinámico
- se genera un payload estructurado
- Make crea el repositorio desde template
- luego el template debe poder personalizarse automáticamente con los datos del proyecto y del formulario

El objetivo NO es solo clonar el repo.
El objetivo es que el template **viaggo_tour** quede preparado para recibir datos dinámicos y construir un sitio real sin necesidad de editar componentes manualmente cada vez.

---

## DOCUMENTACIÓN A TOMAR COMO BASE

Analiza primero en profundidad la documentación que compartí sobre branding y contenido interno del proyecto.

La documentación indica claramente:

### Single source of truth actual
- `app/globals.css` contiene colores y tipografías globales
- `lib/constants.ts` contiene nombre del sitio, contacto, redes y datos legales
- `public/logo.png`, fuente del logo y `site.webmanifest` contienen assets y configuración visual base

### Contenido hardcodeado actual
Hay contenido actualmente hardcodeado en:
- `HomeClient.tsx`
- `AboutSection.tsx`
- `ServicesSection.tsx`
- `ValuesSection.tsx`
- `ContactSectionBlock.tsx`
- `ContactSection.tsx`

### Contenido administrable actual
La home mezcla contenido hardcodeado con contenido de Firestore usando:
- `homeData.ts`
- colecciones como `paquetes`, `experiencias`, `banners`, `blog`, `secciones`

Quiero que tomes esta documentación como diagnóstico inicial y no arranques directamente a tocar archivos sin primero entender:
- qué variables ya existen
- qué secciones son estáticas
- qué datos ya son dinámicos
- qué información vive en CSS, constantes, assets y Firestore
- qué partes del proyecto deben convertirse en configurables para que Make pueda automatizar correctamente el template

---

## PRIMER PASO OBLIGATORIO

Antes de implementar nada, quiero que hagas una auditoría técnica del template `viaggo_tour` y determines:

1. qué partes ya funcionan como single source of truth
2. qué partes siguen hardcodeadas y deben desacoplarse
3. qué secciones deben consumir datos dinámicos del formulario
4. qué datos conviene mantener en Firestore
5. qué datos conviene mover a una configuración única del template
6. cuál es la estructura ideal para que Make inyecte contenido sin editar React manualmente

---

## OBJETIVO FINAL

Quiero que `viaggo_tour` quede preparado para funcionar con una configuración dinámica alimentada desde el payload del proyecto.

Ese payload puede incluir datos como:
- agencyName
- logoUrl
- palette
- typographyStyle
- heroTagline
- aboutUs
- services
- values
- packages
- contactEmail
- contactPhone
- preferredContact
- socialLinks
- showMap
- addressForMap
- businessHours
- finalNotes
- backgroundType
- backgroundImageUrl
- backgroundVideoUrl

Quiero que el template pueda consumir ese tipo de datos sin tener que editar código manualmente cada vez.

---

## ENFOQUE ARQUITECTÓNICO QUE QUIERO

Quiero que propongas e implementes una estrategia limpia y escalable, por ejemplo basada en una fuente única de configuración del template.

Ejemplos válidos:
- `/public/tucs-config.json`
- `/src/config/site-content.ts`
- `/lib/generated/site-config.json`

No tiene que ser exactamente uno de esos, pero sí debe cumplir esta lógica:
- una sola fuente principal de configuración
- branding y contenido desacoplados del componente
- componentes consumiendo config dinámica
- Make pudiendo escribir o actualizar esa config fácilmente

---

## LO QUE QUIERO QUE RESUELVAS

### 1. Branding dinámico
Preparar el template para que pueda cambiar desde datos de configuración:
- logo
- colores
- tipografías
- site name
- contact info
- social media
- datos legales básicos
- theme color / seo básico

### 2. Contenido dinámico
Preparar el template para que estas secciones puedan renderizarse desde configuración:
- hero
- sobre nosotros
- servicios
- valores
- contacto
- paquetes
- textos principales
- CTA
- horarios
- mapa
- links sociales

### 3. SEO dinámico
Preparar el template para que metadata, OpenGraph, canonical y schema puedan leer datos centrales y no strings rígidos.

### 4. Compatibilidad con Firestore
No quiero romper el contenido que ya viene de Firestore donde tenga sentido.
Quiero que analices qué debe seguir viniendo de Firestore y qué debe pasar a la config principal.

### 5. Compatibilidad con Make
La estructura final debe pensarse para que Make pueda:
- tomar el payload del proyecto
- generar una config final
- escribir esa config en el repo
- hacer commit
- dejar el proyecto listo para deploy

---

## RESULTADO ESPERADO

Quiero que me entregues una implementación real donde:

1. el template `viaggo_tour` deje de depender de tanto contenido hardcodeado
2. exista una estructura central de configuración de branding + contenido
3. los componentes principales consuman esa configuración
4. quede claro qué datos vienen del formulario/proyecto
5. el template quede listo para ser automatizado desde Make

---

## FORMA DE TRABAJO

1. primero analiza la documentación compartida
2. identifica puntos únicos de cambio y puntos problemáticos
3. propone la estructura de config ideal
4. implementa la refactorización mínima necesaria
5. no rompas la arquitectura existente más de lo necesario
6. prioriza escalabilidad, claridad y facilidad de automatización
7. no dejes soluciones parche
8. genera código real, no pseudocódigo

---

## MUY IMPORTANTE

No quiero una solución donde Make edite múltiples componentes React de forma frágil.
Quiero una solución profesional donde el template sea dinámico por diseño.

Piensa esto como la base para que `viaggo_tour` pueda ser duplicado, rebrandado y completado automáticamente usando los datos del formulario del proyecto.

---

## CONTRATO FINAL: `lib/site-config.json` (Make)

Este template queda automatizable si Make escribe **un único archivo**: `lib/site-config.json`. El código del template lee desde ahí (directamente o vía `lib/constants.ts`).

### Reglas de escritura (Make)
- Ruta única: `lib/site-config.json`
- Formato: JSON válido (UTF-8), sin trailing commas
- Make debe escribir el archivo completo (no “parches” parciales). El template asume que la estructura existe.
- Templates soportados en strings: `{{siteName}}`, `{{siteDescription}}`, `{{logoTitleText}}`, `{{year}}`
- Negrita en textos: soporta `**...**` en `content.about.paragraphs[]` (ej: `**{{siteName}}**`)

### Estructura completa (shape)

```json
{
  "branding": {
    "siteName": "string",
    "siteDescription": "string",
    "siteUrlDefault": "string",
    "logo": {
      "imagePath": "string",
      "imageUrl": "string",
      "titleText": "string",
      "altTextTemplate": "string"
    },
    "palette": {
      "primary": "string",
      "secondary": "string",
      "success": "string",
      "successStrong": "string",
      "dark": "string",
      "cream": "string"
    }
  },
  "company": {
    "adminEmailDefault": "string",
    "whatsappMessageDefault": "string",
    "contact": {
      "direccion": "string",
      "horario": "string",
      "email": "string",
      "telefono": "string",
      "whatsappNumber": "string",
      "mapUrl": "string"
    },
    "social": {
      "facebook": "string",
      "instagram": "string",
      "instagramHandle": "string",
      "threads": "string",
      "tiktok": "string",
      "email": "string"
    },
    "legal": {
      "razonSocial": "string",
      "cuit": "string",
      "legajoRnav": "string"
    },
    "developerCredits": {
      "name": "string",
      "url": "string"
    }
  },
  "features": {
    "showContactMap": true
  },
  "seo": {
    "locale": "string",
    "titleDefaultTemplate": "string",
    "titleTemplate": "string",
    "openGraphImagePath": "string",
    "keywords": ["string"]
  },
  "content": {
    "homeHero": {
      "badge": "string",
      "titlePrefix": "string",
      "titleAccent": "string",
      "subtitleTemplate": "string"
    },
    "packagesSection": {
      "badge": "string",
      "title": "string",
      "subtitleTemplate": "string"
    },
    "services": {
      "badge": "string",
      "titlePrefix": "string",
      "titleAccent": "string",
      "subtitle": "string",
      "items": [
        { "icon": "string", "title": "string", "desc": "string" }
      ]
    },
    "values": {
      "badge": "string",
      "title": "string",
      "subtitle": "string",
      "items": [
        { "icon": "string", "number": "string", "title": "string", "desc": "string" }
      ]
    },
    "about": {
      "badge": "string",
      "titlePrefix": "string",
      "titleAccent": "string",
      "image": { "src": "string", "altTemplate": "string" },
      "paragraphs": ["string"]
    },
    "contactBlock": {
      "badge": "string",
      "titlePrefix": "string",
      "titleAccent": "string",
      "subtitle": "string"
    },
    "contactForm": {
      "title": "string",
      "subtitle": "string",
      "whatsappCta": "string",
      "image": { "src": "string", "altTemplate": "string" }
    },
    "footer": {
      "taglineTemplate": "string",
      "copyrightTemplate": "string"
    }
  }
}
```

### Obligatorios, opcionales y defaults (recomendado)

Obligatorios (Make debe setear):
- `branding.siteName`, `branding.siteDescription`, `branding.siteUrlDefault`
- `branding.logo.imagePath`, `branding.logo.titleText`
- `branding.palette.primary|secondary|success|successStrong|dark|cream`
- `company.adminEmailDefault`, `company.whatsappMessageDefault`
- `company.contact.direccion|horario|email|telefono|whatsappNumber`
- `company.legal.legajoRnav` (se muestra en Footer)
- `company.developerCredits.name|url` (se muestra en Footer)
- `seo.locale`, `seo.titleDefaultTemplate`, `seo.titleTemplate`, `seo.openGraphImagePath`, `seo.keywords[]`
- `content.*` (todas las secciones de home consumen estas claves)

Opcionales (si no aplica, usar `""`):
- `branding.logo.imageUrl` (si está vacío, se usa `branding.logo.imagePath`)
- `company.contact.mapUrl` (solo requerido si `features.showContactMap = true`)
- `company.social.facebook|threads|tiktok|instagramHandle`

Defaults sugeridos (si tu sistema no tiene valores, usar estos):
- `features.showContactMap`: `false`
- `seo.titleTemplate`: `"%s | {{siteName}}"`
- `content.footer.taglineTemplate`: `"{{siteDescription}}"`

### Qué consume cada sección (paths exactos)

- Layout global (colores + metadata base)
  - Colores: `branding.palette.*`
  - SEO base: `branding.siteName`, `branding.siteDescription`, `branding.siteUrlDefault`, `seo.*`
- Navbar / Layout Admin / Layout Vendedor / Login Admin-Vendedor
  - Logo: `branding.logo.imageUrl` (si no, `branding.logo.imagePath`)
  - Nombre marca: `branding.logo.titleText`
- Home Hero
  - `content.homeHero.badge|titlePrefix|titleAccent|subtitleTemplate`
- Paquetes (bloque de home)
  - `content.packagesSection.badge|title|subtitleTemplate`
- Servicios
  - `content.services.badge|titlePrefix|titleAccent|subtitle|items[]`
- Valores / Beneficios
  - `content.values.badge|title|subtitle|items[]`
- About / Sobre Nosotros
  - `content.about.badge|titlePrefix|titleAccent|image.src|image.altTemplate|paragraphs[]`
- Contact Block + Contact Form
  - Textos: `content.contactBlock.*`, `content.contactForm.*`
  - Datos contacto: `company.contact.*`, `company.whatsappMessageDefault`
  - Redes: `company.social.*`
  - Mapa: `features.showContactMap` + `company.contact.mapUrl`
- Footer
  - Textos: `content.footer.taglineTemplate|copyrightTemplate`
  - Marca: `branding.logo.titleText`, `branding.siteName`
  - Legales: `company.legal.legajoRnav`
  - Dev credits: `company.developerCredits.*`

### Mapping recomendado: `ProjectPayload` → `site-config.json`

| ProjectPayload (sistema) | site-config.json (path) | Nota / Transformación |
|---|---|---|
| `agencyName` | `branding.siteName` | string |
| `agencyName` | `branding.logo.titleText` | recomendado: mismo valor que `siteName` |
| `logoUrl` | `branding.logo.imageUrl` | URL completa (https). Si vacío, se usa `imagePath` |
| `palette.primary` | `branding.palette.primary` | hex (`#RRGGBB`) |
| `palette.secondary` | `branding.palette.secondary` | hex |
| `palette.success` | `branding.palette.success` | hex |
| `palette.successStrong` | `branding.palette.successStrong` | hex |
| `palette.dark` | `branding.palette.dark` | hex |
| `palette.cream` | `branding.palette.cream` | hex |
| `heroTagline` | `content.homeHero.badge` | string corto |
| `aboutUs[]` (párrafos) | `content.about.paragraphs[]` | strings; negrita con `**...**` y tokens `{{siteName}}` |
| `services[]` | `content.services.items[]` | mapear `title/desc`; `icon` puede ser un string Lucide (`"Plane"`, `"Globe"`, etc.) |
| `values[]` | `content.values.items[]` | `number` `"01"`… y `icon` Lucide |
| `contactEmail` | `company.contact.email` | email |
| `contactPhone` | `company.contact.telefono` | string libre (se muestra tal cual) |
| `socialLinks.instagram` | `company.social.instagram` | URL completa |
| `socialLinks.instagramHandle` | `company.social.instagramHandle` | `@handle` |
| `socialLinks.facebook` | `company.social.facebook` | URL completa |
| `showMap` | `features.showContactMap` | boolean |
| `addressForMap` | `company.contact.direccion` | string |
| `mapEmbedUrl` | `company.contact.mapUrl` | URL embed para iframe (si `showMap=true`) |
| `businessHours` | `company.contact.horario` | string |
| `finalNotes` | `content.contactBlock.subtitle` | recomendado: usar como micro-copy (si no hay, usar el default del ejemplo) |
| `legal.razonSocial` | `company.legal.razonSocial` | string |
| `legal.cuit` | `company.legal.cuit` | string |
| `legal.legajoRnav` | `company.legal.legajoRnav` | string |
| `siteUrl` | `branding.siteUrlDefault` | URL base para canonical/OG |
| `seo.keywords[]` | `seo.keywords[]` | lista |

Campos del payload que NO van en `site-config.json` (en esta fase):
- `packages`: siguen viniendo de Firestore (seed/creación de docs en colecciones, no config).
- `backgroundType|backgroundImageUrl|backgroundVideoUrl|typographyStyle|preferredContact`: no se consumen todavía; si querés incorporarlos, se define explícitamente una nueva sección de config y se cablea en componentes.

### Ejemplo listo para usar (Turismo · Plan Medium)

El ejemplo canónico vive en `lib/site-config.json`. Make puede tomar ese JSON como base y sobrescribir campos según el payload del proyecto.
