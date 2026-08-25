import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function legacyCartDisabled() {
  return NextResponse.json(
    {
      error: 'El flujo de carrito ya no está disponible en Expedicion Sur. Reservá directo desde el paquete.',
      code: 'LEGACY_CART_DISABLED',
    },
    { status: 410 }
  );
}

export async function POST() {
  return legacyCartDisabled();
}

export async function PATCH() {
  return legacyCartDisabled();
}

export async function DELETE() {
  return legacyCartDisabled();
}

