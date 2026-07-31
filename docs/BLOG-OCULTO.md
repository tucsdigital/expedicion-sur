# Blog oculto temporalmente

El blog **sigue existiendo** en el proyecto (rutas, admin, componentes y Firestore), pero está **oculto** en la interfaz para que no se muestre ni en el front público ni en el panel de administración.

Cuando quieras **volver a mostrar el blog**, descomentá los bloques indicados en los archivos listados abajo. Todos los lugares tienen un comentario que incluye `BLOG OCULTO` o `docs/BLOG-OCULTO.md` para encontrarlos rápido.

---

## Dónde está comentado

### Admin

| Archivo | Qué descomentar |
|--------|------------------|
| `components/admin/AdminLayout.tsx` | En el array `navigation`, la entrada del menú **Blog** (línea con `Newspaper`). |
| `app/admin/page.tsx` | 1) En `useState`, la propiedad `blog: 0`. 2) En `Promise.all`, la llamada `getDocs(collection(db, 'blog'))`. 3) En `setStats`, `blog: blogSnap.size`. 4) En el array de tarjetas del dashboard, el objeto `{ label: 'Blog', ... }`. 5) En la lista "Inicio rápido", el ítem `'Publicar y ordenar entradas del blog'`. 6) Volver a importar `Newspaper` de `lucide-react` si lo sacaste. |

### Front público

| Archivo | Qué descomentar |
|--------|------------------|
| `components/Navbar.tsx` | 1) Bloque del enlace **Blog** en el menú desktop (entre Paquetes y Contacto). 2) Bloque del enlace **Blog** en el menú móvil (entre Paquetes y Destinos). |
| `components/HomeClient.tsx` | 1) El import de `BlogSection`. 2) El bloque JSX de `<BlogSection ... />` (entre AboutSection y ProductsSection). |
| `lib/homeData.ts` | 1) En `Promise.all`, la variable `blogData` y la llamada `fetchVisibleOrdered<BlogPost>('blog', 4)`. 2) En el `return`, reemplazar `blogPosts: [] as BlogPost[]` por `blogPosts: blogData`. |

---

## Qué no se tocó (sigue funcionando)

- **Rutas públicas:** `/blog` y `/blog/[slug]` siguen existiendo. Si alguien tiene la URL, puede entrar.
- **Admin:** Las páginas `/admin/blog`, `/admin/blog/nuevo` y `/admin/blog/[id]` siguen existiendo. Se puede entrar por URL.
- **Firestore:** La colección `blog` no se modificó.
- **Componentes:** `BlogSection`, `BlogCard`, `BlogListClient`, `lib/blogListData.ts`, etc. no se eliminaron.
- **Banners:** La opción "Blog" en target de banners (admin) sigue disponible.

Solo se ocultaron los **enlaces y la sección** en nav, home y dashboard para que el blog no sea visible en la navegación normal.

---

## Resumen rápido para reactivar

1. **AdminLayout.tsx** → descomentar `{ name: 'Blog', href: '/admin/blog', icon: Newspaper }`.
2. **app/admin/page.tsx** → descomentar todo lo relacionado con `blog` / `blogSnap` / tarjeta Blog / ítem "Publicar y ordenar entradas del blog" y el import de `Newspaper`.
3. **Navbar.tsx** → descomentar los dos bloques del enlace "Blog" (desktop y móvil).
4. **HomeClient.tsx** → descomentar import de `BlogSection` y el bloque `<BlogSection ... />`.
5. **lib/homeData.ts** → descomentar `blogData` en `Promise.all`, la llamada a `fetchVisibleOrdered<BlogPost>('blog', 4)` y en el return usar `blogPosts: blogData`.

Después de eso, el blog vuelve a verse en el menú, en el home y en el dashboard del admin.
