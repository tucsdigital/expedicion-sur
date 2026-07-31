# Reglas de Firestore – Permisos y error "Missing or insufficient permissions"

El error **"Missing or insufficient permissions"** (FirebaseError) suele aparecer cuando las **reglas de Firestore** no permiten la operación que hace la app.

En este proyecto las páginas **públicas** (inicio, `/experiencias`, `/experiencias/[slug]`, `/paquetes`, etc.) cargan datos desde el **servidor** (Next.js) usando el **Firebase Client SDK** (`lib/firebase.ts`). En ese contexto **no hay usuario autenticado** (`request.auth` es `null`). Por eso, si las reglas exigen algo como `request.auth != null` para leer, la lectura falla.

---

## Solución: permitir lectura pública donde haga falta

Las colecciones que se leen en páginas públicas **deben permitir lectura sin autenticación**. Escritura puede quedar solo para usuarios autenticados (admin).

A continuación tienes un **ejemplo de reglas** que puedes usar o adaptar en la consola de Firebase.

---

## Dónde configurar

1. Entrá a [Firebase Console](https://console.firebase.google.com) → tu proyecto.
2. **Firestore Database** → pestaña **Reglas**.
3. Reemplazá o fusioná con tus reglas actuales el bloque que corresponda.
4. **Publicar**.

---

## Ejemplo de reglas completas

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ─── Páginas públicas (lectura sin login) ─────────────────────
    // Experiencias: listado (/experiencias) y detalle (/experiencias/[slug])
    match /experiencias/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Paquetes: listado (/paquetes) y detalle
    match /paquetes/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Categorías: usadas en home y filtros de paquetes
    match /categorias/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Banners y secciones: home
    match /banners/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /secciones/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // ─── Reservas: solo admin lee; webhook crea (sin auth) ─────────
    match /reservas/{reservaId} {
      allow read: if request.auth != null;
      allow create: if true;   // webhook con Client SDK
      allow update, delete: if request.auth != null;
    }

    // ─── Resto (consultas, newsletter, etc.) ───────────────────────
    // Ajustá según quién deba leer/escribir
    match /consultas/{docId} {
      allow read, write: if request.auth != null;
    }
    match /newsletter/{docId} {
      allow read: if request.auth != null;
      allow create: if true;   // si hay registro público
    }
  }
}
```

---

## Resumen por colección

| Colección    | Lectura pública | Motivo |
|-------------|------------------|--------|
| `experiencias` | **Sí** (`allow read: if true`) | Listado y detalle en /experiencias y home |
| `paquetes`     | **Sí** | Listado y detalle en /paquetes y home |
| `categorias`   | **Sí** | Filtros y home |
| `banners`      | **Sí** | Hero / home |
| `secciones`    | **Sí** | Home |
| `reservas`     | **No** (solo `request.auth != null`) | Solo panel admin |
| `consultas`    | Según tu flujo | Normalmente solo admin |

---

## Por qué solo "en BD está la experiencia de Río" no evita el error

El error no depende de cuántos documentos haya, sino de las **reglas**. Si la regla de `experiencias` exige `request.auth != null`, **cualquier** lectura (incluso de un solo documento) falla cuando la petición viene del servidor sin usuario logueado.

Con `allow read: if true` en `experiencias`, el listado y el detalle de la experiencia de Río deberían funcionar en la web pública.

---

## Si querés restringir solo a documentos "visibles"

Podés permitir lectura solo de experiencias/paquetes visibles (más seguro, mismo resultado para lo público):

```javascript
match /experiencias/{docId} {
  allow read: if resource.data.visible == true || request.auth != null;
  allow write: if request.auth != null;
}
```

Así, sin login solo se leen documentos con `visible == true`. El admin, al estar logueado, puede leer todos.
