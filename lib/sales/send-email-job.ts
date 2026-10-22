import { Timestamp, doc, getDoc, runTransaction, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getEmailJobFrom, getFromEmail, isResendConfigured, resend, resendConfigurationError } from '@/lib/resend';
import { buildEmailDeliveryState, emailDeliveryPathForJobType } from '@/lib/sales/email-jobs';
import { getSalesNotificationEmail } from '@/lib/sales/email-config';

export type SendEmailJobResult =
  | { ok: true; jobId: string; providerMessageId: string | null }
  | { ok: false; jobId: string; error: string; status: number };

/** Envía un emailJob por Resend en el momento (sin esperar al cron) y actualiza job + reserva. */
export async function sendEmailJobNow(jobId: string): Promise<SendEmailJobResult> {
  const jobRef = doc(db, 'emailJobs', jobId);
  const snap = await getDoc(jobRef).catch(() => null);
  if (!snap?.exists()) return { ok: false, jobId, error: 'Job no encontrado', status: 404 };

  if (!isResendConfigured() || !resend) {
    return { ok: false, jobId, error: resendConfigurationError() ?? 'Resend no configurado', status: 500 };
  }
  if (!snap.data()?.to || !snap.data()?.subject || !snap.data()?.html) {
    return { ok: false, jobId, error: 'Job incompleto (to/subject/html)', status: 400 };
  }

  let job: any;
  try {
    job = await runTransaction(db, async (tx) => {
      const current = await tx.get(jobRef);
      if (!current.exists()) return null;
      const data = current.data() as any;
      if (data.status !== 'pending' && data.status !== 'failed') return null;
      const now = Timestamp.now();
      tx.update(jobRef, { status: 'sending', updatedAt: now });
      if (data.reservationId && data.type) {
        tx.update(doc(db, 'reservas', String(data.reservationId)), {
          [emailDeliveryPathForJobType(data.type)]: buildEmailDeliveryState({
            status: 'sending',
            now,
            jobId,
            provider: 'resend',
          }),
          updatedAt: now,
        });
      }
      return data;
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, jobId, error: detail, status: 502 };
  }
  if (!job) {
    return { ok: false, jobId, error: 'El email ya está en proceso o no está pendiente.', status: 409 };
  }

  try {
    const from = getEmailJobFrom(job.from || getFromEmail());
    if (!from) throw new Error('Falta RESEND_FROM_EMAIL; configurá un remitente de un dominio verificado en Resend.');
    const to = job.type === 'admin_aviso'
      ? getSalesNotificationEmail() || String(job.to)
      : String(job.to);
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: String(job.subject),
      html: String(job.html),
      text: job.text ? String(job.text) : undefined,
      replyTo: job.replyTo ? String(job.replyTo) : undefined,
    });
    if (error) throw new Error(typeof error === 'string' ? error : JSON.stringify(error));

    const now = Timestamp.now();
    const providerMessageId = (data as any)?.id ?? null;
    await updateDoc(jobRef, {
      status: 'sent',
      attempts: Number(job.attempts ?? 0) + 1,
      lastError: null,
      sentAt: now,
      providerMessageId,
      updatedAt: now,
    }).catch(() => null);
    if (job.reservationId && job.type) {
      await updateDoc(doc(db, 'reservas', String(job.reservationId)), {
        [emailDeliveryPathForJobType(job.type)]: buildEmailDeliveryState({
          status: 'sent',
          now,
          jobId,
          provider: 'resend',
          providerMessageId,
        }),
        ...(job.type === 'cliente_voucher_48hs' || job.type === 'cliente_confirmacion'
          ? { voucherSent: true, voucherSentAt: now }
          : {}),
        updatedAt: now,
      }).catch(() => null);
    }
    return { ok: true, jobId, providerMessageId };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const now = Timestamp.now();
    await updateDoc(jobRef, {
      status: 'failed',
      attempts: Number(job.attempts ?? 0) + 1,
      lastError: detail,
      nextAttemptAt: Timestamp.fromMillis(Date.now()),
      updatedAt: now,
    }).catch(() => null);
    if (job.reservationId && job.type) {
      await updateDoc(doc(db, 'reservas', String(job.reservationId)), {
        [emailDeliveryPathForJobType(job.type)]: buildEmailDeliveryState({
          status: 'failed',
          now,
          jobId,
          provider: 'resend',
          error: detail,
        }),
        updatedAt: now,
      }).catch(() => null);
    }
    return { ok: false, jobId, error: detail, status: 502 };
  }
}
