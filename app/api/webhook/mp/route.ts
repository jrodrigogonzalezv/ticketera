import { NextRequest, NextResponse } from 'next/server';
import { getDoc, updateDoc, addDoc, serverTimestamp } from '@/lib/server/firestore';
import { getAccessToken } from '@/lib/server/gcp-token';
import { getPayment } from '@/lib/mercadopago/client';
import { generateQrDataUrl, generateQrToken } from '@/lib/qr/generate';

export const dynamic = 'force-dynamic';

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID!;
const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;

async function uploadQrToStorage(ticketId: string, qrDataUrl: string): Promise<string> {
  const base64 = qrDataUrl.split(',')[1];
  const buffer = Buffer.from(base64, 'base64');
  const token = await getAccessToken();
  const objectName = encodeURIComponent(`qr/${ticketId}.png`);

  const uploadRes = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=qr/${ticketId}.png`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'image/png',
      },
      body: buffer,
    }
  );
  if (!uploadRes.ok) throw new Error(`Storage upload error: ${uploadRes.status}`);

  // Make public
  await fetch(
    `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${objectName}/iam`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bindings: [{ role: 'roles/storage.objectViewer', members: ['allUsers'] }],
      }),
    }
  );

  return `https://storage.googleapis.com/${BUCKET}/qr/${ticketId}.png`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.type !== 'payment') {
      return NextResponse.json({ received: true });
    }

    const paymentId = String(body.data?.id);
    const payment = await getPayment(paymentId);

    if (payment.status !== 'approved') {
      return NextResponse.json({ received: true });
    }

    const orderId = payment.external_reference;
    if (!orderId) return NextResponse.json({ received: true });

    const orderDoc = await getDoc(`orders/${orderId}`);
    if (!orderDoc?.exists) return NextResponse.json({ received: true });

    const order = orderDoc.data;

    if (order.status === 'paid') {
      return NextResponse.json({ received: true });
    }

    await updateDoc(`orders/${orderId}`, {
      mpPaymentId: paymentId,
      mpStatus: payment.status,
      status: 'paid',
      paidAt: serverTimestamp(),
    });

    const eventDoc = await getDoc(`events/${order.eventId}`);
    const event = eventDoc?.data || {};
    const ticketTypes = (event.ticketTypes || []) as Array<{ id: string; sold: number }>;

    const orderItemsList = order.items as Array<{ ticketTypeId: string; ticketTypeName: string; qty: number }>;

    for (const item of orderItemsList) {
      for (let i = 0; i < item.qty; i++) {
        const ticketId = await addDoc('tickets', {
          orderId,
          eventId: order.eventId,
          orgId: order.orgId,
          ticketTypeId: item.ticketTypeId,
          ticketTypeName: item.ticketTypeName,
          holderName: order.buyerName,
          holderEmail: order.buyerEmail,
          qrToken: '',
          status: 'valid',
          createdAt: serverTimestamp(),
        });

        const qrToken = generateQrToken(ticketId, order.eventId as string);
        await updateDoc(`tickets/${ticketId}`, { qrToken });

        const updatedTypes = ticketTypes.map((tt) =>
          tt.id === item.ticketTypeId ? { ...tt, sold: (tt.sold || 0) + 1 } : tt
        );
        await updateDoc(`events/${order.eventId}`, { ticketTypes: updatedTypes });

        try {
          const qrDataUrl = await generateQrDataUrl(ticketId, order.eventId as string);
          const qrCodeUrl = await uploadQrToStorage(ticketId, qrDataUrl);
          await updateDoc(`tickets/${ticketId}`, { qrCodeUrl });
        } catch (qrErr) {
          console.error('[webhook] QR generation failed for ticket', ticketId, qrErr);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[webhook/mp]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
