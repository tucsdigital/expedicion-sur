import { NextResponse } from 'next/server';
import { guardVendor } from '@/lib/vendor-guard';

export const runtime = 'nodejs';

/** Perfil del vendedor autenticado (sirve también para validar el acceso al portal). */
export async function GET(request: Request) {
  const ctx = await guardVendor(request);
  if (ctx instanceof NextResponse) return ctx;
  const { vendor, vendorId, email, allowedExperiences } = ctx;
  return NextResponse.json({
    ok: true,
    vendor: {
      id: vendorId,
      name: String(vendor.name ?? ''),
      email,
      dni: String(vendor.normalizedDni ?? vendor.dni ?? ''),
      mustChangePassword: Boolean(vendor.mustChangePassword),
      defaultCommission: vendor.defaultCommission ?? null,
      allowedExperiences,
    },
  });
}
