import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { FieldValue } from 'firebase-admin/firestore';
import { createHmac } from 'crypto';

const SESSION_SECRET = process.env.VALIDATION_SESSION_SECRET || 'session-secret';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);

    const { eventId } = await req.json();
    if (!eventId) return NextResponse.json({ error: 'eventId requerido' }, { status: 400 });

    const eventSnap = await adminDb.doc(`events/${eventId}`).get();
    if (!eventSnap.exists || eventSnap.data()!.orgId !== decoded.uid) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const sessionToken = createHmac('sha256', SESSION_SECRET)
      .update(`${eventId}:${decoded.uid}:${Date.now()}`)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const sessionRef = await adminDb.collection('validationSessions').add({
      eventId,
      orgId: decoded.uid,
      validatorEmail: decoded.email || '',
      token: sessionToken,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const url = `${baseUrl}/validate/${eventId}?session=${sessionToken}`;

    return NextResponse.json({ sessionId: sessionRef.id, token: sessionToken, url });
  } catch (err) {
    console.error('[validation/create-session]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
