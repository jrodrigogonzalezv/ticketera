'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Ticket, Event } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MapPin, CalendarDays, Ticket as TicketIcon } from 'lucide-react';

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [event, setEvent] = useState<(Event & { imageUrl?: string }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, 'tickets', id));
      if (!snap.exists()) { setLoading(false); return; }
      const t = { id: snap.id, ...snap.data() } as Ticket;
      setTicket(t);

      const eventSnap = await getDoc(doc(db, 'events', t.eventId));
      if (eventSnap.exists()) {
        setEvent({ id: eventSnap.id, ...eventSnap.data() } as Event & { imageUrl?: string });
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Ticket no encontrado.</p>
      </div>
    );
  }

  const eventDate = event?.date
    ? new Date((event.date as unknown as { seconds: number }).seconds * 1000)
    : null;

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm overflow-hidden">
        {event?.imageUrl && (
          <img src={event.imageUrl} alt={event?.title} className="w-full h-40 object-cover" />
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
