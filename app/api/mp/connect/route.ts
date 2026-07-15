import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const token = authHeader.slice(7);

  // Verify Firebase ID token via REST API (no firebase-admin needed)
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const verifyRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    }
  );
  if (!verifyRes.ok) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }
  const verifyData = await verifyRes.json();
  const uid = verifyData.users?.[0]?.localId;
  if (!uid) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }

  const clientId = process.env.MP_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/mp/callback`;
  const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${uid}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.json({ authUrl });
}
