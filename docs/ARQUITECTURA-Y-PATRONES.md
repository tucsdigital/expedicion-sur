# Arquitectura y patrones del proyecto

Documentación de cómo se manejan **transiciones de página**, **navegación**, **datos de Firestore** y otros patrones en este proyecto, para reutilizar o adaptar en proyectos similares sin copiar estos cambios tal cual.

---

## 1. Transiciones de página

### Ubicación y uso

- **Componente:** `components/PageTransition.tsx`
- **Uso:** Envuelve todo el contenido de la app en el layout raíz (`app/layout.tsx`).

### Comportamiento

- **Framer Motion:** Se usa `motion.div` con `key={pathname}` para que cada ruta tenga su propia instancia y se anime al cambiar.
- **Animación:** Solo entrada: `initial={{ opacity: 0 }}` → `animate={{ opacity: 1 }}`, duración 0,2 s, ease `easeOut`.
- **Sin AnimatePresence:** Se evita `AnimatePresence mode="wait"` porque en App Router puede dejar pantalla en blanco al navegar. Aquí solo se anima la entrada del nuevo contenido.

### Código de referencia

```tsx
// app/layout.tsx
<main id="main-content" className="relative z-0">
  <PageTransition>{children}</PageTransition>
</main>

// components/PageTransition.tsx
const pathname = usePathname();
return (
  <motion.div
    key={pathname}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.2, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);
```

### Para otro proyecto

- Si no querés transiciones: no uses `PageTransition` y renderizá `{children}` directamente en el layout.
- Si querés transiciones más complejas: podés usar `AnimatePresence` con cuidado o animar salida/entrada con `key={pathname}` y estados de layout.

---

## 2. Navegación

### Stack

- **Next.js App Router** (`app/`).
- **Links:** `next/link` (`Link`) para navegación interna.
- **Router:** `useRouter()` de `next/navigation` para `push`, `replace`, `refresh`.

### Patrones usados

| Caso | Uso |
|------|-----|
| Enlaces en nav/footer | `<Link href="/ruta">Texto</Link>` |
| Redirección tras login/acción | `router.push('/admin')` o `router.replace('/admin/login')` |
| Refrescar datos del servidor | `router.refresh()` (ej. en `HomeClient` al montar) |
| Páginas que deben redirigir | `router.replace('/')` en `useEffect` (ej. `/login`, `/registro`, `/user`) |

### Navbar y portal

- **Componente:** `components/Navbar.tsx` (client).
- **Portal:** El navbar se renderiza con `createPortal(navContent, document.body)` para que quede fuera del árbol de la página y siempre encima (z-index, stacking).
- **Rutas:** Cada página que muestra navbar lo incluye como hijo (ej. `HomeClient`, `experiencias/page.tsx`, `paquetes/page.tsx`). No está en el layout global para poder usar props distintas por ruta (`transparent`, `theme="rio"`).

### Estructura de rutas relevantes

```
app/
  page.tsx              → Home (Server Component, pasa datos a HomeClient)
  layout.tsx            → Layout raíz + PageTransition + Toaster
  experiencias/
    page.tsx            → Listado (Server Component)
    [slug]/page.tsx     → Detalle experiencia (Client Component, fetch en useEffect)
  paquetes/page.tsx
  paquete/[slug]/page.tsx   → Listado (Server Component)
  blog/page.tsx, blog/[slug]/page.tsx  → Detalle experiencia (Client Component, fetch en useEffect)
  admin/
    layout.tsx          → Solo estilos (Poppins)
    page.tsx            → Dashboard (Client, envuelto en ProtectedRoute + AdminLayout)
    login/page.tsx
    experiencias/[id]/page.tsx, nuevo/page.tsx
    ...
```

### Para otro proyecto

- Mantener `Link` para todo lo interno y `useRouter` para redirecciones y `refresh`.
- Si el navbar es común a todas las páginas, se puede mover al layout y usar un solo `<Navbar />` sin portal; el portal solo es necesario si se busca un z-index muy alto o evitar que el layout corte el navbar.

---

## 3. Uso de Firestore

### Inicialización

- **Archivo:** `lib/firebase.ts`
- **Firestore:** Se inicializa una sola vez con `getFirestore(app)` y se exporta `db`.
- **Auth:** Se usa lazy loading (`getAuthInstance()`) para no cargar Auth en páginas que no lo usan (solo admin).

### Serialización de datos

- **Archivo:** `lib/utils/serialize.ts`
- **Función:** `serializeFirestoreData<T>(data)` convierte documentos de Firestore a datos serializables (por ejemplo `Timestamp` → ISO string) para poder pasarlos desde Server Components a clientes y evitar errores de hidratación.

### Capas de datos por dominio

Cada dominio tiene un módulo en `lib/` que centraliza lecturas/escrituras:

| Archivo | Responsabilidad |
|---------|------------------|
| `lib/experiencias.ts` | CRUD experiencias, `getExperiencias`, `getExperienciaBySlug`, `getExperienciaById`, `toBookingPublicData` |
| `lib/homeData.ts` | Datos de la home: paquetes, banners, secciones, experiencias (usa `getExperiencias`) |
| `lib/blogListData.ts` | Posts y banners para /blog |
| `lib/reservas.ts` | Reservas (listado, por experiencia/fecha, etc.) |

Patrones recurrentes en estos módulos:

- **Queries:** `query(collection(db, 'nombre'), where(...), orderBy(...), limit(...))`.
- **Fallback:** Si falla una query con `orderBy` (p. ej. por índices), se hace `getDocs(collection)` y se ordena/filtra en memoria.
- **Escritura:** `addDoc` / `updateDoc` con payloads sin `undefined` (función `stripUndefined` en experiencias).
- **Tipado:** Los datos se mapean con `serializeFirestoreData<T>({ id: doc.id, ...doc.data() })`.

### Dónde se lee Firestore

- **Server Components (páginas):** En `app/page.tsx`, `app/experiencias/page.tsx`, etc. Se llaman funciones async del tipo `getHomeData()`, `getExperiencias()`, que dentro usan `getDocs`/`getDoc` y `serializeFirestoreData`. No se usa el SDK de Firebase en el cliente para esas rutas.
- **Client Components (páginas dinámicas):** En `app/experiencias/[slug]/page.tsx` se usa `getExperienciaBySlug(slug)` dentro de `useEffect` (porque la página es client). Los datos se cargan en el cliente y se pasan a `LandingReservaPage`.
- **Admin:** Las pantallas de admin son Client Components; llaman a `getExperienciaById`, `getDocs`, etc. desde el navegador.

### Para otro proyecto

- Mantener un solo `db` en `lib/firebase.ts` y, si hay Server Components que lean Firestore, usar siempre `serializeFirestoreData` antes de pasar datos a hijos.
- Centralizar por entidad (ej. `lib/experiencias.ts`) y exponer funciones `get*`, `create*`, `update*` que usen `db` y `serializeFirestoreData` donde haga falta.

---

## 4. Caché y revalidación (Next.js)

### Desactivar caché en páginas con datos editables

En las páginas que muestran datos que se editan en el admin se usa:

```ts
export const revalidate = 0;
```

Así Next.js no cachea la página y siempre pide datos frescos al servidor (que a su vez lee Firestore en el request).

Ejemplos: `app/page.tsx`, `app/experiencias/page.tsx`, `app/paquetes/page.tsx`, `app/blog/page.tsx`, etc.

### Invalidar caché tras guardar en el admin

- **Archivo:** `lib/revalidate.ts`
- **Función:** `revalidateFrontPaths(paths: string[])` — Server Action que llama a `revalidatePath(path)` por cada ruta.

Tras crear/actualizar contenido en el admin (experiencias, paquetes, blog, categorías, secciones, banners) se llama a `revalidateFrontPaths` con las rutas afectadas para que la próxima visita o el próximo `refresh` muestre datos actualizados.

Ejemplos:

- Al guardar experiencia: `revalidateFrontPaths(['/experiencias', `/experiencias/${slug}`])`
- Al guardar banners: `revalidateFrontPaths(['/'])`
- Al guardar categoría: `revalidateFrontPaths(['/paquetes', `/categoria/${slug}`])`

### Para otro proyecto

- Si no usás admin que edite contenido en tiempo real, podés usar `revalidate = 60` (o el número que quieras) en lugar de `0`.
- Si tenés admin, mantener un `revalidateFrontPaths` (o equivalente con `revalidatePath`/`revalidateTag`) y llamarlo después de cada guardado relevante.

---

## 5. Patrones de páginas

### Página con datos del servidor (Server Component)

```tsx
// app/experiencias/page.tsx
export const revalidate = 0;

export default async function ExperienciasPage() {
  const experiencias = await getExperiencias({ visibleOnly: true });
  return (
    <>
      <Navbar theme="rio" />
      <ExperienciasClient experiencias={experiencias} />
    </>
  );
}
```

El componente async hace el fetch; pasa los datos a un Client Component que solo renderiza e interactúa.

### Página dinámica que necesita cliente (Client Component)

```tsx
// app/experiencias/[slug]/page.tsx
'use client';
// ...
const [experience, setExperience] = useState<Experience | null | undefined>(undefined);

useEffect(() => {
  getExperienciaBySlug(slug).then((data) => setExperience(data ?? null));
  // Opcional: refrescar al volver a la pestaña
  const onVisibility = () => { if (document.visibilityState === 'visible') fetchExp(); };
  document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
}, [slug]);

if (experience === undefined) return <Loader />;
if (experience === null) notFound();
return <LandingReservaPage experienceProp={experience} />;
```

Aquí el fetch es en cliente porque la página es client; en otro proyecto podría hacerse la misma lectura en un Server Component con `params` y pasar la experiencia como prop para evitar ese fetch en cliente.

### Home: datos agregados en el servidor

- **Archivo:** `lib/homeData.ts` — `getHomeData()` hace en paralelo `getDocs` de varias colecciones y arma paquetes, banners, secciones, experiencias.
- **Página:** `app/page.tsx` (Server Component) llama `getHomeData()` y pasa el resultado a `HomeClient`.
- **HomeClient:** Opcionalmente llama `router.refresh()` en `useEffect` para refrescar datos al montar.

---

## 6. Admin y rutas protegidas

- **Protección:** No hay un layout que envuelva todas las rutas de admin; cada página de admin que debe estar protegida se envuelve en `<ProtectedRoute>` (y suele usar también `<AdminLayout>`).
- **ProtectedRoute:** `components/admin/ProtectedRoute.tsx` — usa `useAuth()` y, si no hay usuario (y no está cargando), hace `router.replace('/admin/login')`. También puede validar dominio con `validateAdminDomain()`.
- **Login:** `app/admin/login/page.tsx` — tras login exitoso hace `router.push('/admin')`.

Para otro proyecto se puede optar por un layout `app/admin/layout.tsx` que renderice `<ProtectedRoute><AdminLayout>{children}</AdminLayout></ProtectedRoute>` y así no repetir la protección en cada página.

---

## 7. Resumen rápido para otro proyecto “parecido pero sin estos cambios”

| Tema | En este proyecto | Para reutilizar / variar |
|------|-------------------|---------------------------|
| Transiciones | PageTransition con Framer Motion por `pathname` | Quitar si no querés; o cambiar duración/animación. |
| Navegación | Link + useRouter (push/replace/refresh) | Igual; navbar opcional en layout o por página. |
| Firestore | `db` en `lib/firebase.ts`, `serializeFirestoreData` en `lib/utils/serialize.ts`, módulos por entidad en `lib/` | Misma estructura; adaptar colecciones y tipos. |
| Caché | `revalidate = 0` en páginas con datos editables | Cambiar a un número si no necesitás siempre datos frescos. |
| Revalidación | `revalidateFrontPaths` después de guardar en admin | Mantener si tenés admin; si no, no hace falta. |
| Datos en páginas | Server Components que llaman a `get*` de `lib/` y pasan a clientes | Mismo patrón; dinámicas pueden ser Server con `params` si no necesitás client. |
| Admin | ProtectedRoute por página, Auth lazy | Opcional: layout único con ProtectedRoute. |

Este documento describe el estado actual del proyecto; en otro “muy parecido” podés tomar solo los patrones que te sirvan (navegación, Firestore, revalidación) y omitir o simplificar transiciones, portal del navbar, etc.
