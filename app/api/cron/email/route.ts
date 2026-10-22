import { NextResponse } from 'next/server';
import { resend, getEmailJobFrom, isResendConfigured, resendConfigurationError } from '@/lib/resend';
import { db } from '@/lib/firebase';
import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit as firestoreLimit,
  orderBy as firestoreOrderBy,
  query,
  runTransaction,
  where,
  updateDoc,
} from 'firebase/firestore';
import {
  buildEmailDeliveryState,
  emailDeliveryPathForJobType,
  isEmailJobEligibleForProcessing,
  type VentaEmailJobType,
} from '@/lib/sales/email-jobs';
import { getSalesNotificationEmail } from '@/lib/sales/email-config';

export const runtime = 'nodejs';

type EmailJobStatus = 'pending' | 'sending' | 'sent' | 'failed';
type EmailJob = {
  type: VentaEmailJobType;
  status: EmailJobStatus;
  to: string;
  from: string | null;
  replyTo?: string | null;
  subject: string;
  html: string | null;
  text?: string | null;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: object;
  updatedAt?: object;
  reservationId?: string;
};

function getCronSecret(): string | null {
  return process.env.CRON_SECRET ?? null;
}

function isAuthorized(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

function backoffSeconds(attempt: number): number {
  // 1m, 2m, 4m, 8m, ... max 60m
  const seconds = Math.min(60 * 60, Math.pow(2, Math.max(0, attempt)) * 60);
  return seconds;
}

async function fetchPendingJobs(batchSize: number): Promise<{ id: string; data: EmailJob }[]> {
  const col = collection(db, 'emailJobs');
  const now = Timestamp.now();

  // Preferir query eficiente; fallback si faltan índices.
  try {
    const q = query(
      col,
      where('status', 'in', ['pending', 'failed', 'sending']),
      where('nextAttemptAt', '<=', now),
      firestoreOrderBy('nextAttemptAt', 'asc'),
      firestoreLimit(batchSize)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, data: d.data() as EmailJob }))
      .filter(({ data }) => isEmailJobEligibleForProcessing(data, Date.now()));
  } catch {
    const q2 = query(col, where('status', 'in', ['pending', 'failed', 'sending']), firestoreLimit(200));
    const snap = await getDocs(q2);
    const list = snap.docs
      .map((d) => ({ id: d.id, data: d.data() as EmailJob }))
      .filter(({ data }) => isEmailJobEligibleForProcessing(data, Date.now()))
      .sort((a, b) => timestampMillis(a.data.nextAttemptAt) - timestampMillis(b.data.nextAttemptAt))
      .slice(0, batchSize);
    return list;
  }
}

function timestampMillis(value: unknown): number {
  if (value && typeof value === 'object') {
    const timestamp = value as { toMillis?: () => number; toDate?: () => Date; seconds?: number };
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
    if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
  }
  if (typeof value === 'string') return new Date(value).getTime();
  return 0;
}

export async function POST(request: Request) {
  return processEmailQueue(request);
}

export async function GET(request: Request) {
  // GET para Vercel Cron (solo permite GET por defecto en Hobby).
  return processEmailQueue(request);
}

async function processEmailQueue(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!isResendConfigured() || !resend) {
    return NextResponse.json({ error: resendConfigurationError() ?? 'Resend no configurado' }, { status: 500 });
  }

  const batchSize = 25;
  let jobs: { id: string; data: EmailJob }[];
  try {
    jobs = await fetchPendingJobs(batchSize);
  } catch (error) {
    console.error('[cron/email] No se pudieron consultar los jobs:', error);
    return NextResponse.json({ error: 'No se pudieron consultar los emails pendientes' }, { status: 500 });
  }
  if (jobs.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0, failed: 0 });
  }

  let sent = 0;
  let failed = 0;
  let lockFailures = 0;
  const processedIds: string[] = [];

  for (const job of jobs) {
    const jobRef = doc(db, 'emailJobs', job.id);
    let claimedJob: EmailJob | null;
    try {
      claimedJob = await runTransaction(db, async (tx) => {
        const snap = await tx.get(jobRef);
        if (!snap.exists()) return null;
        const data = snap.data() as EmailJob;
        if (!isEmailJobEligibleForProcessing(data, Date.now())) return null;
        tx.update(jobRef, {
          status: 'sending',
          updatedAt: Timestamp.now(),
        });
        return data;
      });
    } catch (error) {
      lockFailures += 1;
      console.error('[cron/email] No se pudo reclamar el job:', { jobId: job.id, error });
      continue;
    }

    if (!claimedJob) continue;

    processedIds.push(job.id);
    const from = getEmailJobFrom(claimedJob.from);
    const to = claimedJob.type === 'admin_aviso'
      ? getSalesNotificationEmail() || claimedJob.to
      : claimedJob.to;

    try {
      if (!to || !claimedJob.subject || !claimedJob.html) {
        throw new Error('Job incompleto (to/subject/html)');
      }
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject: claimedJob.subject,
        html: claimedJob.html,
        text: claimedJob.text ?? undefined,
        replyTo: claimedJob.replyTo ?? undefined,
      });
      if (error) {
        throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
      }
      await updateDoc(jobRef, {
        status: 'sent',
        attempts: (claimedJob.attempts ?? 0) + 1,
        lastError: null,
        sentAt: Timestamp.now(),
        providerMessageId: data?.id ?? null,
        updatedAt: Timestamp.now(),
      });
      if (claimedJob.reservationId) {
        const reservationRef = doc(db, 'reservas', claimedJob.reservationId);
        const now = Timestamp.now();
        await updateDoc(reservationRef, {
          [emailDeliveryPathForJobType(claimedJob.type)]: buildEmailDeliveryState({
            status: 'sent',
            now,
            jobId: job.id,
            provider: 'resend',
            providerMessageId: data?.id ?? null,
          }),
          ...(claimedJob.type === 'cliente_voucher_48hs' || claimedJob.type === 'cliente_confirmacion'
            ? { voucherSent: true, voucherSentAt: now }
            : {}),
          updatedAt: now,
        }).catch(() => null);
      }
      sent += 1;
    } catch (err) {
      const attempt = (claimedJob.attempts ?? 0) + 1;
      const delay = backoffSeconds(attempt);
      const nextAttemptAt = Timestamp.fromDate(new Date(Date.now() + delay * 1000));
      await updateDoc(jobRef, {
        status: 'failed',
        attempts: attempt,
        lastError: err instanceof Error ? err.message : String(err),
        nextAttemptAt,
        updatedAt: Timestamp.now(),
      }).catch(() => null);
      if (claimedJob.reservationId) {
        const reservationRef = doc(db, 'reservas', claimedJob.reservationId);
        const now = Timestamp.now();
        await updateDoc(reservationRef, {
          [emailDeliveryPathForJobType(claimedJob.type)]: buildEmailDeliveryState({
            status: 'failed',
            now,
            jobId: job.id,
            provider: 'resend',
            error: err instanceof Error ? err.message : String(err),
          }),
          updatedAt: now,
        }).catch(() => null);
      }
      failed += 1;
    }
  }

  return NextResponse.json({
    ok: failed === 0 && lockFailures === 0,
    processed: processedIds.length,
    sent,
    failed,
    lockFailures,
    ids: processedIds,
  });
}
