# Sistema de Referidos y Vendedores

Este documento describe la arquitectura y los flujos del sistema de referidos para vendedores: captura de código, cálculo de comisiones, persistencia en reservas y vistas para Super Admin y Vendedores.

## Objetivo
- Permitir que vendedores generen enlaces con código de referido.
- Atribuir reservas a esos vendedores cuando los clientes compran desde dichos enlaces.
- Calcular y congelar la comisión (snapshot) en la reserva.
- Dar visibilidad y control al Super Admin (listado, totales, pago de comisiones).
- Ofrecer un portal para vendedores: resumen, reservas y gestión de enlaces.

## Datos en Firestore
- Colección `vendors`: datos de vendedor y regla de comisión por defecto.
  - Tipo: [types/vendor.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/types/vendor.ts)
- Colección `referralLinks`: códigos activos por vendedor (un vendor puede tener varios códigos).
  - CRUD: [lib/vendors.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/lib/vendors.ts)
- Colección `reservas`: cada documento puede tener `referredBy` (snapshot de comisión).
  - Tipos de reserva: [types.ts (Reservation)](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/components/landing-reserva/types.ts#L94-L190)

`Reservation.referredBy` guarda:
- vendorId, vendorName, code, channel ('link'|'manual')
- commissionType ('percent'|'fixed'), commissionValue, commissionCurrency
- commissionAmount (centavos), payoutStatus ('pending'|'accrued'|'paid'|'cancelled'), payoutAt?

## Cálculo de comisiones
- Se calcula usando la `defaultCommission` del vendedor en el momento de creación de la reserva (snapshot).
- Implementación: [lib/referrals.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/lib/referrals.ts)
  - `computeCommission({ amountTotal, people, vendor })`
  - `resolveReferralFromCode(code)` valida link y vendedor activo.
  - `nextPayoutStatusForReservationStatus(status)` mapea estado de reserva → estado de comisión.

## Captura del código de referido (Front)
- Landing de experiencia → Checkout:
  - Propaga `ref` en la URL de checkout si viene en la URL pública.
  - Enlace: [ReservaWidget.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/components/landing-reserva/ReservaWidget.tsx#L151-L166)
- En el checkout se lee `ref`/`referral`/`code` de la URL y se envía a la creación de sesión:
  - Implementación: [CheckoutClient.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/components/checkout/CheckoutClient.tsx#L165-L203)

## Creación de sesión y finalización (API)
- Crear sesión de Stripe: [app/api/stripe/checkout-session/route.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/api/stripe/checkout-session/route.ts)
  - Acepta `referralCode` y lo guarda en `checkoutIntents` y `metadata` de Stripe.
- Finalizar checkout: [app/api/checkout/finalize/route.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/api/checkout/finalize/route.ts)
  - Reconstruye contexto (intent + metadata).
  - Resuelve el vendor desde `referralCode`.
  - Calcula y guarda `referredBy` con `commissionAmount` y `payoutStatus` inicial (según estado de la reserva, típico 'reserved').

## Reservas manuales con vendedor (Super Admin)
- Endpoint: [app/api/admin/reservas/route.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/api/admin/reservas/route.ts)
  - Permite pasar `vendorId` (y opcional `statusNote`).
  - Calcula snapshot de comisión y lo persiste en la reserva (`channel: 'manual'`).

## Actualización de estado de comisión
- Cuando una reserva cambia a `completed` o `cancelled`, se actualiza automáticamente `referredBy.payoutStatus` con:
  - completed → accrued
  - cancelled → cancelled
- Lógica en PATCH de admin reservas: [admin/reservas/route.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/api/admin/reservas/route.ts#L360-L369)

## Panel Admin
- Navegación con entradas "Vendedores" y "Referidos":
  - [AdminLayout.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/components/admin/AdminLayout.tsx#L27-L40)

### Vendedores
- Ruta: `/admin/vendedores`
- Archivo: [app/admin/vendedores/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/admin/vendedores/page.tsx)
- Funciones:
  - Listado con búsqueda y paginación.
  - Alta/edición de vendedores con `defaultCommission`.
  - Activar/desactivar.

### Referidos
- Ruta: `/admin/referidos`
- Archivo: [app/admin/referidos/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/admin/referidos/page.tsx)
- Funciones:
  - Filtros por vendedor y estado de comisión.
  - Búsqueda por cliente/experiencia.
  - Totales: ventas y comisiones (vista filtrada).
  - Acción masiva “Marcar pagadas”.

### Marcar comisiones “Pagadas”
- Endpoint: [app/api/admin/referidos/payout/route.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/api/admin/referidos/payout/route.ts)
- Body:
  ```json
  { "reservationIds": ["<id1>", "<id2>", "..."] }
  ```
- Efecto: setea `'referredBy.payoutStatus' = 'paid'` y `payoutAt = now`.

### Visual en Reservas
- Listado `/admin/reservas`: muestra badge con `vendorName` cuando aplica.  
  Ver: [app/admin/reservas/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/admin/reservas/page.tsx)
- Detalle `/admin/reservas/[id]`: sección “Referido” con regla y comisión.  
  Ver: [app/admin/reservas/[id]/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/admin/reservas/%5Bid%5D/page.tsx)

## Portal Vendedor

### Acceso y layout
- Guard de acceso por email de Firebase y existencia en `vendors` (activo):
  - [components/vendor/VendorProtectedRoute.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/components/vendor/VendorProtectedRoute.tsx)
- Layout y navegación:
  - [components/vendor/VendorLayout.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/components/vendor/VendorLayout.tsx)

### Login
- Ruta: `/vendedor/login`
- Archivo: [app/vendedor/login/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/vendedor/login/page.tsx)
  - Autentica por Firebase Auth.
  - Valida que exista un `vendor` con ese email.

### Onboarding y autenticación
- Primer acceso (crear cuenta):
  - En la misma pantalla de login, pestaña “Crear cuenta”.
  - Se permite crear usuario de Firebase Auth solo si el email existe en `vendors` y `active: true`.
  - Requiere contraseña de al menos 8 caracteres.
- Acceso recurrente:
  - Pestaña “Ingresar” con email y contraseña.
  - Si el email no está autorizado como vendedor, se deniega el acceso aunque el Auth sea válido.
- Restablecer contraseña:
  - Enlace “Olvidé mi contraseña” envía email de reseteo vía Firebase Auth.
  - Mensaje neutro para evitar filtrado de existencia de cuentas.

### Dashboard
- Ruta: `/vendedor`
- Archivo: [app/vendedor/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/vendedor/page.tsx)
  - KPIs: ventas referidas y comisiones totales.
  - Últimas reservas referidas.

### Reservas
- Ruta: `/vendedor/reservas`
- Archivo: [app/vendedor/reservas/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/vendedor/reservas/page.tsx)
  - Listado filtrable por estado de comisión y búsqueda.
  - Campos: fecha, experiencia, cliente, venta, comisión, estado.

### Enlaces
- Ruta: `/vendedor/enlaces`
- Archivo: [app/vendedor/enlaces/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/vendedor/enlaces/page.tsx)
  - Crear código de referido (activo).
  - Copiar enlace público (incluye `?ref=<CODE>`).
  - Desactivar enlaces.

## Parámetros de URL
- Público:
  - `?ref=CODE` (también aceptados `referral`/`code` en front).
  - Se propaga a `/checkout` y luego a `checkoutIntents` y `metadata` de Stripe.

## Seguridad y permisos
- Admin:
  - Rutas bajo `/admin/*` protegidas por `ProtectedRoute` y validación de dominio.  
    Ver: [ProtectedRoute.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/components/admin/ProtectedRoute.tsx)
  - Endpoints que modifican datos sensibles usan `requireAdminToken`.
- Vendedor:
  - Debe autenticarse con Firebase y tener un documento `vendors` con su `email` y `active: true`.

## Notas operativas
- Si una reserva cambia a `completed`, la comisión pasa a `accrued` automáticamente.
- Cancelaciones pasan a `cancelled`.
- “Pagadas” se marcan desde `/admin/referidos` (acción masiva).
- Reservas manuales con `vendorId` registran la comisión con canal `'manual'`.

## Archivos clave (referencias)
- Tipos:
  - [types/vendor.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/types/vendor.ts)
  - [components/landing-reserva/types.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/components/landing-reserva/types.ts)
- Lógica:
  - [lib/vendors.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/lib/vendors.ts)
  - [lib/referrals.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/lib/referrals.ts)
- Front captura y checkout:
  - [components/landing-reserva/ReservaWidget.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/components/landing-reserva/ReservaWidget.tsx)
  - [components/checkout/CheckoutClient.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/components/checkout/CheckoutClient.tsx)
- API:
  - [api/stripe/checkout-session/route.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/api/stripe/checkout-session/route.ts)
  - [api/checkout/finalize/route.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/api/checkout/finalize/route.ts)
  - [api/admin/reservas/route.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/api/admin/reservas/route.ts)
  - [api/admin/referidos/payout/route.ts](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/api/admin/referidos/payout/route.ts)
- Admin UI:
  - [components/admin/AdminLayout.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/components/admin/AdminLayout.tsx)
  - [app/admin/vendedores/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/admin/vendedores/page.tsx)
  - [app/admin/referidos/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/admin/referidos/page.tsx)
  - [app/admin/reservas/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/admin/reservas/page.tsx)
  - [app/admin/reservas/[id]/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/admin/reservas/%5Bid%5D/page.tsx)
- Portal vendedor:
  - [components/vendor/VendorProtectedRoute.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/components/vendor/VendorProtectedRoute.tsx)
  - [components/vendor/VendorLayout.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/components/vendor/VendorLayout.tsx)
  - [app/vendedor/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/vendedor/page.tsx)
  - [app/vendedor/reservas/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/vendedor/reservas/page.tsx)
  - [app/vendedor/enlaces/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/vendedor/enlaces/page.tsx)
  - [app/vendedor/login/page.tsx](file:///c:/Users/Lauti/Documents/GitHub/el%20sherpa/app/vendedor/login/page.tsx)

## FAQ breve
- ¿Cómo comparte un vendedor su enlace?
  - Desde `/vendedor/enlaces` copia el link que incluye `?ref=CODIGO`.
- ¿Cómo marca el admin una comisión como pagada?
  - En `/admin/referidos`, selecciona reservas y usa “Marcar pagadas” (endpoint de payout).
- ¿Se recalculan comisiones si cambia la regla del vendedor?
  - No. La comisión en la reserva es un snapshot inmutable.
