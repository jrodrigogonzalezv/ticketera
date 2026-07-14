import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { verifyQrToken } from '@/lib/qr/generate';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const { qrPayload, sessionToken, eventId } = await req.json();

    // verify session
    const sessionsSnap = await adminDb
      .collection('validationSessions')
      .where('token', '==', sessionToken)
      .where('eventId', '==', eventId)
      .limit(1)
      .get();

    if (sessionsSnap.empty) {
      return NextResponse.json({ valid: false, reason: 'Sesión inválida o expirada' }, { status: 403 });
    }

    const session = sessionsSnap.docs[0].data();
    if (new Date(session.expiresAt.toDate()) < new Date()) {
      return NextResponse.json({ valid: false, reason: 'Sesión expirada' }, { status: 403 });
    }

    // parse QR
    let parsed: { ticketId: string; eventId: string; token: string };
    try {
      parsed = JSON.parse(qrPayload);
    } catch {
      return NextResponse.json({ valid: false, reason: 'QR inválido' });
    }

    if (parsed.eventId !== eventId) {
      return NextResponse.json({ valid: false, reason: 'Este ticket no corresponde a este evento' });
    }

    if (!verifyQrToken(parsed.token, parsed.ticketId, parsed.eventId)) {
      return NextResponse.json({ valid: false, reason: 'QR falsificado o corrupto' });
    }

    const ticketRef = adminDb.doc(`tickets/${parsed.ticketId}`);
    const ticketSnap = await ticketRef.get();

    if (!ticketSnap.exists) {
      return NextResponse.json({ valid: false, reason: 'Ticket no encontrado' });
    }

    const ticket = ticketSnap.data()!;

    if (ticket.status === 'used') {
      return NextResponse.json({
        valid: false,
        reason: 'Ticket ya utilizado',
        scannedAt: ticket.scannedAt?.toDate().toISOString(),
        holderName: ticket.holderName,
      });
    }

    if (ticket.status === 'cancelled') {
      return NextResponse.json({ valid: false, reason: 'Ticket cancelado' });
    }

    await ticketRef.update({
      status: 'used',
      scannedAt: FieldValue.serverTimestamp(),
      scannedBy: session.validatorEmail || 'validator',
    });

    return NextResponse.json({
      valid: true,
      holderName: ticket.holderName,
      ticketTypeName: ticket.ticketTypeName,
      ticketId: parsed.ticketId,
    });
  } catch (err) {
    console.error('[validation/scan]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
