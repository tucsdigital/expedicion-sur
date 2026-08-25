import { NextResponse } from 'next/server';

type LegacyDisabledOptions = {
  code: string;
  error: string;
  status?: number;
};

export function legacyDisabledResponse(options: LegacyDisabledOptions) {
  return NextResponse.json(
    {
      error: options.error,
      code: options.code,
    },
    { status: options.status ?? 410 }
  );
}
