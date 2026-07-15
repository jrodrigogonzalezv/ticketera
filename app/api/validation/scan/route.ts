import { NextRequest, NextResponse } from 'next/server';
import { queryDocs, getDoc, updateDoc, serverTimestamp } from '@/lib/server/firestore';
import { verifyQrToken } from '@/lib/qr/generate';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { qrPayload, sessionToken, eventId } = await req.json();

    const sessions = await queryDocs('validationSessions', [
      { field: 'token', op: 'EQUAL', value: sessionToken },
      { field: 'eventId', op: 'EQUAL', value: eventId },
    ]);

    if (sessions.length === 0) {
      return NextResponse.json({ valid: false, reason: 'Sesión inválida o expirada' }, { status: 403 });
    }

    const session = sessions[0].data;
    const expiresAt = session.expiresAt instanceof Date ? session.expiresAt : new Date(session.expiresAt as string);
    if (expiresAt < new Date()) {
      return NextResponse.json({ valid: false, reason: 'Sesión expirada' }, { status: 403 });
    }

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

    const ticketDoc = await getDoc(`tickets/${parsed.ticketId}`);
    if (!ticketDoc?.exists) {
      return NextResponse.json({ valid: false, reason: 'Ticket no encontrado' });
    }

    const ticket = ticketDoc.data;

    if (ticket.status === 'used') {
      const scannedAt = ticket.scannedAt instanceof Date ? ticket.scannedAt.toISOString() : String(ticket.scannedAt);
      return NextResponse.json({
        valid: false,
        reason: 'Ticket ya utilizado',
        scannedAt,
        holderName: ticket.holderName,
      });
    }

    if (ticket.status === 'cancelled') {
      return NextResponse.json({ valid: false, reason: 'Ticket cancelado' });
    }

    await updateDoc(`tickets/${parsed.ticketId}`, {
      status: 'used',
      scannedAt: serverTimestamp(),
      scannedBy: (session.validatorEmail as string) || 'validator',
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
