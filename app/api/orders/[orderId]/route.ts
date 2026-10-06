import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const id = String(orderId || '').trim();
  if (!id) return NextResponse.json({ error: 'Order inválida.' }, { status: 400 });

  const orderSnap = await getDoc(doc(db, 'orders', id));
  if (!orderSnap.exists()) {
    return NextResponse.json({ error: 'Order no encontrada.' }, { status: 404 });
  }

  const order = { id: orderSnap.id, ...(orderSnap.data() as any) };
  return NextResponse.json({ ok: true, order });
}
