import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import type { Ticket } from '@/types';
import type { Event } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MapPin, CalendarDays, Ticket as TicketIcon } from 'lucide-react';

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snap = await adminDb.doc(`tickets/${id}`).get();
  if (!snap.exists) notFound();
  const ticket = { id: snap.id, ...snap.data() } as Ticket;

  const eventSnap = await adminDb.doc(`events/${ticket.eventId}`).get();
  const event = eventSnap.data() as Event;

  const eventDate = event?.date ? new Date((event.date as unknown as { seconds: number }).seconds * 1000) : null;

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm overflow-hidden">
        {(event as Event & { imageUrl?: string })?.imageUrl && (
          <img
            src={(event as Event & { imageUrl?: string }).imageUrl}
            alt={event?.title}
            className="w-full h-40 object-cover"
          />
        )}

        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TicketIcon className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-600">ENTRADA</span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
              ticket.status === 'valid' ? 'bg-green-100 text-green-700' :
              ticket.status === 'used' ? 'bg-gray-100 text-gray-500' :
              'bg-red-100 text-red-600'
            }`}>
              {ticket.status === 'valid' ? 'Válido' : ticket.status === 'used' ? 'Usado' : 'Cancelado'}
            </span>
          </div>

          <h1 className="text-xl font-bold text-gray-900">{event?.title}</h1>
          <p className="text-blue-600 font-medium mt-1">{ticket.ticketTypeName}</p>

          <div className="mt-3 space-y-1 text-sm text-gray-500">
            {eventDate && (
              <p className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4" />
                {format(eventDate, "d 'de' MMMM yyyy · HH:mm", { locale: es })}
              </p>
            )}
            {event?.venue && (
              <p className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {event.venue}, {event.city}
              </p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Titular</p>
            <p className="font-medium text-gray-900">{ticket.holderName}</p>
          </div>

          {ticket.qrCodeUrl && (
            <div className="mt-5 flex justify-center">
              <img src={ticket.qrCodeUrl} alt="QR Code" className="w-48 h-48" />
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-3 font-mono">{ticket.id.slice(0, 16).toUpperCase()}</p>
        </div>
      </div>
    </div>
  );
}
