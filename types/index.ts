export interface Organizer {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  email: string;
  phone?: string;
  mpAccessToken?: string;
  mpUserId?: string;
  mpRefreshToken?: string;
  serviceFeePercent: number;
  status: 'active' | 'pending' | 'suspended';
  createdAt: Date;
}

export interface TicketType {
  id: string;
  name: string;
  price: number;
  stock: number;
  sold: number;
  description?: string;
}

export interface Event {
  id: string;
  orgId: string;
  title: string;
  slug: string;
  description: string;
  imageUrl?: string;
  date: Date;
  endDate?: Date;
  venue: string;
  city: string;
  ticketTypes: TicketType[];
  status: 'draft' | 'published' | 'cancelled' | 'finished';
  createdAt: Date;
}

export interface OrderItem {
  ticketTypeId: string;
  ticketTypeName: string;
  qty: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  eventId: string;
  orgId: string;
  buyerEmail: string;
  buyerName: string;
  buyerPhone?: string;
  items: OrderItem[];
  subtotal: number;
  serviceFee: number;
  total: number;
  mpPaymentId?: string;
  mpPreferenceId?: string;
  mpStatus?: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: Date;
  paidAt?: Date;
}

export interface Ticket {
  id: string;
  orderId: string;
  eventId: string;
  orgId: string;
  ticketTypeId: string;
  ticketTypeName: string;
  holderName: string;
  holderEmail: string;
  qrCodeUrl?: string;
  qrToken: string;
  status: 'valid' | 'used' | 'cancelled';
  scannedAt?: Date;
  scannedBy?: string;
  createdAt: Date;
}

export interface ValidationSession {
  id: string;
  eventId: string;
  orgId: string;
  validatorEmail: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
}
