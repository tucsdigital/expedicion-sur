'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type AuthPortalShellProps = {
  roleLabel: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
  backLabel?: string;
  onBack?: () => void;
  status?: 'default' | 'success';
};

export default function AuthPortalShell({
  roleLabel,
  title,
  subtitle,
  icon,
  children,
  backLabel,
  onBack,
  status = 'default',
}: AuthPortalShellProps) {
  const iconToneClass =
    status === 'success'
      ? 'bg-emerald-100 text-emerald-600'
      : 'bg-[#EEF3FF] text-[#0F1F52]';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(239,243,250,0.96)_42%,_rgba(228,234,243,0.98)_100%)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
        <div className="relative w-full overflow-hidden rounded-[30px] border border-white/70 bg-white/88 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-36 bg-[linear-gradient(140deg,rgba(236,240,247,0.95)_0%,rgba(246,248,252,0.72)_42%,rgba(228,236,248,0.72)_100%)]" />
          <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top_left,rgba(210,220,238,0.8),transparent_55%),radial-gradient(circle_at_top_right,rgba(225,231,244,0.65),transparent_50%)]" />

          <div className="relative px-7 pb-7 pt-6 sm:px-8 sm:pb-8 sm:pt-7">
            <div className="mb-7 min-h-6">
              {backLabel && onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#24335B] transition hover:text-[#10204C]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {backLabel}
                </button>
              ) : null}
            </div>

            <div className="mb-8 flex flex-col items-center text-center">
              <div className={cn('mt-6 flex h-20 w-20 items-center justify-center rounded-full', iconToneClass)}>
                {icon}
              </div>
              <h1 className="mt-6 text-[2rem] font-semibold tracking-[-0.03em] text-[#0B163B]">{title}</h1>
              <p className="mt-3 max-w-[260px] text-sm leading-6 text-[#66728F]">{subtitle}</p>
            </div>

            <div>{children}</div>

            <div className="mt-10 border-t border-[#E6EBF3] pt-5 text-center text-[12px] text-[#7B859D]">
              Desarrollado por{' '}
              <Link
                href="https://tucsdigital.com.ar"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#0F1F52] transition hover:text-[#2145A3]"
              >
                Tucs Digital
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
