'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Flag, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSortedCountryOptions, type CountryOption } from '@/lib/countries';

type NationalitySelectProps = {
  id?: string;
  value: string;
  onChange: (countryName: string) => void;
  placeholder?: string;
};

/** Selector de nacionalidad con buscador (filtro por nombre o prefijo) y orden alfabético. */
export function NationalitySelect({ id, value, onChange, placeholder }: NationalitySelectProps) {
  const fallbackId = useId();
  const triggerId = id ?? fallbackId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => getSortedCountryOptions(), []);
  const selected = useMemo(
    () => options.find((country) => country.name === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter(
      (country) =>
        country.name.toLowerCase().includes(normalized) ||
        country.dialCode.replace('+', '').startsWith(normalized.replace('+', ''))
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open ]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !open) return;
    const active = list.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`);
    active?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, open]);

  const choose = (country: CountryOption) => {
    onChange(country.name);
    setOpen(false);
  };

  const openMenu = () => {
    setQuery('');
    setHighlightedIndex(0);
    setOpen(true);
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      openMenu();
    }
  };

  const onSearchChange = (next: string) => {
    setQuery(next);
    setHighlightedIndex(0);
  };

  const onListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.min(filtered.length - 1, prev + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(0, prev - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[highlightedIndex];
      if (option) choose(option);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={triggerId}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-[#BFD8EE] bg-white px-3 py-2 text-sm text-slate-800 shadow-[0_4px_12px_rgba(30,136,184,0.06)] outline-none transition-[color,box-shadow,border-color] focus-visible:border-[#2BB8BF] focus-visible:ring-2 focus-visible:ring-[#2BB8BF]/20"
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true">{selected.flag}</span>
            <span className="truncate">
              {selected.name}{' '}
            </span>
          </span>
        ) : (
          <span className="text-slate-400">{placeholder ?? 'Seleccioná tu nacionalidad'}</span>
        )}
        <ChevronDown className={cn('size-4 shrink-0 opacity-50 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full z-[320] mt-1 overflow-hidden rounded-xl border border-[#BFD8EE] bg-white shadow-[0_18px_46px_rgba(17,52,89,0.18)]">
          <div className="border-b border-[#E3EDF7] p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={onListKeyDown}
                placeholder="Buscar país…"
                aria-label="Buscar país por nombre o prefijo"
                className="h-9 w-full rounded-lg border border-[#BFD8EE] bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus-visible:border-[#2BB8BF] focus-visible:ring-2 focus-visible:ring-[#2BB8BF]/20"
              />
            </div>
          </div>
          <div ref={listRef} role="listbox" aria-labelledby={triggerId} className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-slate-500">
                <Flag className="size-4 shrink-0" />
                Sin resultados para “{query.trim()}”
              </div>
            ) : (
              filtered.map((country, index) => {
                const isSelected = country.name === value;
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={country.code}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-index={index}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => choose(country)}
                    className={cn(
                      'relative flex w-full cursor-default items-center gap-2 rounded-lg py-2 pl-2 pr-8 text-left text-sm outline-none select-none',
                      isHighlighted ? 'bg-[#EDF7FF] text-slate-900' : 'text-slate-800'
                    )}
                  >
                    <span aria-hidden="true">{country.flag}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {country.name}
                    </span>
                    {isSelected ? (
                      <span className="absolute right-2 flex size-3.5 items-center justify-center">
                        <Check className="size-4" />
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
