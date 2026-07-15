'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Event, Organizer } from '@/types';
import EventCheckout from './EventCheckout';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MapPin, CalendarDays, Ticket } from 'lucide-react';

export default function EventPublicPage() {
  const params = useParams<{ org: string; eventSlug: string }>();
  const [data, setData] = useState<{ organizer: Organizer; event: Event } | null>(null);
  const [status, setStatus] = useState<'loading' | 'notfound' | 'ok'>('loading');

  useEffect(() => {
    async function load() {
      const orgsSnap = await getDocs(
        query(collection(db, 'organizers'), where('slug', '==', params.org))
      );
      if (orgsSnap.empty) { setStatus('notfound'); return; }
      const organizer = { id: orgsSnap.docs[0].id, ...orgsSnap.docs[0].data() } as Organizer;

      const eventsSnap = await getDocs(
        query(
          collection(db, 'events'),
          where('orgId', '==', organizer.id),
          where('slug', '==', params.eventSlug)
        )
      );
      if (eventsSnap.empty) { setStatus('notfound'); return; }
      const event = { id: eventsSnap.docs[0].id, ...eventsSnap.docs[0].data() } as Event;

      if (event.status !== 'published') { setStatus('notfound'); return; }

      setData({ organizer, event });
      setStatus('ok');
    }
    load();
  }, [params.org, params.eventSlug]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (status === 'notfound' || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 mb-2">Evento no encontrado</p>
          <p className="text-gray-500">El evento no existe o no está disponible.</p>
        </div>
      </div>
    );
  }

  const { organizer, event } = data;
  const eventWithExtra = event as Event & { imageUrl?: string; address?: string };
  const eventDate = event.date
    ? new Date((event.date as unknown as { seconds: number }).seconds * 1000)
    : null;
  const availableTypes = event.ticketTypes.filter((t) => t.sold < t.stock);

  return (
    <div className="min-h-screen bg-gray-50">
      {eventWithExtra.imageUrl && (
        <div className="w-full h-72 relative">
          <img src={eventWithExtra.imageUrl} alt={event.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 -mt-16 relative">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                {organizer.logoUrl && (
                  <img src={organizer.logoUrl} alt={organizer.name} className="w-6 h-6 rounded-full" />
                )}
                <span>{organizer.name}</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>

              <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
                {eventDate && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-blue-500" />
                    {format(eventDate, "EEEE d 'de' MMMM yyyy · HH:mm", { locale: es })}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  {eventWithExtra.address ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${eventWithExtra.address}, ${event.city}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {event.venue} · {eventWithExtra.address}, {event.city}
                    </a>
                  ) : (
                    <span>{event.venue}, {event.city}</span>
                  )}
                </span>
              </div>
            </div>

            {event.description && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-3">Sobre el evento</h2>
                <p className="text-gray-600 whitespace-pre-line">{event.description}</p>
              </div>
            )}
          </div>

          <div>
            {availableTypes.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
                <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-semibold text-gray-700">Entradas agotadas</p>
              </div>
            ) : (
              <EventCheckout event={event} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
