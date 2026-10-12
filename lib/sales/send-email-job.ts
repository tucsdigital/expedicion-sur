import { Timestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getFromEmail, isResendConfigured, resend } from '@/lib/resend';
import { buildEmailDeliveryState, emailDeliveryPathForJobType } from '@/lib/sales/email-jobs';

export type SendEmailJobResult =
  | { ok: true; jobId: string; providerMessageId: string | null }
  | { ok: false; jobId: string; error: string; status: number };

/** Envía un emailJob por Resend en el momento (sin esperar al cron) y actualiza job + reserva. */
export async function sendEmailJobNow(jobId: string): Promise<SendEmailJobResult> {
  const jobRef = doc(db, 'emailJobs', jobId);
  const snap = await getDoc(jobRef).catch(() => null);
  if (!snap?.exists()) return { ok: false, jobId, error: 'Job no encontrado', status: 404 };
  const job = snap.data() as any;

  if (!isResendConfigured() || !resend) {
    return { ok: false, jobId, error: 'Resend no configurado (falta RESEND_API_KEY)', status: 500 };
  }
  if (!job?.to || !job?.subject || !job?.html) {
    return { ok: false, jobId, error: 'Job incompleto (to/subject/html)', status: 400 };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: String(job.from ?? getFromEmail()),
      to: String(job.to),
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
