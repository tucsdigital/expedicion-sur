# Referencias a "Lado V" en el proyecto (reemplazadas por El Sherpa)

Este documento listaba los archivos donde aparecía **Lado V**. **Todas esas referencias fueron reemplazadas por "El Sherpa"** (metadata, textos, alt, plantillas WhatsApp, cartel en desarrollo). El proyecto queda unificado bajo la marca El Sherpa.

---

## Club (eliminado)

Todo lo relacionado con **Club** fue eliminado: página `/club-lado-v`, CTA de Club en la home, modal de alta al club y componentes `ClubCtaSection`, `ClubLadoVClient`, `ClubJoinModal`. La ruta `/club-lado-v` ya no existe (404).

---

## Metadata y SEO (✅ reemplazado por El Sherpa)

| Archivo | Uso (ahora El Sherpa) |
|---------|------------------------|
| `app/paquetes/page.tsx` | `title`, OpenGraph, Twitter, `keywords`, `siteName` |
| `app/terminos-condiciones/page.tsx` | `title`, `description`, OpenGraph, texto legal "Nombre comercial", "Atte:" |
| `app/categoria/[slug]/page.tsx` | `title`, descripciones, `siteName`, `keywords` |

---

## Componentes y UI (✅ reemplazado por El Sherpa)

| Archivo | Uso (ahora El Sherpa) |
|---------|------------------------|
| `components/Navbar.tsx` | `alt` del logo |
| `components/admin/AdminLayout.tsx` | `alt` isotipo |
| `components/BlogCard.tsx` | Texto en el card |
| `components/ContactSection.tsx` | `alt` imagen |
| `app/admin/login/page.tsx` | `alt` favicon |

---

## Admin y consultas

| Archivo | Uso |
|---------|-----|
| `app/admin/consultas/page.tsx` | Plantilla de mensaje WhatsApp: "somos de *Lado V*" |

---

## Carpeta cartel_en_desarrollo (✅ reemplazado por El Sherpa)

| Archivo | Uso (ahora El Sherpa) |
|---------|------------------------|
| `cartel_en_desarrollo/app/layout.tsx` | `title: 'El Sherpa — Próximamente'` |
| `cartel_en_desarrollo/app/page.tsx` | `title`, `logoAlt="El Sherpa"` |
| `cartel_en_desarrollo/app/components/ComingSoon.tsx` | `logoAlt` por defecto, copyright "© … El Sherpa" |

---

## Notas

- **Constantes:** `lib/constants.ts` usa `SITE_NAME = "El Sherpa"`. La URL por defecto sigue siendo `viaggiotur.vercel.app` (dominio).
- **Footer / LandingFooter:** Usan `SITE_NAME` de constants (El Sherpa).
- Todas las referencias listadas arriba fueron reemplazadas por "El Sherpa". No queda texto visible ni metadata con "Lado V" en el proyecto.
