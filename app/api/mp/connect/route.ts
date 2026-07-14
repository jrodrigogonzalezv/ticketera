import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const decoded = await adminAuth.verifyIdToken(token);

  const clientId = process.env.MP_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/mp/callback`;
  const state = decoded.uid;

  const authUrl = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.json({ authUrl });
}
