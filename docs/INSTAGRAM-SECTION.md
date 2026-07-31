# Sección de Instagram en la home

La sección de Instagram tiene **dos partes** que se configuran en lugares distintos.

---

## 1. Enlace "Ver más en Instagram"

El botón que lleva al perfil de Instagram usa la URL definida en **`lib/constants.ts`**:

```ts
export const SOCIAL_MEDIA = {
  // ...
  instagram: "https://www.instagram.com/el.sherpa",  // ← Cambiá el usuario acá
  // ...
};
```

**Cómo cambiarlo:** reemplazá `el.sherpa` por el usuario de Instagram que quieras (ej. `tu_cuenta_nueva`). Esa misma URL se usa en el Footer y en otros enlaces a Instagram del sitio.

---

## 2. Feed embebido (publicaciones)

Las publicaciones que se muestran en la home vienen del **widget de Elfsight** (servicio externo). La **cuenta de Instagram** que muestra el feed se configura en el panel de Elfsight, no en el código.

**Cómo cambiar la cuenta del feed:**

1. Entrá a **https://apps.elfsight.com** e iniciá sesión con la cuenta donde está creado el widget.
2. Buscá el widget de Instagram (ID del widget en el código: `3831f1a0-700e-4f5b-9429-6d1973d73ecf`).
3. En la configuración del widget, cambiá la cuenta de Instagram conectada por la nueva.
4. Si no tenés acceso a esa cuenta de Elfsight, podés crear un **widget nuevo** con la cuenta correcta en Elfsight, copiar el ID del nuevo widget y reemplazar en `components/sections/InstagramSection.tsx` la clase `elfsight-app-3831f1a0-700e-4f5b-9429-6d1973d73ecf` por la nueva (ej. `elfsight-app-NUEVO-ID`).

---

**Resumen:**  
- **Solo el enlace** → `lib/constants.ts` → `SOCIAL_MEDIA.instagram`  
- **Las publicaciones del feed** → panel de Elfsight (o nuevo widget + cambiar ID en `InstagramSection.tsx`).
