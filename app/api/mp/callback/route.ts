import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const orgId = searchParams.get('state');

  if (!code || !orgId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings?mp=error`);
  }

  try {
    const res = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.MP_CLIENT_ID,
        client_secret: process.env.MP_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/mp/callback`,
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    await adminDb.doc(`organizers/${orgId}`).update({
      mpAccessToken: data.access_token,
      mpRefreshToken: data.refresh_token,
      mpUserId: String(data.user_id),
    });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings?mp=success`);
  } catch (err) {
    console.error('[mp/callback]', err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings?mp=error`);
  }
}
