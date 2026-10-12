'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchAdminVendors, type AdminVendorOption } from '@/lib/admin-vendors-client';

type Props = {
  value: string;
  onChange: (vendorId: string, vendor: AdminVendorOption | null) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Vendedor ya asignado: se incluye en la lista aunque esté deshabilitado. */
  includeId?: string;
  className?: string;
};

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function VendorCombobox({ value, onChange, disabled, placeholder = 'Seleccioná un vendedor', includeId, className }: Props) {
  const [vendors, setVendors] = useState<AdminVendorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setVendors(await fetchAdminVendors(includeId || value || undefined));
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los vendedores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const selected = vendors.find((v) => v.id === value) ?? null;

  const filtered = useMemo(() => {
    const t = norm(term.trim());
    if (!t) return vendors;
    return vendors.filter((v) => norm(`${v.name} ${v.email} ${v.dni}`).includes(t));
  }, [vendors, term]);

  const choose = (v: AdminVendorOption | null) => {
    onChange(v?.id ?? '', v);
    setOpen(false);
    setTerm('');
  };

  const toggle = () => {
    if (disabled) return;
    if (!open) {
      setCursor(0);
      setTerm('');
      if (error) load();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    setOpen((o) => !o);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[cursor]) choose(filtered[cursor]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-white px-3 text-left text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? selected.name + (selected.active ? '' : ' (deshabilitado)') : value ? 'Vendedor asignado' : placeholder}
        </span>
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" /> : <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" />}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="relative border-b border-gray-100 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setCursor(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Buscar por nombre, email o DNI…"
              className="h-8 w-full rounded-md bg-gray-50 pl-8 pr-8 text-sm outline-none focus:ring-1 focus:ring-gray-300"
            />
            {term && (
              <button type="button" onClick={() => setTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
            <li>
              <button
                type="button"
                onClick={() => choose(null)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50"
              >
                Sin vendedor
                {!value && <Check className="h-4 w-4 text-emerald-600" />}
              </button>
            </li>
            {error ? (
              <li className="px-3 py-3 text-sm text-rose-600">{error}</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-gray-500">{loading ? 'Cargando…' : 'No se encontraron vendedores'}</li>
            ) : (
              filtered.map((v, i) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => choose(v)}
                    className={cn('flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm', i === cursor ? 'bg-gray-100' : 'hover:bg-gray-50')}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-900">
                        {v.name}
                        {!v.active && <span className="ml-1 text-xs font-normal text-amber-600">(deshabilitado)</span>}
                      </span>
                      <span className="block truncate text-xs text-gray-500">{[v.email, v.dni && `DNI ${v.dni}`].filter(Boolean).join(' · ')}</span>
                    </span>
                    {v.id === value && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
