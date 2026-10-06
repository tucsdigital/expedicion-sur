# Inventario de contenido estático

## 1. Contenido centralizado (JSON)

Todo está en `site-config.resuelto.json` (ya resuelto, listo para copiar). Resumen por sección:

- **Branding:** nombre "Expedición Sur", descripción, URL, logo `/images/logo-expedicion-sur.png`, paleta (primary `#E30613`, secondary `#CBBBA0`, success `#CA9E67`/`#8E6B45`, dark `#111111`, cream `#F7F2EA`).
- **Contacto:** El Calafate, Santa Cruz, Argentina · 08:00 a 21:00 hs · reservas@expedicionsur.com · +54 9 2966 243032 · WhatsApp 5492966243032 · mapa embed de Google.
- **Redes:** Instagram `https://www.instagram.com/expedicionsur.fte` (@expedicionsur.fte).
- **SEO:** locale es_AR, keywords (patagonia, perito moreno, el chalten, ushuaia…).
- **content.homeHero:** badge "Explorá", título "Expedición Sur", subtítulo = descripción del sitio.
- **content.packagesSection:** badge "Experiencias", título "Experiencias destacadas".
- **content.services (4):** Tour Glaciar Perito Moreno · Full Day El Chaltén – Laguna de los Tres · Full Day El Chaltén Classic · Excursión Todos los Glaciares (con iconos lucide: MountainSnow, Route, Compass, ShipWheel).
- **content.values (6):** Atención personalizada · Experiencia local · Seguridad · Calidad · Flexibilidad · Compromiso (iconos: Users, MapPinned, ShieldCheck, BadgeCheck, Sparkles, HeartHandshake).
- **content.about:** "Nuestra historia" + 3 párrafos (Loica / experiencias memorables / elección preferida).
- **content.contactBlock / contactForm / footer:** badges, títulos y templates con tokens `{{siteName}}`, `{{year}}`, etc.
- **company.whatsappMessageDefault:** "Hola! Quiero reservar una experiencia en Patagonia:"
- **developerCredits:** "Tucs Digital".

## 2. Textos hardcodeados en componentes

### Navbar (`components/Navbar.tsx`)
- Links: Inicio `/#inicio` · Destinos `/#destinos` · Experiencias `/experiencias` · Nosotros `/#nosotros` · Contacto `/#contacto`
- Botones: "Reservar", "Reservar por WhatsApp"
- Mensaje WA: "Hola! Quiero reservar con Expedicion Sur."

### HeroSearch (`components/HeroSearch.tsx`)
- "¿A dónde quieres viajar?" · "Destinos" · "Excursiones" · "Cualquier fecha" (navega a `/experiencias?...`)

### CategoriesSection
- "Nuestros Destinos" · "Explorá nuestras categorías y encontrá el viaje perfecto para vos" · "No hay categorías destacadas disponibles" · "Ver todos los destinos (N)"

### ExperienciasSection
- Badge "Experiencias" · "Viví cada destino con Expedición Sur" · "Más que un viaje, una experiencia que se comparte."

### BlogSection
- "Blog" · "Últimas noticias" · "Novedades, lanzamientos y tips para viajar mejor."

### ContactSplitSection (bloque de contacto del home)
- Badge "Contacto" · H2 "Estamos para ayudarte" · "Tu proxima aventura comienza con un mensaje." · "En Expedicion Sur estamos listos para asesorarte y ayudarte a planificar la mejor experiencia en la Patagonia."
- Acordeón: WhatsApp ("Respuesta rapida") · Email ("Respondemos a la brevedad") · Horario ("Todos los dias") · Instagram ("Novedades y consultas")
- Mapa: "Nuestra ubicacion" · "Visitanos o escribinos para coordinar tu viaje." · "Como llegar"

### PublicInquiryForm (`components/forms/`)
- Variant contact: "Envianos tu consulta" · "Completa el formulario y te responderemos pronto." · campos Nombre y apellido / Email / Teléfono-WhatsApp / Tipo de consulta (+ "Paquete personalizado", "Asesoramiento general") / Tu mensaje · checkbox política de privacidad (link `/terminos-condiciones`) · botón "Enviar mensaje" / "Enviando..."
- Variant default: "Nombre" · "Email" · "WhatsApp" · "Experiencia de interes" · "Fecha estimada" ("Octubre 2026") · "Cantidad de pasajeros" · "Enviar consulta" / "Solicitar asesoramiento"
- Toasts: "Consulta enviada" · "Necesitamos tu consentimiento" · "No se pudo enviar la consulta"
- ⚠ Envía a `POST /api/contact` (ruta inexistente en este repo)

### Newsletter
- "Mantenete informado sobre nuestras últimas ofertas" · "Recibí novedades y promociones exclusivas" · placeholder "Ingresa tu dirección de correo electrónico" · "Suscríbete al Newsletter" · "¡Gracias por suscribirte!" · disclaimer "No compartimos tu información…"
- Escribe directo a Firestore colección `newsletter`

### Footer
- Tagline: "Expedicion Sur conecta viajeros con la Patagonia mediante experiencias autenticas, seguras y personalizadas."
- Menú: Inicio · Experiencias (×2) · Destinos · Nosotros · Contacto
- "El Calafate, Santa Cruz, Argentina" · "Desarrollo: Tucs Digital" · copyright con año actual

### Página /contacto (`app/contacto/page.tsx`)
- Metadata: "Contacto - Expedición Sur" · descripción "Contactate con Expedición Sur. Atención online y presencial. Consultas por WhatsApp o email."
- H1 "Contacto" · párrafo "Te brindamos todas nuestras vías de contacto para que puedas despejar todas tus dudas. Responderemos tu mensaje a la brevedad. ¡Muchas gracias por elegirnos!" · H2 "Somos Expedición Sur"
- Ítems: dirección, horario, teléfonos, WhatsApp, "Canal de WhatsApp", email (valores de `CONTACT_INFO` en `lib/constants.ts`)

### InstagramSection (no renderizado en home)
- "Instagram" · "Últimas publicaciones" · "Seguinos en Instagram…" · "Ver más en Instagram" · widget Elfsight app-id `d76e2806-2ea4-494e-a68a-2be617fd890a`
