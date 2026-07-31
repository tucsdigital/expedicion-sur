# Manejo de comprobantes y stock inteligente

## Limpieza automática de medios

- `/api/upload`: expone `POST` para subir archivos al Blob y `DELETE` para eliminarlos con el token `BLOB_READ_WRITE_TOKEN`.
- En cada sección del panel admin que carga imágenes (experiencias, banners, paquetes, blog, categorías, stock y reservas) se debe guardar tanto la URL como la `key` retornada por `/api/upload`. Así se puede invocar `DELETE /api/upload` antes de eliminar la referencia en Firestore y evitar archivos huérfanos.
- Cuando el admin elimina un comprobante desde el detalle (`/admin/reservas/[id]`) o cualquiera de los formularios administrativos, el backend borra el blob y actualiza la colección correspondiente vía `PATCH`/`PUT` (e.g. `experiencias`, `banners`, `paquetes`, `blog`).

### Experiencias
- `app/admin/experiencias/[id]/page.tsx`, `app/admin/experiencias/nuevo/page.tsx` y los formularios de edición usan `ImageUploader` para guardar tanto la `url` como la `key`. Siempre que se elimina o se reemplaza la imagen de una experiencia se debe disparar `DELETE /api/upload` con esa `key` antes de hacer el `PATCH`/`PUT` en Firestore.

### Categorías
- Las categorías del panel admin cargan miniaturas iguales y tienen que almacenar `url` y `key`. Antes de borrar o cambiar la imagen asociada en la colección `categorias`, se invoca `DELETE /api/upload` con la `key` correspondiente para evitar blobs huérfanos.

### Paquetes
- Los paquetes (`app/admin/paquetes/...`) usan imágenes destacadas que también requieren el mismo flujo: guardar la `key` que devuelve `/api/upload` y eliminar el blob antes de actualizar o borrar el documento en `paquetes`.

### Banners
- Cada banner del sitio utiliza cargas blob. Guardá la `key` retornada por `/api/upload` y ejecutá `DELETE /api/upload` al eliminar o reemplazar un banner antes de modificar la colección `banners`.

## Stock como inventario accionable

- Se introdujo la colección `stockMovimientos` con campos esenciales (`experienceId`, `date`, `type`, `quantity`, `author`, `referenceId`, `note`). Cada creación, cancelación o ajuste queda registrado allí.
- `lib/stock.ts` centraliza las funciones `registrarMovimientoStock`, `getMovimientosStock` y `getStockDisponible`.
- El endpoint `/api/admin/stock` permite consultar stock (base, disponible y movimientos) y crear entradas/salidas/ajustes de forma segura.

## UI y flujo de control

- `app/admin/stock/page.tsx` muestra un panel completo para seleccionar experiencia/fecha, ver el stock actual, registrar movimientos manuales y revisar el historial reciente.
- `/admin/reservas/[id]` presenta el stock asociado, permite subir/quitar comprobantes y cancelar reservas para liberar cupos, con registros automáticos en `stockMovimientos`.
- Las reservas generadas vía Stripe y el panel admin descuentan cupos con tipo `reserva` y, al cancelarse, se crea un movimiento de tipo `entrada`.

## Notas operativas

- Asegurate de que `BLOB_READ_WRITE_TOKEN` esté presente en `.env` o en el entorno de producción para que la eliminación de blobs funcione correctamente.
- El stock ahora se comporta como inventario real: las cancelaciones reponen y los ajustes o reservas descuentan de forma trazable.
