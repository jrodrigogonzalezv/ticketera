import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import type { OrderItem } from '@/types';

const PLATFORM_ACCESS_TOKEN = process.env.MP_PLATFORM_ACCESS_TOKEN!;
const SERVICE_FEE_PERCENT = Number(process.env.SERVICE_FEE_PERCENT || 10);

export function getMpClient(accessToken?: string) {
  return new MercadoPagoConfig({
    accessToken: accessToken || PLATFORM_ACCESS_TOKEN,
  });
}

export async function createPreference({
  orderId,
  eventTitle,
  items,
  subtotal,
  buyerEmail,
  organizerAccessToken,
  successUrl,
  failureUrl,
  pendingUrl,
  webhookUrl,
}: {
  orderId: string;
  eventTitle: string;
  items: OrderItem[];
  subtotal: number;
  buyerEmail: string;
  organizerAccessToken: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  webhookUrl: string;
}) {
  const client = getMpClient(organizerAccessToken);
  const preference = new Preference(client);

  const serviceFee = Math.round(subtotal * (SERVICE_FEE_PERCENT / 100));

  const result = await preference.create({
    body: {
      external_reference: orderId,
      items: items.map((item) => ({
        id: item.ticketTypeId,
        title: `${eventTitle} - ${item.ticketTypeName}`,
        quantity: item.qty,
        unit_price: item.unitPrice,
        currency_id: 'CLP',
      })),
      payer: { email: buyerEmail },
      marketplace_fee: serviceFee,
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      },
      auto_return: 'approved',
      notification_url: webhookUrl,
    },
  });

  return result;
}

export async function getPayment(paymentId: string) {
  const client = getMpClient();
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}
