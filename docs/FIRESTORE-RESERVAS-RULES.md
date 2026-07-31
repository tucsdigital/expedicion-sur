# Reglas de Firestore para la colección `reservas`

La colección **`reservas`** guarda las reservas completadas (checkout exitoso). Debe estar protegida para que:

- **Solo usuarios autenticados** (panel admin) puedan **leer** y listar reservas.
- **Solo el backend** (webhook de Stripe) pueda **crear** documentos.

## Importante: webhook y SDK

Hoy el webhook (`app/api/stripe/webhook/route.ts`) usa el **Firebase Client SDK** (`lib/firebase.ts`) desde el servidor. En ese contexto **no hay usuario logueado**, por lo que en las reglas `request.auth` será `null` en las peticiones del webhook.

Tienes dos enfoques:

---

### Opción A: Reglas con create sin auth (compatible con el código actual)

Si mantienes el webhook usando el Client SDK, Firestore debe **permitir create sin auth** en `reservas`. Las reglas quedarían así:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Colección reservas: solo admins leen; el backend crea sin auth
    match /reservas/{reservaId} {
      // Lectura: solo usuarios autenticados (panel admin)
      allow read: if request.auth != null;
      // Creación: permitida sin auth para el webhook (Client SDK)
      allow create: if true;
      allow update, delete: if request.auth != null;
    }

    // Mantén aquí el resto de tus colecciones (experiencias, paquetes, etc.)
  }
}
```

- **Ventaja:** no requiere cambios en el código; el webhook sigue funcionando.
- **Desventaja:** cualquier cliente que use tu API key podría crear documentos en `reservas` si conoce la estructura. El riesgo se mitiga porque la API key suele usarse solo en tu dominio y el webhook está protegido por la firma de Stripe.

---

### Opción B (recomendada a medio plazo): Firebase Admin SDK en el webhook

Para máxima seguridad:

1. **Migrar el webhook** a **Firebase Admin SDK** (`firebase-admin`). El Admin SDK **ignora las reglas** y usa una cuenta de servicio, así que el webhook seguiría pudiendo hacer `createReserva` sin problema.
2. **Reglas estrictas** en `reservas`: denegar todo acceso desde clientes y permitir solo lectura para usuarios autenticados si quieres que el panel admin siga usando el Client SDK para listar reservas.

Ejemplo de reglas con Admin en backend:

```javascript
match /reservas/{reservaId} {
  allow read: if request.auth != null;
  allow create, update, delete: if false;  // Solo el Admin SDK (backend) escribe
}
```

En ese caso, **toda** escritura en `reservas` debe hacerse desde el backend con el Admin SDK (por ejemplo solo en el webhook).

---

## Dónde configurar las reglas

1. Abre [Firebase Console](https://console.firebase.google.com) → tu proyecto → **Firestore Database** → pestaña **Reglas**.
2. Añade o adapta el bloque `match /reservas/...` dentro de `match /databases/{database}/documents` (respeta el resto de colecciones que ya tengas).
3. Pulsa **Publicar**.

Si tu proyecto no tiene aún otras reglas, puedes usar solo el bloque de `reservas` dentro del `match /databases/{database}/documents` y dejar el resto de colecciones con tus reglas actuales.

---

## Índices compuestos (opcional)

Si quieres listar reservas por `experienceId` + `date` + `createdAt` o por `status` + `createdAt`, Firestore puede pedir un **índice compuesto**. Cuando falte, el error en consola incluirá un enlace para crearlo automáticamente. También puedes crearlos en Firestore → **Índices** → **Índices compuestos**.
