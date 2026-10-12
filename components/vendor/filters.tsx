'use client';

import { CalendarDays, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const pill =
  'h-9 rounded-full border-0 bg-white px-3.5 text-sm font-normal shadow-xs ring-1 ring-gray-200/60 transition-all hover:ring-gray-300 focus-visible:ring-2 focus-visible:ring-gray-300 data-[state=open]:ring-gray-300';
const pillActive = 'bg-gray-900/[0.04] ring-gray-300 text-gray-900';

export type FilterOption = { value: string; label: string; count?: number };

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = 'Todos',
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  allLabel?: string;
  className?: string;
}) {
  const active = value !== 'all';
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={cn(pill, 'w-auto min-w-[150px] gap-2', active && pillActive, className)}>
        <span className="text-gray-500">{label}:</span>
        <span className={cn('truncate', active ? 'font-medium text-gray-900' : 'text-gray-700')}>
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-gray-100 bg-white shadow-xl">
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
            {typeof o.count === 'number' && <span className="ml-1.5 text-gray-400">· {o.count}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DateRangeFilter({
  label = 'Fecha',
  from,
  to,
  onChange,
  minDate,
  maxDate,
}: {
  label?: string;
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  /** Límites reales (yyyy-MM-dd) según los datos del vendedor. */
  minDate?: string;
  maxDate?: string;
}) {
  const active = Boolean(from || to);
  return (
    <div className={cn('inline-flex h-9 items-center gap-2 rounded-full border-0 bg-white px-3 shadow-xs ring-1 ring-gray-200/60', active && pillActive)}>
      <CalendarDays className="h-4 w-4 shrink-0 text-gray-400" />
      <span className="shrink-0 text-sm text-gray-500">{label}:</span>
      <input
        type="date"
        aria-label={`${label}: desde`}
        value={from}
        min={minDate}
        max={to || maxDate}
        onChange={(event) => onChange({ from: event.target.value, to: to && event.target.value > to ? '' : to })}
        className="w-[118px] bg-transparent text-xs text-gray-700 outline-none"
      />
      <span className="text-xs text-gray-400">—</span>
      <input
        type="date"
        aria-label={`${label}: hasta`}
        value={to}
        min={from || minDate}
        max={maxDate}
        onChange={(event) => onChange({ from, to: event.target.value })}
        className="w-[118px] bg-transparent text-xs text-gray-700 outline-none"
      />
      {active && (
        <button type="button" aria-label="Quitar filtro de fecha" onClick={() => onChange({ from: '', to: '' })} className="rounded-full p-1 text-gray-400 hover:bg-gray-200/60 hover:text-gray-700">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
