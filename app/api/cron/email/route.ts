import { NextResponse } from 'next/server';
import { resend, getFromEmail, isResendConfigured } from '@/lib/resend';
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

export const runtime = 'nodejs';

type EmailJobStatus = 'pending' | 'sending' | 'sent' | 'failed';
type EmailJob = {
  type: 'cliente_confirmacion' | 'admin_aviso';
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
  stripeSessionId?: string;
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
      where('status', 'in', ['pending', 'failed']),
      where('nextAttemptAt', '<=', now),
      firestoreOrderBy('nextAttemptAt', 'asc'),
      firestoreLimit(batchSize)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, data: d.data() as EmailJob }));
  } catch {
    const q2 = query(col, where('status', 'in', ['pending', 'failed']), firestoreLimit(200));
    const snap = await getDocs(q2);
    const list = snap.docs
      .map((d) => ({ id: d.id, data: d.data() as EmailJob }))
      .filter(({ data }) => {
        const toMs = (v: unknown): number => {
          if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
            return (v as { toDate: () => Date }).toDate().getTime();
          }
          if (v && typeof v === 'object' && 'seconds' in v) return ((v as { seconds: number }).seconds ?? 0) * 1000;
          if (typeof v === 'string') return new Date(v).getTime();
          return 0;
        };
        return toMs(data.nextAttemptAt) <= Date.now();
      })
      .sort((a, b) => {
        const toMs = (v: unknown): number => {
          if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
            return (v as { toDate: () => Date }).toDate().getTime();
          }
          if (v && typeof v === 'object' && 'seconds' in v) return ((v as { seconds: number }).seconds ?? 0) * 1000;
          if (typeof v === 'string') return new Date(v).getTime();
          return 0;
        };
        return toMs(a.data.nextAttemptAt) - toMs(b.data.nextAttemptAt);
      })
      .slice(0, batchSize);
    return list;
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!isResendConfigured() || !resend) {
    return NextResponse.json({ error: 'Resend no configurado (falta RESEND_API_KEY)' }, { status: 500 });
  }

  const batchSize = 25;
  const jobs = await fetchPendingJobs(batchSize);
  if (jobs.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0, failed: 0 });
  }

  let sent = 0;
  let failed = 0;
  const processedIds: string[] = [];

  for (const job of jobs) {
    const jobRef = doc(db, 'emailJobs', job.id);
    const locked = await runTransaction(db, async (tx) => {
      const snap = await tx.get(jobRef);
      if (!snap.exists()) return false;
      const data = snap.data() as EmailJob;
      const status = data.status;
      if (status !== 'pending' && status !== 'failed') return false;
      tx.update(jobRef, {
        status: 'sending',
        updatedAt: Timestamp.now(),
      });
      return true;
    }).catch(() => false);

    if (!locked) continue;

    processedIds.push(job.id);
    const from = job.data.from ?? getFromEmail();

    try {
      if (!job.data.to || !job.data.subject || !job.data.html) {
        throw new Error('Job incompleto (to/subject/html)');
      }
      const { error } = await resend.emails.send({
        from,
        to: job.data.to,
        subject: job.data.subject,
        html: job.data.html,
        text: job.data.text ?? undefined,
        replyTo: job.data.replyTo ?? undefined,
      });
      if (error) {
        throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
      }
      await updateDoc(jobRef, {
        status: 'sent',
        attempts: (job.data.attempts ?? 0) + 1,
        lastError: null,
        sentAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      sent += 1;
    } catch (err) {
      const attempt = (job.data.attempts ?? 0) + 1;
      const delay = backoffSeconds(attempt);
      const nextAttemptAt = Timestamp.fromDate(new Date(Date.now() + delay * 1000));
      await updateDoc(jobRef, {
        status: 'failed',
        attempts: attempt,
        lastError: err instanceof Error ? err.message : String(err),
        nextAttemptAt,
        updatedAt: Timestamp.now(),
      }).catch(() => null);
      failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    processed: processedIds.length,
    sent,
    failed,
    ids: processedIds,
  });
}
