'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PhoneWithPrefixInputProps = Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: string;
  dialCode: string;
  onValueChange: (value: string) => void;
};

/**
 * Input de teléfono con el prefijo internacional fijo (no editable).
 * El usuario solo puede editar el número local; el prefijo se muestra
 * como bloque visual y siempre se incluye al guardar.
 */
export function PhoneWithPrefixInput({
  value,
  dialCode,
  onValueChange,
  className,
  id,
  ...props
}: PhoneWithPrefixInputProps) {
  const safeDial = dialCode.trim() || '';
  const localValue = useMemo(() => {
    const current = String(value ?? '');
    if (safeDial && current.startsWith(safeDial)) {
      return current.slice(safeDial.length).replace(/^\s+/, '');
    }
    return current.replace(/^\+\d{1,4}\s*/, '');
  }, [safeDial, value]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const expected = safeDial ? `${safeDial}${localValue ? ` ${localValue}` : ''}`.trim() || safeDial : localValue;
    if (expected !== value) {
      onValueChange(expected);
    }
    // Solo normaliza cuando cambia el prefijo, no en cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeDial]);

  const handleLocalChange = (nextLocal: string) => {
    const trimmed = nextLocal.replace(/^\s+/, '');
    onValueChange(safeDial ? `${safeDial}${trimmed ? ` ${trimmed}` : ''}`.trim() : trimmed);
  };

  const guardCaret = () => {
    const input = inputRef.current;
    if (!input) return;
    requestAnimationFrame(() => {
      if (input.selectionStart === 0) input.setSelectionRange(0, 0);
    });
  };

  return (
    <div
      className={cn(
        'flex h-10 w-full items-center gap-0 overflow-hidden rounded-xl border border-[#BFD8EE] bg-white text-sm text-slate-800 shadow-[0_4px_12px_rgba(30,136,184,0.06)] transition-[color,box-shadow,border-color] focus-within:border-[#2BB8BF] focus-within:ring-2 focus-within:ring-[#2BB8BF]/20',
        className
      )}
    >
      {safeDial ? (
        <span
          aria-hidden="true"
          className="flex h-full shrink-0 select-none items-center border-r border-[#E3EDF7] bg-[#F2F8FE] px-3 font-bold text-[#12325D]"
        >
          {safeDial}
        </span>
      ) : null}
      <input
        {...props}
        ref={inputRef}
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        aria-label={props['aria-label'] ?? 'Número de WhatsApp sin prefijo'}
        value={localValue}
        onChange={(event) => handleLocalChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            (event.key === 'Backspace' || event.key === 'ArrowLeft' || event.key === 'Home') &&
            (event.target as HTMLInputElement).selectionStart === 0
          ) {
            event.preventDefault();
          }
          props.onKeyDown?.(event);
        }}
        onSelect={guardCaret}
        className="h-full min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
      />
    </div>
  );
}
