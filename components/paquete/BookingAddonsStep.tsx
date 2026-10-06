'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from '@/lib/messages';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { BadgeCheck, ImagePlus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AddonOption = {
  id: string;
  title: string;
  description: string;
  image: string;
  price: number;
};

type Props = {
  addons: AddonOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  currencyLabel: string;
};

function formatPrice(price: number, currencyLabel: string, locale: string) {
  return `$${(Math.max(0, Number(price) || 0)).toLocaleString(locale === 'en' ? 'en-US' : 'es-AR')} ${currencyLabel}`;
}

export default function BookingAddonsStep({ addons, selectedIds, onToggle, currencyLabel }: Props) {
  const locale = useLocale();
  const p = useTranslations('excursionPage');
  const s = useTranslations('sidebar');
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {p('addonsIntro')}
        </p>
        {selectedSet.size > 0 ? (
          <motion.div
            key={`badge-${selectedSet.size}`}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="shrink-0 rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white"
          >
            {s('chosenCount', { count: selectedSet.size })}
          </motion.div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <AnimatePresence initial={false}>
          {addons.map((addon) => {
            const selected = selectedSet.has(addon.id);
            return (
              <motion.button
                key={addon.id}
                type="button"
                layout
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.22 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onToggle(addon.id)}
                aria-pressed={selected}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border text-left transition-all duration-300',
                  selected
                    ? 'border-neutral-900 bg-white shadow-[0_14px_34px_-14px_rgba(0,0,0,0.25)]'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-[0_12px_28px_-16px_rgba(0,0,0,0.2)]'
                )}
              >
                <div className="relative h-32 w-full overflow-hidden bg-gray-100">
                  {addon.image ? (
                    <Image
                      src={addon.image}
                      alt={addon.title}
                      fill
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                      <ImagePlus className="h-8 w-8" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/55 to-transparent" />
                  <div className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-neutral-900 shadow">
                    + {formatPrice(addon.price, currencyLabel, locale)}
                  </div>
                  <div
                    className={cn(
                      'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 transition',
                      selected ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-white/80 bg-white/85 text-transparent'
                    )}
                    aria-hidden="true"
                  >
                    <BadgeCheck className="h-4 w-4" />
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-sm font-semibold leading-tight text-neutral-900">{addon.title}</div>
                  {addon.description ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">{addon.description}</p>
                  ) : null}
                  <div
                    className={cn(
                      'mt-2 inline-flex items-center gap-1 text-xs font-semibold transition-colors',
                      selected ? 'text-neutral-900' : 'text-neutral-400 group-hover:text-neutral-900'
                    )}
                  >
                    <Plus className={cn('h-3.5 w-3.5 transition-transform duration-300', selected && 'rotate-45')} />
                    {selected ? p('addonAdded') : p('addonAdd')}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
