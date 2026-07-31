# Lo necesario para Stripe y PIX

Documentación centrada en **qué hace falta** para que los pagos con **Stripe (tarjeta)** y **PIX** funcionen en este proyecto, y cómo están implementados.

Para el flujo completo de checkout (paso a paso, reserva, emails) ver **docs/CHECKOUT-PROCESO.md**. Para credenciales y Resend ver **docs/CHECKOUT-CREDENCIALES.md**.

---

## 1. Resumen rápido

| Necesario | Descripción |
|-----------|-------------|
| **Cuenta Stripe** | Tarjeta y PIX (PIX solo si la cuenta Stripe está en Brasil). |
| **Variables de entorno** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`; opcional `STRIPE_CURRENCY`. |
| **Webhook en Stripe** | URL `https://tudominio.com/api/stripe/webhook`, evento `checkout.session.completed`. |
| **Admin** | Por experiencia: habilitar Stripe y/o PIX y elegir moneda (ars, brl, usd). |

No hay integración separada para PIX: **PIX se usa a través de Stripe** cuando la cuenta está en Brasil. La misma API y webhook sirven para tarjeta y PIX.

---

## 2. Variables de entorno

### Obligatorias para pagos

| Variable | Uso |
|----------|-----|
| `STRIPE_SECRET_KEY` | Crear sesiones de Checkout y verificar webhooks. Sin ella, las rutas `/api/stripe/checkout-session` y `/api/stripe/webhook` devuelven 500. |
| `STRIPE_WEBHOOK_SECRET` | Verificar que los eventos POST al webhook vengan de Stripe (`stripe.webhooks.constructEvent`). Sin ella, el webhook responde 500. |
| `NEXT_PUBLIC_SITE_URL` | Armar `success_url` y `cancel_url` de la sesión de Checkout cuando el front no envía URLs (ej. `https://tudominio.com`). |

### Opcionales

| Variable | Uso |
|----------|-----|
| `STRIPE_CURRENCY` | Moneda por defecto cuando la experiencia no define `bookingConfig.currency`. Valores: `ars`, `brl`, `usd`. Si no está, se usa `ars` para tarjeta y `brl` para PIX. |

### Ejemplo `.env.local`

```env
NEXT_PUBLIC_SITE_URL=https://tudominio.com
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_CURRENCY=ars
```

En producción usar `sk_live_` y el webhook apuntando a la URL real del sitio.

---

## 3. Dónde obtener las APIs y claves de Stripe (y PIX)

Todo se obtiene desde el **Dashboard de Stripe**. La URL base es:

- **Producción:** [https://dashboard.stripe.com](https://dashboard.stripe.com)
- **Modo prueba:** [https://dashboard.stripe.com/test](https://dashboard.stripe.com/test) (o activar "Modo prueba" con el interruptor en la esquina superior derecha del dashboard).

En modo prueba las claves empiezan con `sk_test_` y `pk_test_`; no se cobra dinero real. Para cobrar de verdad usás las claves **Live** (`sk_live_`, `pk_live_`).

---

### 3.1 Crear cuenta en Stripe

1. Entrá a [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register).
2. Completá email, nombre y contraseña.
3. Confirmá el email y completá los datos de tu negocio si Stripe lo pide.
4. Para **PIX** la cuenta Stripe debe estar **radicada en Brasil**. Si creaste la cuenta en otro país, PIX no aparecerá como método de pago; en ese caso solo podés usar tarjeta hasta cambiar el país de la cuenta (o usar otra pasarela para PIX).

---

### 3.2 Secret Key (API Key secreta) → `STRIPE_SECRET_KEY`

**Qué es:** La clave que usa tu servidor para crear sesiones de pago y verificar webhooks. No debe estar en el front ni en el repositorio.

**Dónde obtenerla:**

1. Entrá al Dashboard: [https://dashboard.stripe.com](https://dashboard.stripe.com).
2. Activá **Modo prueba** (Test mode) si querés probar sin cobrar.
3. En el menú lateral: **Developers** (Desarrolladores).
4. Clic en **API keys** (Claves API).
5. En la sección **Standard keys** verás:
   - **Publishable key** (empieza con `pk_test_` o `pk_live_`) — no la usamos en este proyecto.
   - **Secret key** — clic en **Reveal test key** (o **Reveal live key** en producción).
6. Copiá esa clave (empieza con `sk_test_` o `sk_live_`).
7. Pegala en tu `.env.local` como `STRIPE_SECRET_KEY=sk_test_xxxxx`.

**Enlace directo:** [https://dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) (o [test](https://dashboard.stripe.com/test/apikeys)).

---

### 3.3 Webhook Secret → `STRIPE_WEBHOOK_SECRET`

**Qué es:** Un secreto que Stripe usa para firmar los eventos que envía a tu servidor. Tu API lo usa para comprobar que el POST al webhook viene de Stripe.

**Dónde obtenerla:**

1. En el Dashboard: **Developers** → **Webhooks**.
2. Clic en **Add endpoint** (Agregar endpoint).
3. **Endpoint URL:**  
   `https://elsherpa.info/api/stripe/webhook`  
   (reemplazá TU_DOMINIO por tu dominio real, ej. `tudominio.com`. En local no funciona hasta que tengas una URL pública; para probar en local se puede usar [Stripe CLI](https://stripe.com/docs/stripe-cli) para reenviar eventos.)
4. En **Select events to listen to**, elegí **Select events** y marcá solo:
   - **checkout.session.completed**
5. Clic en **Add endpoint**.
6. En la página del endpoint recién creado, en **Signing secret** clic en **Reveal**.
7. Copiá el valor (empieza con `whsec_`).
8. Pegalo en `.env.local` como `STRIPE_WEBHOOK_SECRET=whsec_xxxxx`.

**Enlace directo:** [https://dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks) (o [test](https://dashboard.stripe.com/test/webhooks)).

Sin este webhook configurado, cuando un cliente pague (tarjeta o PIX) Stripe no le avisará a tu servidor y no se guardará la reserva ni se enviarán los emails.

---

### 3.4 PIX (solo si tu cuenta Stripe está en Brasil)

**Qué es:** PIX es un método de pago instantáneo. En este proyecto **PIX se usa a través de Stripe**: no hay claves ni APIs aparte. Si tu cuenta Stripe está en Brasil, podés activar PIX en el dashboard y usar la misma `STRIPE_SECRET_KEY`; al crear la sesión de checkout con `payment_method_types: ['pix']` el cliente paga con PIX.

**Dónde activarlo:**

1. En el Dashboard: **Settings** (Configuración) → **Payment methods** (Métodos de pago).
2. Buscá **PIX** en la lista.
3. Si ves la opción, activala (Enable). Si no aparece, es porque la cuenta no está en Brasil y Stripe no ofrece PIX para tu región.
4. Para PIX en Brasil la moneda suele ser **BRL**. En el admin de cada experiencia elegí moneda **BRL**, o poné en `.env.local` `STRIPE_CURRENCY=brl`.

**Enlace directo:** [https://dashboard.stripe.com/settings/payment_methods](https://dashboard.stripe.com/settings/payment_methods) (o [test](https://dashboard.stripe.com/test/settings/payment_methods)).

**Resumen PIX:** No hay “clave de PIX” aparte. Solo necesitás cuenta Stripe en Brasil, activar PIX en Payment methods y usar la misma `STRIPE_SECRET_KEY`; el proyecto ya envía `payment_method_types: ['pix']` cuando el usuario elige PIX en el checkout.

---

### 3.5 Publishable Key (opcional en este proyecto)

**Dónde:** Misma página que la Secret key: **Developers** → **API keys** → **Publishable key** (`pk_test_` o `pk_live_`).

En este proyecto **no se usa** porque el checkout es **Stripe Checkout (hosted)**: el usuario es redirigido a la página de Stripe. La Publishable key solo haría falta si integraras **Stripe Elements** en tu propia página (formulario de tarjeta en tu sitio). Podés ignorarla para Stripe + PIX tal como está implementado.

---

## 4. Cómo se usa en el código

### 4.1 Cliente Stripe (servidor)

- **Archivo:** `lib/stripe.ts`
- Se crea una instancia de `Stripe` solo si existe `STRIPE_SECRET_KEY`.
- Se usa en:
  - `app/api/stripe/checkout-session/route.ts` → crear sesión.
  - `app/api/stripe/webhook/route.ts` → verificar firma y leer evento.

### 4.2 Crear sesión de pago (API)

- **Ruta:** `POST /api/stripe/checkout-session`
- **Body (resumido):** `slug` o `experienceId`, `date`, `people`, `paymentMethod: 'stripe' | 'pix'`, datos del cliente (email, nombre, etc.), `successUrl`/`cancelUrl` opcionales.
- **Lógica relevante:**
  - Se valida que la experiencia exista y que el método elegido esté habilitado (`bookingConfig.paymentMethods.stripe` / `.pix`).
  - Moneda: `bookingConfig.currency` de la experiencia, o `STRIPE_CURRENCY`, o por defecto `ars` (tarjeta) / `brl` (PIX).
  - Se llama a `stripe.checkout.sessions.create` con:
    - `payment_method_types: isPix ? ['pix'] : ['card']`
    - `line_items` con precio por persona × personas (en centavos).
    - `metadata` con date, people, experienceId, experienceSlug, experienceTitle, paymentMethod, y datos del cliente.
  - Se devuelve `{ url: session.url }`; el front redirige con `window.location.href = url`.

### 4.3 Webhook

- **Ruta:** `POST /api/stripe/webhook`
- **Header:** `stripe-signature` (obligatorio).
- Se verifica la firma con `STRIPE_WEBHOOK_SECRET`.
- Solo se procesa el evento `checkout.session.completed`:
  - Se crea la reserva en Firestore (colección `reservas`) con los datos de la sesión (incl. `paymentMethod: 'stripe' | 'pix'`).
  - Si Resend está configurado, se envía email al cliente y al admin.

Tanto tarjeta como PIX disparan el mismo evento al completar el pago; la diferencia está solo en cómo se creó la sesión (`payment_method_types`).

---

## 5. Configuración por experiencia (admin)

Cada experiencia tiene un **Reserva / Calendario** con:

- **Métodos de pago:** dos switches, “Stripe (tarjeta)” y “PIX”. Al menos uno debe estar activo.
- **Moneda:** `ars`, `brl` o `usd`. Afecta a Stripe y PIX (precio en centavos de esa moneda).

Eso se guarda en `bookingConfig`:

- `paymentMethods: { stripe: boolean, pix: boolean }`
- `currency: 'ars' | 'brl' | 'usd'`

El front de checkout (`CheckoutClient`) lee `experience.bookingConfig.paymentMethods` y muestra solo los botones de los métodos habilitados. La API de checkout-session rechaza con 400 si se envía un método no habilitado para esa experiencia.

**Archivos:** `app/admin/experiencias/[id]/page.tsx`, `app/admin/experiencias/nuevo/page.tsx` (sección Reserva / Calendario). Tipos en `components/landing-reserva/types.ts` (`BookingConfig`, `BookingPublicData`).

---

## 6. Flujo en una frase

El usuario elige Stripe o PIX en `/checkout` → el front hace POST a `/api/stripe/checkout-session` con `paymentMethod` → el servidor crea una sesión de Stripe Checkout con `payment_method_types: ['card']` o `['pix']` → el usuario paga en la página de Stripe → Stripe redirige a success/cancel y envía `checkout.session.completed` al webhook → el webhook guarda la reserva en Firestore (con `paymentMethod: 'stripe' | 'pix'`) y envía emails si Resend está configurado.

---

## 7. Monedas y montos

- Stripe espera montos en **centavos** (o unidad mínima de la moneda).
- En el proyecto el precio se guarda “por persona” en la unidad normal (ej. 50.000 ARS); al crear la sesión se hace `unit_amount = Math.round(unitPrice * 100)`.
- Monedas soportadas en el tipo: `ars`, `brl`, `usd`. Para PIX en Brasil se usa normalmente `brl`.

---

## 8. Referencia de archivos

| Qué | Archivo |
|-----|---------|
| Cliente Stripe | `lib/stripe.ts` |
| API crear sesión | `app/api/stripe/checkout-session/route.ts` |
| Webhook | `app/api/stripe/webhook/route.ts` |
| Front checkout (botones Stripe/PIX) | `components/checkout/CheckoutClient.tsx` |
| Tipos reserva y booking | `components/landing-reserva/types.ts` |
| Crear reserva en Firestore | `lib/reservas.ts` (createReserva) |
| Admin: métodos de pago por experiencia | `app/admin/experiencias/[id]/page.tsx`, `nuevo/page.tsx` |

---

## 9. Checklist para otro proyecto

- [ ] Cuenta Stripe creada; en Brasil si querés PIX.
- [ ] `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` en env.
- [ ] `NEXT_PUBLIC_SITE_URL` con la URL pública del sitio.
- [ ] Webhook en Stripe apuntando a `https://tudominio.com/api/stripe/webhook`, evento `checkout.session.completed`.
- [ ] Si usás PIX: PIX activado en Stripe y moneda BRL en la experiencia o en `STRIPE_CURRENCY`.
- [ ] Firestore: permisos para que el servidor escriba en la colección de reservas cuando se procese el webhook.
- [ ] Opcional: Resend para emails de confirmación (ver CHECKOUT-CREDENCIALES.md).
