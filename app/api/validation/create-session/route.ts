import { NextRequest, NextResponse } from 'next/server';
import { getDoc, addDoc, serverTimestamp } from '@/lib/server/firestore';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';

const SESSION_SECRET = process.env.VALIDATION_SESSION_SECRET || 'session-secret';

async function verifyFirebaseToken(token: string): Promise<{ uid: string; email: string } | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const user = data.users?.[0];
  if (!user) return null;
  return { uid: user.localId, email: user.email || '' };
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const user = await verifyFirebaseToken(token);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { eventId } = await req.json();
    if (!eventId) return NextResponse.json({ error: 'eventId requerido' }, { status: 400 });

    const eventDoc = await getDoc(`events/${eventId}`);
    if (!eventDoc?.exists || eventDoc.data.orgId !== user.uid) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const sessionToken = createHmac('sha256', SESSION_SECRET)
      .update(`${eventId}:${user.uid}:${Date.now()}`)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const sessionId = await addDoc('validationSessions', {
      eventId,
      orgId: user.uid,
      validatorEmail: user.email,
      token: sessionToken,
      createdAt: serverTimestamp(),
      expiresAt,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const url = `${baseUrl}/validate/${eventId}?session=${sessionToken}`;

    return NextResponse.json({ sessionId, token: sessionToken, url });
  } catch (err) {
    console.error('[validation/create-session]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
