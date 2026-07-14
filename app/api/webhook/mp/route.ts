import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { getPayment } from '@/lib/mercadopago/client';
import { generateQrDataUrl, generateQrToken } from '@/lib/qr/generate';
import { FieldValue } from 'firebase-admin/firestore';

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

    const orderRef = adminDb.doc(`orders/${orderId}`);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return NextResponse.json({ received: true });

    const order = orderSnap.data()!;

    if (order.status === 'paid') {
      return NextResponse.json({ received: true });
    }

    await orderRef.update({
      mpPaymentId: paymentId,
      mpStatus: payment.status,
      status: 'paid',
      paidAt: FieldValue.serverTimestamp(),
    });

    const eventSnap = await adminDb.doc(`events/${order.eventId}`).get();
    const event = eventSnap.data()!;

    const batch = adminDb.batch();
    const ticketIds: string[] = [];

    for (const item of order.items) {
      for (let i = 0; i < item.qty; i++) {
        const ticketRef = adminDb.collection('tickets').doc();
        const qrToken = generateQrToken(ticketRef.id, order.eventId);

        batch.set(ticketRef, {
          orderId,
          eventId: order.eventId,
          orgId: order.orgId,
          ticketTypeId: item.ticketTypeId,
          ticketTypeName: item.ticketTypeName,
          holderName: order.buyerName,
          holderEmail: order.buyerEmail,
          qrToken,
          status: 'valid',
          createdAt: FieldValue.serverTimestamp(),
        });

        ticketIds.push(ticketRef.id);

        // update sold count
        const eventRef = adminDb.doc(`events/${order.eventId}`);
        const updatedTypes = event.ticketTypes.map((tt: { id: string; sold: number }) =>
          tt.id === item.ticketTypeId ? { ...tt, sold: tt.sold + 1 } : tt
        );
        await eventRef.update({ ticketTypes: updatedTypes });
      }
    }

    await batch.commit();

    // generate QR images and store URLs
    for (const ticketId of ticketIds) {
      const qrDataUrl = await generateQrDataUrl(ticketId, order.eventId);
      const base64 = qrDataUrl.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');

      const bucket = adminStorage.bucket();
      const file = bucket.file(`qr/${ticketId}.png`);
      await file.save(buffer, { contentType: 'image/png', public: true });
      const [url] = await file.getSignedUrl({ action: 'read', expires: '01-01-2099' });

      await adminDb.doc(`tickets/${ticketId}`).update({ qrCodeUrl: url });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[webhook/mp]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
