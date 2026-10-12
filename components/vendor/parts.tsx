'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PAYOUT_LABEL, PAYOUT_TONE, STATUS_LABEL, STATUS_TONE } from '@/lib/vendor-client';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Pill({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', tone ?? 'bg-gray-100 text-gray-700 ring-gray-200', className)}>
      {children}
    </span>
  );
}

export const StatusPill = ({ status }: { status: string }) => <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status] ?? status}</Pill>;
export const PayoutPill = ({ status }: { status: string }) => <Pill tone={PAYOUT_TONE[status]}>{PAYOUT_LABEL[status] ?? status}</Pill>;
export const SourcePill = ({ source }: { source: 'manual' | 'online' }) => (
  <Pill tone={source === 'manual' ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-cyan-50 text-cyan-700 ring-cyan-200'}>
    {source === 'manual' ? 'Manual' : 'Online'}
  </Pill>
);

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{value}</div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-gray-200 bg-white shadow-sm', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-gray-900">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="rounded-full bg-gray-100 p-3 text-gray-400">
        <Inbox className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-gray-500">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-center">
      <AlertCircle className="h-5 w-5 text-rose-500" />
      <p className="text-sm font-medium text-rose-700">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

export function LoadingBlock({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />;
}
