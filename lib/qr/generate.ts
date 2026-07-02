import { createHmac } from 'crypto';
import QRCode from 'qrcode';

const QR_SECRET = process.env.QR_HMAC_SECRET || 'changeme-in-production';

export function generateQrToken(ticketId: string, eventId: string): string {
  return createHmac('sha256', QR_SECRET)
    .update(`${ticketId}:${eventId}`)
    .digest('hex');
}

export function verifyQrToken(token: string, ticketId: string, eventId: string): boolean {
  const expected = generateQrToken(ticketId, eventId);
  return token === expected;
}

export async function generateQrDataUrl(ticketId: string, eventId: string): Promise<string> {
  const token = generateQrToken(ticketId, eventId);
  const payload = JSON.stringify({ ticketId, eventId, token });
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 400,
  });
}
