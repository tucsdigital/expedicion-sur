/**
 * Plantillas HTML para emails de reserva (cliente y aviso a admin).
 * Usado desde el webhook de Stripe (checkout.session.completed).
 */

import { CONTACT_INFO } from '@/lib/constants';

const SITE_NAME = 'Expedición Sur';

type ReservaEmailData = {
  customerName: string;
  experienceTitle: string;
  dateFormatted: string;
  peopleLabel: string;
  amountFormatted: string;
  sessionId: string;
  customerEmail: string;
  customerPhone?: string;
  customerCountry?: string;
  customerComments?: string;
};

/** Email al cliente: confirmación de reserva con próximos pasos y WhatsApp. */
export function buildClienteReservaConfirmadaHtml(data: ReservaEmailData): string {
  const {
    customerName,
    experienceTitle,
    dateFormatted,
    peopleLabel,
    amountFormatted,
    sessionId,
  } = data;
  const saludo = customerName ? `Hola ${customerName},` : 'Hola,';
  const whatsappUrl = `https://wa.me/${CONTACT_INFO.whatsapp}?text=${encodeURIComponent(
    `Hola, acabo de confirmar mi reserva para ${experienceTitle}. Fecha: ${dateFormatted}. ${peopleLabel}. ¿Próximos pasos?`
  )}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reserva confirmada</title>
</head>
<body style="margin:0; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; background:#f3f4f6; padding: 24px;">
  <div style="max-width: 520px; margin: 0 auto; background:#fff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden;">
    <div style="padding: 32px 28px;">
      <h1 style="margin:0 0 8px; font-size: 1.625rem; font-weight: 700; color: #111827;">¡Reserva confirmada!</h1>
      <p style="margin:0 0 24px; font-size: 1rem; color: #4b5563;">${saludo}</p>
      <p style="margin:0 0 24px; font-size: 0.9375rem; color: #374151; line-height: 1.6;">Tu pago se procesó correctamente. Guardá este email como comprobante. A continuación, el detalle de tu reserva y qué hacer a partir de ahora.</p>

      <div style="background:#f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin:0 0 12px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">Resumen de tu reserva</p>
        <table style="width:100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-size: 0.875rem; color: #6b7280;">Experiencia</td><td style="padding: 8px 0; font-size: 0.875rem; font-weight: 600; color: #111827; text-align: right;">${experienceTitle}</td></tr>
          <tr><td style="padding: 8px 0; font-size: 0.875rem; color: #6b7280;">Fecha</td><td style="padding: 8px 0; font-size: 0.875rem; font-weight: 500; color: #111827; text-align: right; text-transform: capitalize;">${dateFormatted}</td></tr>
          <tr><td style="padding: 8px 0; font-size: 0.875rem; color: #6b7280;">Personas</td><td style="padding: 8px 0; font-size: 0.875rem; font-weight: 500; color: #111827; text-align: right;">${peopleLabel}</td></tr>
          <tr><td style="padding: 8px 0; font-size: 0.875rem; color: #6b7280;">Monto abonado</td><td style="padding: 8px 0; font-size: 0.875rem; font-weight: 600; color: #111827; text-align: right;">${amountFormatted}</td></tr>
        </table>
        <p style="margin: 12px 0 0; font-size: 0.75rem; color: #9ca3af;">Referencia de pago: ${sessionId}</p>
      </div>

      <p style="margin:0 0 12px; font-size: 0.875rem; font-weight: 600; color: #111827;">¿Qué sigue?</p>
      <ul style="margin:0 0 24px; padding-left: 20px; font-size: 0.9375rem; color: #374151; line-height: 1.6;">
        <li style="margin-bottom: 8px;">Te contactaremos por este email o por WhatsApp para coordinar horarios y detalles del encuentro.</li>
        <li style="margin-bottom: 8px;">Si tenés dudas o querés adelantar algo, escribinos por WhatsApp. Estamos para ayudarte.</li>
      </ul>

      <p style="margin:0 0 20px; font-size: 0.9375rem; color: #374151; line-height: 1.5;">Cualquier consulta, respondé a este email o <a href="${whatsappUrl}" style="color: #059669; font-weight: 600;">escribinos por WhatsApp</a>.</p>
      <p style="margin: 0; font-size: 0.875rem; color: #6b7280;">— ${SITE_NAME}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function buildClienteReservaConfirmadaText(data: ReservaEmailData): string {
  const { customerName, experienceTitle, dateFormatted, peopleLabel, amountFormatted, sessionId } = data;
  const saludo = customerName ? `Hola ${customerName},` : 'Hola,';
  const whatsappUrl = `https://wa.me/${CONTACT_INFO.whatsapp}?text=${encodeURIComponent(
    `Hola, acabo de confirmar mi reserva para ${experienceTitle}. Fecha: ${dateFormatted}. ${peopleLabel}. ¿Próximos pasos?`
  )}`;
  return [
    '¡Reserva confirmada!',
    '',
    saludo,
    '',
    'Tu pago se procesó correctamente. Guardá este email como comprobante.',
    '',
    'Resumen de tu reserva',
    `- Experiencia: ${experienceTitle}`,
    `- Fecha: ${dateFormatted}`,
    `- Personas: ${peopleLabel}`,
    `- Monto abonado: ${amountFormatted}`,
    `- Referencia de pago: ${sessionId}`,
    '',
    '¿Qué sigue?',
    '- Te contactaremos por este email o por WhatsApp para coordinar horarios y detalles del encuentro.',
    '- Si tenés dudas o querés adelantar algo, escribinos por WhatsApp.',
    '',
    `WhatsApp: ${whatsappUrl}`,
    '',
    `— ${SITE_NAME}`,
  ].join('\n');
}

/** Email al admin: aviso de nueva reserva con todos los datos del cliente. */
export function buildAdminNuevaReservaHtml(data: ReservaEmailData): string {
  const {
    customerName,
    customerEmail,
    customerPhone,
    customerCountry,
    customerComments,
    experienceTitle,
    dateFormatted,
    peopleLabel,
    amountFormatted,
    sessionId,
  } = data;

  const rows: string[] = [
    `<tr><td style="padding: 10px 14px; font-size: 0.875rem; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Experiencia</td><td style="padding: 10px 14px; font-size: 0.875rem; font-weight: 600; color: #111827;">${experienceTitle}</td></tr>`,
    `<tr><td style="padding: 10px 14px; font-size: 0.875rem; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Fecha</td><td style="padding: 10px 14px; font-size: 0.875rem; color: #111827; text-transform: capitalize;">${dateFormatted}</td></tr>`,
    `<tr><td style="padding: 10px 14px; font-size: 0.875rem; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Personas</td><td style="padding: 10px 14px; font-size: 0.875rem; color: #111827;">${peopleLabel}</td></tr>`,
    `<tr><td style="padding: 10px 14px; font-size: 0.875rem; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Monto</td><td style="padding: 10px 14px; font-size: 0.875rem; font-weight: 600; color: #111827;">${amountFormatted}</td></tr>`,
    `<tr><td style="padding: 10px 14px; font-size: 0.875rem; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Cliente</td><td style="padding: 10px 14px; font-size: 0.875rem; color: #111827;">${customerName || '—'}</td></tr>`,
    `<tr><td style="padding: 10px 14px; font-size: 0.875rem; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Email</td><td style="padding: 10px 14px; font-size: 0.875rem; color: #111827;">${customerEmail}</td></tr>`,
  ];
  if (customerPhone) {
    rows.push(`<tr><td style="padding: 10px 14px; font-size: 0.875rem; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Teléfono</td><td style="padding: 10px 14px; font-size: 0.875rem; color: #111827;">${customerPhone}</td></tr>`);
  }
  if (customerCountry) {
    rows.push(`<tr><td style="padding: 10px 14px; font-size: 0.875rem; color: #6b7280; border-bottom: 1px solid #e5e7eb;">País</td><td style="padding: 10px 14px; font-size: 0.875rem; color: #111827;">${customerCountry}</td></tr>`);
  }
  rows.push(`<tr><td style="padding: 10px 14px; font-size: 0.875rem; color: #6b7280;">Ref. Stripe</td><td style="padding: 10px 14px; font-size: 0.75rem; color: #6b7280;">${sessionId}</td></tr>`);

  const comentariosBlock = customerComments
    ? `<p style="margin: 16px 0 0; font-size: 0.875rem; color: #374151;"><strong>Comentarios del cliente:</strong><br>${customerComments}</p>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nueva reserva</title>
</head>
<body style="margin:0; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; background:#f3f4f6; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background:#fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden;">
    <div style="padding: 24px;">
      <h1 style="margin:0 0 8px; font-size: 1.25rem; font-weight: 700; color: #111827;">Nueva reserva recibida</h1>
      <p style="margin:0 0 20px; font-size: 0.9375rem; color: #4b5563;">Se completó un pago y se registró la siguiente reserva.</p>
      <table style="width:100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        ${rows.join('')}
      </table>
      ${comentariosBlock}
      <p style="margin: 20px 0 0; font-size: 0.8125rem; color: #9ca3af;">Este email fue enviado automáticamente por el sistema de reservas.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function buildAdminNuevaReservaText(data: ReservaEmailData): string {
  const {
    customerName,
    customerEmail,
    customerPhone,
    customerCountry,
    customerComments,
    experienceTitle,
    dateFormatted,
    peopleLabel,
    amountFormatted,
    sessionId,
  } = data;
  const lines: string[] = [
    'Nueva reserva recibida',
    '',
    `Experiencia: ${experienceTitle}`,
    `Fecha: ${dateFormatted}`,
    `Personas: ${peopleLabel}`,
    `Monto: ${amountFormatted}`,
    '',
    `Cliente: ${customerName || '—'}`,
    `Email: ${customerEmail}`,
  ];
  if (customerPhone) lines.push(`Teléfono: ${customerPhone}`);
  if (customerCountry) lines.push(`País: ${customerCountry}`);
  if (customerComments) {
    lines.push('', 'Comentarios del cliente:', customerComments);
  }
  lines.push('', `Ref. Stripe: ${sessionId}`);
  return lines.join('\n');
}
