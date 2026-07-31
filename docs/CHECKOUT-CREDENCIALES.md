# Credenciales para Checkout (Stripe, PIX, Resend)

Este documento explica **qué datos necesitás** para los pagos y emails, y **cómo obtenerlos**.

---

## Qué hace falta para que funcionen los pagos (checklist)

Los pagos son con **Stripe** (tarjeta) y **PIX** (vía Stripe cuando la cuenta está en Brasil). La misma configuración de Stripe sirve para ambos.

1. **Cuenta en Stripe**  
   [Registro](https://dashboard.stripe.com/register) → Activar **modo prueba** para probar sin cobrar de verdad. Para **PIX**: si tu cuenta Stripe está en Brasil, activá PIX en **Settings → Payment methods**; la misma `STRIPE_SECRET_KEY` se usa para tarjeta y PIX.

2. **Variables en `.env.local`** (en la raíz del proyecto):
   - `STRIPE_SECRET_KEY` → Developers → API keys → Secret key (`sk_test_...` o `sk_live_...`) — usada para **Stripe (tarjeta)** y **PIX**.
   - `STRIPE_WEBHOOK_SECRET` → Developers → Webhooks → Add endpoint → URL `https://tudominio.com/api/stripe/webhook`, evento `checkout.session.completed` → copiar Signing secret (`whsec_...`)
   - `NEXT_PUBLIC_SITE_URL` → URL pública del sitio (ej. `https://viaggiotur.vercel.app`) para las redirecciones de éxito/cancelación.
   - `STRIPE_CURRENCY` → `ars`, `brl` o `usd` según cobres; para PIX en Brasil suele ser `brl`.

3. **Webhook en Stripe**  
   URL: `https://TU_DOMINIO/api/stripe/webhook`. Sin esto, Stripe no avisa al sitio cuando el pago (tarjeta o PIX) se completó y no se guarda la reserva ni se envía el email.

4. **Emails (opcional pero recomendado)**  
   Para enviar confirmación al cliente: cuenta en [Resend](https://resend.com), `RESEND_API_KEY` y `RESEND_FROM_EMAIL` en `.env.local`. Sin esto, el pago se procesa y la reserva se guarda, pero no se manda email.

5. **Firestore**  
   Reglas que permitan **escribir** en la colección donde se guardan las reservas cuando el webhook llama a tu API (el servidor es quien escribe; ver `docs/FIRESTORE-RULES.md` si aplica).

Después de cargar las variables, reiniciá el servidor (`npm run dev` o el deploy). Para probar en local, el webhook de Stripe tiene que poder llegar a tu máquina (ej. con [Stripe CLI](https://stripe.com/docs/stripe-cli) o desplegando a un dominio público).

---

## 1. Stripe (pagos con tarjeta y/o PIX)

### ¿Qué es?
Stripe es la pasarela de pago que usamos para cobrar con **tarjeta** y, si tu cuenta está en Brasil, también **PIX**.

### ¿Qué necesito de vos?

| Variable de entorno | Descripción | Dónde se usa |
|--------------------|-------------|--------------|
| `STRIPE_SECRET_KEY` | Clave secreta del API (empieza con `sk_live_` en producción o `sk_test_` en pruebas) | Servidor: crear sesiones de pago, webhooks |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Clave pública (empieza con `pk_live_` o `pk_test_`) | Cliente: si usás Stripe Elements en el front |
| `STRIPE_WEBHOOK_SECRET` | Secreto del webhook (empieza con `whsec_`) | Servidor: verificar que los eventos vengan de Stripe |
| `STRIPE_CURRENCY` | Moneda (ej. `ars`, `brl`, `usd`) | Opcional; por defecto se usa `ars` |

### Cómo obtener los datos de Stripe

1. **Crear cuenta**: [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. **Modo prueba**: En el dashboard, activá "Modo prueba" (Test mode) para usar claves `sk_test_` y `pk_test_` sin cobrar de verdad.
3. **Secret Key**:
   - Ir a **Developers → API keys**
   - Copiar **Secret key** (no la compartas ni la subas a Git).
4. **Publishable Key**:
   - En la misma página, copiar **Publishable key**.
5. **Webhook** (para confirmar pagos y enviar emails con Resend):
   - **Developers → Webhooks → Add endpoint**
   - URL: `https://tudominio.com/api/stripe/webhook`
   - Eventos a escuchar: `checkout.session.completed`
   - Crear y copiar el **Signing secret** (`whsec_...`) como `STRIPE_WEBHOOK_SECRET`.
6. **PIX (Stripe)**:
   - Stripe permite PIX si tu **cuenta está radicada en Brasil**.
   - En **Settings → Payment methods** activá **PIX**.
   - En el checkout, cuando el cliente elige "Pagar con PIX", se crea una sesión de Stripe Checkout con `payment_method_types: ['pix']`; el cliente es redirigido a Stripe, paga con PIX (QR o copia/pega) y vuelve a tu URL de éxito. La moneda para PIX suele ser **BRL** (`STRIPE_CURRENCY=brl`).

**Aranceles Stripe**: Consultá [Precios de Stripe](https://stripe.com/pricing) por país. En Argentina/Brasil suele ser un % por transacción + un fijo.

---

## 2. PIX

### Si usás Stripe en Brasil
- No necesitás credenciales aparte: **PIX se habilita en Stripe** (ver arriba).
- El flujo usa el mismo `STRIPE_SECRET_KEY` y creamos un Payment Intent con método `pix`.

### Si NO usás Stripe (ej. solo Argentina)
- Para PIX fuera de Brasil, una opción es **Mercado Pago** (acepta PIX en varios países).
- En ese caso haría falta integrar el API de Mercado Pago y usar sus credenciales (`MP_ACCESS_TOKEN`, etc.). Por ahora el flujo está preparado para **Stripe (tarjeta) + Stripe PIX (Brasil)**.

---

## 3. Resend (envío de emails)

### ¿Qué es?
Resend es el servicio que usamos para enviar **emails de confirmación de reserva**. Cuando un pago se completa (webhook `checkout.session.completed`), se envían **dos emails**: uno al **cliente** (confirmación con resumen y próximos pasos) y otro a **tu email** (`CONTACT_INFO.email` en `lib/constants.ts`, ej. `reservas@elsherpa.info`) con el detalle de la nueva reserva para que tengas el aviso al instante.

### ¿Qué necesito de vos?

| Variable de entorno | Descripción |
|--------------------|-------------|
| `RESEND_API_KEY` | API Key de Resend (empieza con `re_`) |
| `RESEND_FROM_EMAIL` | Email remitente (ej. `reservas@tudominio.com`). Debe estar verificado en Resend. |

### Cómo obtener los datos de Resend

1. **Crear cuenta**: [https://resend.com/signup](https://resend.com/signup)
2. **API Key**:
   - Ir a **API Keys → Create API Key**
   - Nombre ej. "Momentaneo producción", permisos "Sending access".
   - Copiar la clave (solo se muestra una vez).
3. **Dominio y remitente**:
   - **Domains → Add Domain** → agregar tu dominio (ej. `elsherpa.info`).
   - Resend te da registros DNS (SPF, DKIM, etc.) para agregar en tu proveedor de dominio.
   - Una vez verificado, podés usar `reservas@tudominio.com` como `RESEND_FROM_EMAIL`.
4. **Pruebas sin dominio**:
   - Resend permite enviar desde `onboarding@resend.dev` solo a tu email de registro; útil para probar.

**Aranceles Resend**: [Precios Resend](https://resend.com/pricing). Plan gratis: 3.000 emails/mes.

---

## 4. Resumen: archivo `.env.local`

Agregá (o completá) en tu `.env.local`:

```env
# Sitio (para URLs de éxito/cancelación)
NEXT_PUBLIC_SITE_URL=https://tudominio.com

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_CURRENCY=ars

# Resend
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=reservas@tudominio.com
```

Para **producción**, usá las claves `sk_live_` y `pk_live_`, el webhook apuntando a tu URL real y el dominio verificado en Resend.

---

## 5. Flujo de checkout implementado

1. **Experiencia** (admin): En crear/editar experiencia elegís métodos de pago: **Stripe** y/o **PIX**.
2. **Front**: En la landing de la experiencia se muestran los botones según lo configurado (Stripe y/o PIX).
3. **Checkout** (`/checkout`): Se envían slug, fecha y personas; se muestran datos de la experiencia, formulario de datos personales y luego elección de método (Stripe o PIX).
4. **Pago**:
   - **Stripe**: redirección a Stripe Checkout; al completar, Stripe llama al webhook y nosotros enviamos el email con Resend.
   - **PIX**: creación de Payment Intent PIX; el usuario paga con QR/código; al confirmar el pago, webhook y email.
5. **URLs**: éxito → `/checkout/success`, cancelación → `/checkout/cancel` (o volver a la experiencia).

Si querés usar **solo Mercado Pago** para PIX en el futuro, se puede añadir otra integración y mostrarla como opción en el admin junto a Stripe.
