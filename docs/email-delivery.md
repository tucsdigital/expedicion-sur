# Configurar y verificar el envío de emails

## Variables de Vercel

En **Vercel → Project → Settings → Environment Variables**, agregá estas variables al entorno **Production** (y también a Preview si querés probar desde previews):

- `RESEND_API_KEY`: API key activa de Resend.
- `RESEND_FROM_EMAIL`: remitente de un dominio verificado en Resend, por ejemplo `Reservas <reservas@tudominio.com>`. No uses `onboarding@resend.dev` para destinatarios reales.
- `SALES_NOTIFICATION_EMAIL`: destinatario de los avisos internos de nuevas ventas. Si no se configura, se conserva como fallback el email de contacto público actual.
- `CRON_SECRET`: secreto largo y aleatorio para autenticar el cron.
- `NEXT_PUBLIC_SITE_URL`: URL pública de la aplicación, sin `/` final.

En Resend, comprobá que el dominio remitente figure como verificado y que sus registros DNS estén publicados. Después de cambiar variables de Vercel, hacé un redeploy para que las funciones usen los valores nuevos. Los avisos internos pendientes también usan el `SALES_NOTIFICATION_EMAIL` vigente al momento del envío.

## Configurar GitHub Actions

El workflow `.github/workflows/cron-emails.yml` corre cada cinco minutos y también admite ejecución manual. En el repositorio de GitHub:

1. Abrí **Settings → Secrets and variables → Actions → New repository secret**.
2. Creá `APP_URL` con la URL base de producción, por ejemplo `https://tu-dominio.com` (sin `/` final).
3. Creá `CRON_SECRET` con exactamente el mismo valor que `CRON_SECRET` en Vercel Production. No agregues comillas ni espacios.
4. Confirmá que **Actions** esté habilitado y que el workflow esté presente en la rama por defecto. Los eventos programados de GitHub se ejecutan desde esa rama.
5. Abrí **Actions → Cron - Emails → Run workflow** para la primera ejecución manual. Luego revisá que las ejecuciones programadas terminen en verde.

Si guardás los secrets bajo un Environment de GitHub en lugar de **Repository secrets**, el job debe declarar ese Environment para poder leerlos. Esta configuración usa repository secrets.

## Prueba controlada

Usá un email propio o una dirección de prueba autorizada en Resend. El endpoint responde con conteos `processed`, `sent` y `failed`; un `401` normalmente indica que `CRON_SECRET` falta o no coincide, y un `500` incluye el error de configuración o procesamiento.

```sh
curl --fail-with-body --silent --show-error \
  "${APP_URL%/}/api/cron/email" \
  -H "Authorization: Bearer $CRON_SECRET"
```

También existe `/api/debug/email-test?to=TU_EMAIL_DE_PRUEBA`, que envía un email real directamente a través de Resend y requiere el mismo header `Authorization: Bearer ...`. No incluyas el secreto en la URL ni compartas su valor.

En Firestore, `emailJobs` muestra el estado de cada envío (`pending`, `sending`, `sent` o `failed`) y `lastError`. La ficha de una venta muestra los estados y permite reenviar la confirmación, el voucher o el aviso interno. `sent` confirma que Resend aceptó el mensaje; para conocer entrega, rebote o spam, revisá el registro del mensaje en Resend.
