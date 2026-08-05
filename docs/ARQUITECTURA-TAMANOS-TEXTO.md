# Arquitectura de Tamaños de Texto

## Objetivo

Este documento describe cómo está resuelta hoy la tipografía del proyecto, con foco específico en la estructura, jerarquía y precedencia de tamaños de texto.

No existe una única escala centralizada tipo `text-token-xs`, `text-token-sm`, etc. La arquitectura actual se compone de varias capas que conviven:

1. Base semántica global en `app/globals.css`.
2. Utilidades Tailwind (`text-xs`, `text-sm`, `text-base`, `text-lg`, etc.).
3. Overrides por componente con tamaños arbitrarios (`text-[9px]`, `text-[11px]`, `text-[1.55rem]`, etc.).
4. Una capa responsive especial para Home mobile mediante `.home-mobile-compact`.
5. Un comportamiento separado para scopes especiales como `admin-scope`, `.ProseMirror` y `.prose`.

---

## 1. Fundaciones tipográficas

### 1.1 Fuentes cargadas en layout

Las fuentes se inyectan desde `app/layout.tsx`:

- `brandHeading`: tipografía principal para headings. Ver `app/layout.tsx:12`.
- `manrope`: tipografía base del cuerpo. Ver `app/layout.tsx:18`.
- `berkshireSwash`: tipografía de acento/script. Ver `app/layout.tsx:24`.
- Las variables CSS se montan en `<html>` en `app/layout.tsx:138`.

### 1.2 Variables tipográficas globales

En `app/globals.css` se definen las familias:

- `--font-heading` en `app/globals.css:38`
- `--font-body` en `app/globals.css:39`
- `--font-accent` en `app/globals.css:41`
- `--font-sans` en `app/globals.css:44`

Esto genera tres familias funcionales:

- `font-heading`: títulos.
- `font-body`: texto general.
- `font-accent` / `.accent-script`: acentos editoriales o decorativos.

---

## 2. Capa base de tamaños semánticos

La primera escala real del sistema vive en `app/globals.css` y aplica por selector semántico:

- `h1` en `app/globals.css:94`
- `h2` en `app/globals.css:100`
- `h3` en `app/globals.css:106`
- `p` en `app/globals.css:112`
- `small, label` en `app/globals.css:118`
- `nav a` en `app/globals.css:125`

### 2.1 Mapeo actual

| Elemento | Tamaño base actual | Observaciones |
| --- | --- | --- |
| `h1` | `text-lg` | Mantiene el mismo tamaño en `md` y `lg` |
| `h2` | `text-lg` | Mismo comportamiento que `h1` |
| `h3` | `text-base` -> `md:text-lg` | Escala a partir de tablet |
| `p` | `text-base` | Base del cuerpo |
| `small`, `label` | `text-base` | Hoy no están reducidos respecto al cuerpo |
| `nav a` | `text-base` + `font-medium` | Base semántica de navegación |

### 2.2 Lectura arquitectónica

Esta capa funciona como baseline del sitio, pero no como source of truth absoluto. En la práctica:

- sí define una intención semántica global;
- pero muchos componentes públicos la sobreescriben con clases Tailwind específicas;
- y Home mobile la vuelve a intervenir con `!important`.

---

## 3. Capa utilitaria Tailwind

El proyecto usa mucho la escala estándar de Tailwind para texto:

| Utilidad | Valor de referencia |
| --- | --- |
| `text-xs` | 12px |
| `text-sm` | 14px |
| `text-base` | 16px |
| `text-lg` | 18px |
| `text-xl` | 20px |
| `text-2xl` | 24px |
| `text-3xl` | 30px |
| `text-4xl` | 36px |
| `text-5xl` | 48px |

Estas utilidades aparecen en muchas rutas y componentes, especialmente:

- vistas públicas generales;
- paneles `admin` y `vendor`;
- formularios reutilizables;
- landings especiales.

Ejemplo de componente base reutilizable:

- `components/ui/input.tsx:11` usa `text-sm md:text-base`.

Esto confirma que la arquitectura actual mezcla:

- una base semántica global, y
- una escala utilitaria por componente.

---

## 4. Capa de tamaños arbitrarios

Además de Tailwind estándar, el proyecto usa tamaños custom con `text-[...]`. Esta es la segunda gran fuente real de la jerarquía visual.

### 4.1 Tamaños arbitrarios detectados

Entre los tamaños más repetidos aparecen:

- `text-[9px]`
- `text-[10px]`
- `text-[11px]`
- `text-[12px]`
- `text-[13px]`
- `text-[14px]`
- `text-[15px]`
- `text-[16px]`
- `text-[24px]`
- `text-[34px]`
- `text-[38px]`
- `text-[1.55rem]`

### 4.2 Patrones por tipo de componente

#### Cards de catálogo

Se repite una micro-escala muy compacta:

- badge/meta: `9px`
- títulos internos: `11px`
- CTA pequeños: `10px`
- en `md` suelen escalar a `text-sm` o `text-xs`

Referencias:

- `components/PaqueteCard.tsx:145-261`
- `components/ExperienceCard.tsx:85-153`
- `components/CategoriaCard.tsx:72-84`

#### Buscador de Home

Usa una escala compacta y limpia:

- input principal: `text-[12px]` -> `md:text-base`
- headers del dropdown: `text-[10px]`
- resultados: `text-[12px]`
- subtítulos de resultado: `text-[11px]`
- CTA principal: `text-[12px]` -> `md:text-base`

Referencia:

- `components/HeroSearch.tsx:153-244`

#### Footer

El footer tiene una escala propia muy medida:

- eyebrow/section title: `10px` -> `11px`
- metadata legal: `11px` -> `12px`
- cuerpo/link lists: `13px` -> `14px`
- contacto destacado: `14px` -> `15px`

Referencia:

- `components/Footer.tsx:13-123`

#### Secciones editoriales premium

Hay encabezados destacados que no dependen solo de `h1/h2/h3`, sino de tamaños manuales:

- badges: `text-[10px]`
- copys secundarios: `text-[12px]`
- títulos grandes: `text-[1.55rem]` -> `md:text-5xl`

Referencias:

- `components/sections/ServicesSection.tsx:53-95`
- `components/sections/ValuesSection.tsx:56-101`

#### Sección de contacto

`ContactSplitSection` es uno de los puntos más custom del sistema:

- tags: `10px` / `11px`
- texto funcional: `11px` / `12px` / `13px` / `14px` / `16px`
- heading principal: `24px` -> `34px` -> `38px`

Referencia:

- `components/ContactSplitSection.tsx:107-268`

---

## 5. Home mobile: capa especial de compactación

La Home pública tiene una arquitectura adicional exclusiva para mobile:

- wrapper en `components/HomeClient.tsx:251`
- reglas en `app/globals.css:943-1012`

### 5.1 Qué hace `.home-mobile-compact`

Dentro de `@media (max-width: 767px)`, esta clase sobrescribe con `!important`:

- `h1`, `h2`, `h3`
- `p`, `li`
- `label`, `small`
- `input`, `select`, `textarea`, `button`
- `.badge-pluma`
- `.accent-script`
- cualquier clase que contenga `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`, `text-5xl`
- cualquier clase que contenga `text-lg`
- cualquier clase que contenga `text-base`, `text-sm`, `text-xs`

### 5.2 Resultado arquitectónico

En Home mobile, la precedencia efectiva cambia:

1. `.home-mobile-compact ... !important`
2. clases del componente (`text-[...]`, `text-base`, etc.)
3. estilos semánticos globales (`h1`, `p`, `label`, etc.)

Esto significa que un tamaño aparentemente definido dentro de un componente puede no ser el tamaño final visible si ese componente vive dentro del wrapper de Home.

---

## 6. Scopes especiales

### 6.1 Admin

El scope admin redefine comportamiento de títulos:

- `app/globals.css:133-166`

Puntos clave:

- los headings dentro de `.admin-scope` heredan fuente y color;
- el admin usa una lógica más utilitaria que editorial;
- por eso en admin predominan `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`.

### 6.2 Contenido enriquecido

Hay dos escalas independientes para contenido HTML enriquecido:

- editor: `.ProseMirror` en `app/globals.css:769+`
- frontend renderizado: `.prose` en `app/globals.css:876+`

Ejemplos:

- `.ProseMirror h1`: 2rem
- `.ProseMirror h2`: 1.5rem
- `.ProseMirror h3`: 1.25rem
- `.prose h1`: 2.25rem
- `.prose h2`: 1.875rem
- `.prose h3`: 1.5rem

Esto constituye otra sub-arquitectura tipográfica separada del resto del sitio público.

---

## 7. Regla de precedencia real

Hoy la jerarquía de decisión de tamaños puede resumirse así:

1. Scope especial con mayor especificidad o `!important`
   - ejemplo: `.home-mobile-compact`
2. Clase de componente explícita
   - ejemplo: `text-[11px]`, `md:text-sm`, `text-base`
3. Selector global semántico
   - ejemplo: `h1`, `p`, `label`
4. Herencia natural del DOM

En otras palabras: la arquitectura es híbrida, no estrictamente tokenizada.

---

## 8. Estructura actual resumida

### 8.1 Escala editorial/global

Se usa para:

- headings semánticos;
- párrafos base;
- labels;
- navegación.

Archivo principal:

- `app/globals.css`

### 8.2 Escala de componentes públicos

Se usa para:

- cards;
- footer;
- hero search;
- bloques premium;
- contacto.

Archivos representativos:

- `components/PaqueteCard.tsx`
- `components/ExperienceCard.tsx`
- `components/CategoriaCard.tsx`
- `components/HeroSearch.tsx`
- `components/Footer.tsx`
- `components/ContactSplitSection.tsx`

### 8.3 Escala mobile exclusiva de Home

Se usa para compactar agresivamente la tipografía en mobile sin afectar navbar ni footer.

Archivos:

- `components/HomeClient.tsx`
- `app/globals.css`

### 8.4 Escala funcional de Admin/Vendor

Se usa para interfaces operativas y formularios.

Predominan:

- `text-sm`
- `text-base`
- `text-lg`
- `text-xl`
- `text-2xl`

---

## 9. Riesgos actuales de mantenimiento

### 9.1 No hay una única fuente de verdad para tamaños

El tamaño final puede depender de:

- selector global;
- utilidad Tailwind;
- valor arbitrario;
- breakpoint;
- scope contextual;
- override mobile de Home.

### 9.2 Los tamaños arbitrarios están muy distribuidos

Especialmente en componentes premium y cards. Eso da control visual fino, pero baja consistencia sistémica.

### 9.3 `small` y `label` comparten `text-base`

Hoy la capa semántica global no diferencia visualmente microcopy y texto de cuerpo. Esa diferenciación se resuelve después, componente por componente.

---

## 10. Guía práctica para futuras modificaciones

### Si querés cambiar la base global

Tocar:

- `app/globals.css:94-125`

Impacta:

- headings semánticos;
- párrafos;
- labels;
- navegación.

### Si querés cambiar Home mobile

Tocar:

- `app/globals.css:943-1012`

Impacta:

- casi toda la tipografía de Home en mobile;
- incluso componentes que ya tengan `text-*`.

### Si querés ajustar cards o bloques premium

Tocar directamente el componente:

- `PaqueteCard`
- `ExperienceCard`
- `CategoriaCard`
- `HeroSearch`
- `Footer`
- `ContactSplitSection`

### Si querés cambiar contenido rich text

Tocar:

- bloque `.ProseMirror`
- bloque `.prose`

No depende de la escala general del sitio.

---

## 11. Conclusión

La arquitectura actual de tamaños de texto es funcional y visualmente muy controlada, pero híbrida.

Su estructura real es:

1. una base semántica simple;
2. una capa utilitaria Tailwind;
3. una capa de microajustes arbitrarios por componente;
4. una excepción fuerte para Home mobile;
5. subescalas separadas para Admin y rich text.

Si en el futuro se busca mayor consistencia, el siguiente paso natural sería extraer una escala tipográfica formal en tokens reutilizables. Hoy, en cambio, el sistema prioriza control visual fino por superficie.
