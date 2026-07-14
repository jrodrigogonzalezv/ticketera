import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { createPreference } from '@/lib/mercadopago/client';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const { eventId, items, buyerName, buyerEmail, buyerPhone } = await req.json();

    if (!eventId || !items?.length || !buyerEmail || !buyerName) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const eventSnap = await adminDb.doc(`events/${eventId}`).get();
    if (!eventSnap.exists) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }
    const event = eventSnap.data()!;

    if (event.status !== 'published') {
      return NextResponse.json({ error: 'El evento no está disponible' }, { status: 400 });
    }

    const orgSnap = await adminDb.doc(`organizers/${event.orgId}`).get();
    if (!orgSnap.exists) {
      return NextResponse.json({ error: 'Organizador no encontrado' }, { status: 404 });
    }
    const org = orgSnap.data()!;

    if (!org.mpAccessToken) {
      return NextResponse.json({ error: 'El organizador no tiene Mercado Pago configurado' }, { status: 400 });
    }

    const ticketTypeMap = new Map(event.ticketTypes.map((t: { id: string; price: number; stock: number; sold: number }) => [t.id, t]));

    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const tt = ticketTypeMap.get(item.ticketTypeId) as { id: string; name: string; price: number; stock: number; sold: number } | undefined;
      if (!tt) return NextResponse.json({ error: `Tipo de ticket inválido: ${item.ticketTypeId}` }, { status: 400 });
      if (tt.sold + item.qty > tt.stock) {
        return NextResponse.json({ error: `Stock insuficiente para ${tt.name}` }, { status: 400 });
      }
      subtotal += tt.price * item.qty;
      orderItems.push({ ticketTypeId: tt.id, ticketTypeName: tt.name, qty: item.qty, unitPrice: tt.price });
    }

    const feePercent = org.serviceFeePercent || 10;
    const serviceFee = Math.round(subtotal * (feePercent / 100));
    const total = subtotal + serviceFee;

    const orderRef = await adminDb.collection('orders').add({
      eventId,
      orgId: event.orgId,
      buyerEmail,
      buyerName,
      buyerPhone: buyerPhone || '',
      items: orderItems,
      subtotal,
      serviceFee,
      total,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const preference = await createPreference({
      orderId: orderRef.id,
      eventTitle: event.title,
      items: orderItems,
      subtotal,
      buyerEmail,
      organizerAccessToken: org.mpAccessToken,
      successUrl: `${baseUrl}/tickets/success?order=${orderRef.id}`,
      failureUrl: `${baseUrl}/tickets/failure?order=${orderRef.id}`,
      pendingUrl: `${baseUrl}/tickets/pending?order=${orderRef.id}`,
      webhookUrl: `${baseUrl}/api/webhook/mp`,
    });

    await orderRef.update({ mpPreferenceId: preference.id });

    return NextResponse.json({
      orderId: orderRef.id,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
    });
  } catch (err) {
    console.error('[checkout]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
