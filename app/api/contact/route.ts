import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { resend, getFromEmail, isResendConfigured } from '@/lib/resend';
import { CONTACT_INFO, SITE_NAME } from '@/lib/constants';
import { db, firebaseEnabled } from '@/lib/firebase';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  whatsapp: z.string().min(6),
  interest: z.string().min(2),
  travelDate: z.string().optional().default(''),
  travelers: z.string().optional().default(''),
  message: z.string().min(10),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());

    if (firebaseEnabled) {
      await addDoc(collection(db, 'consultas'), {
        nombre: payload.name,
        email: payload.email,
        telefono: payload.whatsapp,
        whatsapp: payload.whatsapp,
        servicio: payload.interest,
        fechas: payload.travelDate,
        cantidadPersonas: payload.travelers,
        mensaje: payload.message,
        canal: 'web-expedicion-sur',
        fechaCreacion: Timestamp.now(),
        leida: false,
      });
    }

    if (isResendConfigured() && resend) {
      const from = getFromEmail(true);
      const replyTo = payload.email;
      const subject = `Nueva consulta web - ${payload.interest}`;

      await resend.emails.send({
        from,
        to: CONTACT_INFO.email,
        replyTo,
        subject,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;color:#111111;line-height:1.6">
            <h2 style="margin:0 0 16px;">Nueva consulta desde la web de ${SITE_NAME}</h2>
            <p><strong>Nombre:</strong> ${payload.name}</p>
            <p><strong>Email:</strong> ${payload.email}</p>
            <p><strong>WhatsApp:</strong> ${payload.whatsapp}</p>
            <p><strong>Interes:</strong> ${payload.interest}</p>
            <p><strong>Fecha estimada:</strong> ${payload.travelDate || 'No indicada'}</p>
            <p><strong>Pasajeros:</strong> ${payload.travelers || 'No indicado'}</p>
            <p><strong>Mensaje:</strong></p>
            <p>${payload.message.replace(/\n/g, '<br />')}</p>
          </div>
        `,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/contact] Error procesando consulta:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'No pudimos procesar tu consulta en este momento.',
      },
      { status: 500 }
    );
  }
}
