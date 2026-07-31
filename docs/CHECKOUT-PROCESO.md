# Proceso de checkout, compra y final

Este documento describe **cómo funciona el flujo completo** desde que el usuario elige una experiencia hasta que la reserva queda registrada y el cliente recibe la confirmación.

---

## 1. Resumen del flujo

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PÁGINA DE EXPERIENCIA (/experiencias/[slug])                                    │
│  • Usuario ve el bloque "Reserva" (ReservaWidget)                                 │
│  • Elige fecha (si hay fechas específicas) y cantidad de personas                 │
│  • Clic en "Reservar" → redirección a /checkout?slug=...&date=...&people=...     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PÁGINA DE CHECKOUT (/checkout)                                                  │
│  • Servidor valida slug, date, people y carga la experiencia                     │
│  • CheckoutClient: paso 1 = formulario de datos (nombre, apellido, email, etc.)  │
│  • Paso 2 = elección de método de pago (Stripe tarjeta o PIX)                   │
│  • Los datos del formulario se persisten en sessionStorage por experiencia/fecha  │
│  • Clic en "Pagar con Stripe" o "Pagar con PIX" → POST /api/stripe/checkout-session │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  API CHECKOUT SESSION (POST /api/stripe/checkout-session)                         │
│  • Valida experiencia, cupo (si hay fecha), personas, método de pago            │
│  • Crea sesión de Stripe Checkout (mode: payment) con metadata                   │
│  • Devuelve { url } → el front redirige con window.location.href = url           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STRIPE CHECKOUT (hosted by Stripe)                                              │
│  • Usuario completa el pago (tarjeta o PIX según lo elegido)                      │
│  • Si paga: Stripe redirige a success_url (/checkout/success?slug=...&date=...&people=...) │
│  • Si cancela: Stripe redirige a cancel_url (/checkout/cancel?slug=...)           │
│  • Stripe envía evento checkout.session.completed al webhook                      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
          ┌─────────────────────────────┴─────────────────────────────┐
          ▼                                                           ▼
┌─────────────────────────────┐                     ┌─────────────────────────────────┐
│  PÁGINA DE ÉXITO            │                     │  WEBHOOK (POST /api/stripe/webhook)│
│  /checkout/success          │                     │  • Verifica firma Stripe         │
│  • Muestra título, fecha,   │                     │  • Crea documento en Firestore  │
│    personas de la reserva   │                     │    (colección reservas)         │
│  • Limpia sessionStorage    │                     │  • Envía email al cliente (Resend)│
│    del formulario checkout  │                     │  • Responde 200 { received: true }│
└─────────────────────────────┘                     └─────────────────────────────────┘
```

---

## 2. Paso a paso detallado

### 2.1 Origen: página de la experiencia

- **Ruta:** `/experiencias/[slug]` (p. ej. `/experiencias/rio-se-disfruta-mas`).
- **Componente:** `LandingReservaPage` usa `ReservaWidget`.
- **Datos:** La experiencia se carga en servidor; el bloque de reserva recibe fechas con cupos (`toBookingPublicData`), máx. personas y textos.
- **Comportamiento:**
  - Si la experiencia tiene **fechas específicas**: el usuario debe elegir una fecha del calendario (solo fechas con cupo disponible) y la cantidad de personas.
  - Si está en modo **sin fechas específicas**: no se elige fecha; se coordina después.
- **Botón "Reservar":**
  - Construye query: `slug`, `people`, y `date` (YYYY-MM-DD o `sin-fecha`).
  - Navega a: `/checkout?slug=...&date=...&people=...`.

**Archivos:**  
`components/landing-reserva/ReservaWidget.tsx`, `app/experiencias/[slug]/page.tsx`, `lib/experiencias.ts` (toBookingPublicData, getReservasCountByExperienceAndDate).

---

### 2.2 Llegada al checkout

- **Ruta:** `/checkout` (con query `slug`, `date`, `people`).
- **Página:** `app/checkout/page.tsx` (Server Component).
  - Valida que existan `slug` y `people` (1–50).
  - Carga la experiencia por slug; si no existe o `people` supera el máximo, redirige a inicio o a la experiencia.
  - Si hay fechas específicas y no se envió fecha válida, redirige a la experiencia.
  - Normaliza `date` a `sin-fecha` cuando corresponde.
- **Cliente:** `CheckoutClient` recibe `experience`, `date`, `people`.

**Persistencia del formulario:**  
Los datos (nombre, apellido, email, teléfono, etc.) se guardan en `sessionStorage` bajo la clave `checkout_form_{slug}_{date}_{people}`. Si el usuario vuelve al checkout con los mismos parámetros, los campos se rellenan. Al llegar a la página de éxito, esa clave se borra (`ClearCheckoutStorage`).

---

### 2.3 Formulario y método de pago (CheckoutClient)

1. **Paso 1 – Datos personales**
   - Campos: nombre, apellido, email (obligatorios), teléfono, país, documento, comentarios (opcionales).
   - Validación en cliente (longitud mínima, email válido).
   - Al enviar el formulario sin errores se pasa al paso 2.

2. **Paso 2 – Método de pago**
   - Botones según configuración de la experiencia: **Stripe (tarjeta)** y/o **PIX**.
   - Al elegir uno se llama a `createCheckoutSession(paymentMethod)`.

3. **Creación de la sesión**
   - `POST /api/stripe/checkout-session` con body:
     - `slug` o `experienceId`, `date`, `people`, `paymentMethod` ('stripe' | 'pix'),
     - `customerEmail`, `customerName`, `customerPhone`, `customerCountry`, `customerDocument`, `customerComments`,
     - `successUrl`, `cancelUrl` (opcionales; si no se envían, el API arma las URLs por defecto).
   - La API devuelve `{ url }` (URL de Stripe Checkout).
   - El front hace `window.location.href = url` y el usuario sale del sitio hacia Stripe.

**Archivos:**  
`components/checkout/CheckoutClient.tsx`, `app/api/stripe/checkout-session/route.ts`.

---

### 2.4 API de checkout session (servidor)

- **Método:** POST.  
- **Body (Zod):** slug o experienceId, date (opcional), people (1–50), paymentMethod, datos del cliente, successUrl/cancelUrl opcionales.
- **Lógica resumida:**
  1. Resolver experiencia por `slug` o `experienceId`.
  2. Validar `people` contra `maxPeoplePerBooking` (o 50 por defecto).
  3. Si `date` no es `sin-fecha`: comprobar cupo (reservas ya hechas para esa fecha vs. capacidad de la experiencia); si no hay cupo, 400.
  4. Validar que el método elegido (Stripe o PIX) esté habilitado en la experiencia.
  5. Obtener precio por persona (`depositAmount` o `price`), moneda (config de experiencia o `STRIPE_CURRENCY`).
  6. Crear sesión de Stripe:
     - `mode: 'payment'`
     - `payment_method_types: ['card']` o `['pix']`
     - `line_items`: nombre de la experiencia, cantidad = people, unit_amount en centavos
     - `metadata`: date, people, experienceId, experienceSlug, experienceTitle, paymentMethod, y todos los datos del cliente que se hayan enviado
  7. Devolver `{ url: session.url }`.

**Importante:** El monto que ve Stripe es **precio por persona × personas**; la moneda puede ser ARS, BRL o USD según la configuración de la experiencia y env.

**Archivo:** `app/api/stripe/checkout-session/route.ts`.

---

### 2.5 Pago en Stripe y redirección

- El usuario completa el pago en la página de Stripe (tarjeta o PIX).
- **Si el pago es exitoso:** Stripe redirige a `success_url` (ej. `/checkout/success?slug=...&date=...&people=...`).
- **Si el usuario cancela:** Stripe redirige a `cancel_url` (ej. `/checkout/cancel?slug=...`).
- En paralelo, Stripe envía el evento **checkout.session.completed** a la URL del webhook configurada (`/api/stripe/webhook`).

---

### 2.6 Webhook: reserva y email

- **Ruta:** POST `/api/stripe/webhook`.
- **Seguridad:** Se valida el header `stripe-signature` con `STRIPE_WEBHOOK_SECRET`.
- **Evento manejado:** `checkout.session.completed`.
- **Acciones:**
  1. **Guardar reserva en Firestore** (colección `reservas`):
     - Se lee de la sesión: experienceId, experienceSlug, experienceTitle, date, people, amountTotal, currency, paymentMethod, stripeSessionId, customerEmail, customerName, customerPhone, customerCountry, customerDocument, customerComments.
     - Se crea un documento con `status: 'completed'` y `createdAt: Timestamp.now()`.
  2. **Enviar email al cliente (Resend):**
     - Si están configurados `RESEND_API_KEY` y `RESEND_FROM_EMAIL`.
     - Asunto: "Reserva confirmada: [nombre experiencia]".
     - Cuerpo HTML: saludo, tabla con experiencia, fecha formateada, personas, monto abonado, referencia (session.id), mensaje de contacto.
- Cualquier error al guardar la reserva o al enviar el email se registra en consola; el webhook responde igual 200 para que Stripe no reintente por eso.

**Archivos:** `app/api/stripe/webhook/route.ts`, `lib/reservas.ts` (createReserva), `lib/resend.ts`.

---

### 2.7 Página de éxito

- **Ruta:** `/checkout/success?slug=...&date=...&people=...`.
- **Página:** `app/checkout/success/page.tsx`.
  - Opcionalmente carga la experiencia por slug para mostrar el título.
  - Muestra mensaje de pago exitoso, detalle (título de experiencia, fecha formateada, cantidad de personas).
  - Incluye el componente cliente `ClearCheckoutStorage`, que elimina la clave de `sessionStorage` del formulario de checkout para esa combinación slug/date/people.
  - Enlaces: "Ver experiencia" (a `/experiencias/[slug]`) e "Ir al inicio".

---

### 2.8 Página de cancelación

- **Ruta:** `/checkout/cancel?slug=...` (y opcionalmente date, people).
- **Página:** `app/checkout/cancel/page.tsx`.
  - Mensaje de que no se realizó ningún cargo.
  - Botones: "Volver a la experiencia" e "Ir al inicio".

---

## 3. Datos que quedan guardados

### 3.1 Firestore – colección `reservas`

Cada documento tiene (entre otros):

| Campo            | Origen                    | Uso principal                    |
|------------------|---------------------------|----------------------------------|
| experienceId     | metadata sesión Stripe    | Filtros en admin, reportes      |
| experienceSlug   | metadata                  | Enlaces a la experiencia        |
| experienceTitle  | metadata (o consulta)    | Listados y email                |
| date             | metadata                  | YYYY-MM-DD o "sin-fecha"        |
| people           | metadata                  | Cupos y totales                 |
| amountTotal      | session.amount_total      | En centavos; facturación        |
| currency         | session.currency          | ARS, BRL, USD                   |
| paymentMethod    | metadata                  | 'stripe' o 'pix'                |
| stripeSessionId  | session.id                | Soporte e idempotencia          |
| customerEmail    | metadata / customer_details | Contacto y email confirmación   |
| customerName     | metadata / customer_details | Personalización                 |
| customerPhone, etc. | metadata               | Opcional                        |
| status           | fijo 'completed'          | Solo completadas se listan      |
| createdAt        | Timestamp.now()           | Orden y auditoría               |

Las reservas se usan en el admin (listado, detalle) y para calcular cupo por fecha en la API de checkout y en la landing.

### 3.2 Stripe

- **Checkout Session:** guarda toda la metadata anterior; el pago queda asociado a la sesión.
- **Webhook:** el único evento que se escucha es `checkout.session.completed`.

---

## 4. Archivos y rutas de referencia

| Qué                         | Dónde |
|-----------------------------|--------|
| Widget de reserva en experiencia | `components/landing-reserva/ReservaWidget.tsx` |
| Página checkout             | `app/checkout/page.tsx` |
| Cliente checkout (form + pago) | `components/checkout/CheckoutClient.tsx` |
| Limpiar storage en éxito    | `components/checkout/ClearCheckoutStorage.tsx` |
| API crear sesión Stripe     | `app/api/stripe/checkout-session/route.ts` |
| Webhook Stripe              | `app/api/stripe/webhook/route.ts` |
| Página éxito                | `app/checkout/success/page.tsx` |
| Página cancelación          | `app/checkout/cancel/page.tsx` |
| Crear reserva en Firestore  | `lib/reservas.ts` (createReserva, getReservas, getReservasCountByExperienceAndDate) |
| Datos de reserva públicos   | `lib/experiencias.ts` (toBookingPublicData) |
| Envío de email              | `lib/resend.ts` + plantilla en webhook |

---

## 5. Credenciales y configuración

Para que el flujo funcione necesitás:

- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, opcionalmente `STRIPE_CURRENCY`.
- **Resend:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (para el email de confirmación).
- **Sitio:** `NEXT_PUBLIC_SITE_URL` (para armar success_url y cancel_url si no se envían desde el front).

Detalle de cómo obtener cada una y ejemplo de `.env.local` está en **docs/CHECKOUT-CREDENCIALES.md**.

---

## 6. Resumen en una frase

El usuario elige experiencia, fecha y personas en la landing → completa sus datos y método de pago en `/checkout` → es redirigido a Stripe, paga → Stripe redirige a `/checkout/success` y dispara el webhook → el webhook guarda la reserva en Firestore y envía el email de confirmación; la página de éxito muestra el detalle de la reserva y limpia el formulario guardado.
