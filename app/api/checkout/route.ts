import { NextRequest, NextResponse } from 'next/server';
import { getDoc, addDoc, updateDoc, serverTimestamp } from '@/lib/server/firestore';
import { createPreference } from '@/lib/mercadopago/client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { eventId, items, buyerName, buyerEmail, buyerPhone } = await req.json();

    if (!eventId || !items?.length || !buyerEmail || !buyerName) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const eventDoc = await getDoc(`events/${eventId}`);
    if (!eventDoc?.exists) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }
    const event = eventDoc.data;

    if (event.status !== 'published') {
      return NextResponse.json({ error: 'El evento no está disponible' }, { status: 400 });
    }

    const orgDoc = await getDoc(`organizers/${event.orgId}`);
    if (!orgDoc?.exists) {
      return NextResponse.json({ error: 'Organizador no encontrado' }, { status: 404 });
    }
    const org = orgDoc.data;

    if (!org.mpAccessToken) {
      return NextResponse.json({ error: 'El organizador no tiene Mercado Pago configurado' }, { status: 400 });
    }

    const ticketTypes = event.ticketTypes as Array<{ id: string; name: string; price: number; stock: number; sold: number }>;
    const ticketTypeMap = new Map(ticketTypes.map((t) => [t.id, t]));

    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const tt = ticketTypeMap.get(item.ticketTypeId);
      if (!tt) return NextResponse.json({ error: `Tipo de ticket inválido: ${item.ticketTypeId}` }, { status: 400 });
      if (tt.sold + item.qty > tt.stock) {
        return NextResponse.json({ error: `Stock insuficiente para ${tt.name}` }, { status: 400 });
      }
      subtotal += tt.price * item.qty;
      orderItems.push({ ticketTypeId: tt.id, ticketTypeName: tt.name, qty: item.qty, unitPrice: tt.price });
    }

    const feePercent = (org.serviceFeePercent as number) || 10;
    const serviceFee = Math.round(subtotal * (feePercent / 100));
    const total = subtotal + serviceFee;

    const orderId = await addDoc('orders', {
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
      createdAt: serverTimestamp(),
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const preference = await createPreference({
      orderId,
      eventTitle: event.title as string,
      items: orderItems,
      subtotal,
      buyerEmail,
      organizerAccessToken: org.mpAccessToken as string,
      successUrl: `${baseUrl}/tickets/success?order=${orderId}`,
      failureUrl: `${baseUrl}/tickets/failure?order=${orderId}`,
      pendingUrl: `${baseUrl}/tickets/pending?order=${orderId}`,
      webhookUrl: `${baseUrl}/api/webhook/mp`,
    });

    await updateDoc(`orders/${orderId}`, { mpPreferenceId: preference.id });

    return NextResponse.json({
      orderId,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
    });
  } catch (err) {
    console.error('[checkout]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
