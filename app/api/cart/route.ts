import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function legacyCartDisabled() {
  return NextResponse.json(
    {
      error: 'El carrito fue desactivado en Expedicion Sur. Usá la reserva directa desde el paquete.',
      code: 'LEGACY_CART_DISABLED',
    },
    { status: 410 }
  );
}

export async function GET() {
  return legacyCartDisabled();
}

export async function DELETE() {
  return legacyCartDisabled();
}

